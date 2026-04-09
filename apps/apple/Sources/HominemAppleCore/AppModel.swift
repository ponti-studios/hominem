import Foundation
import Observation

@MainActor
@Observable
public final class AppModel {
    public private(set) var state = AuthState()
    public var emailInput = ""
    public var otpInput = ""
    public var nameInput = ""
    public var passkeyNameInput = ""

    // MARK: - Stores (Phase 5)
    public let notesStore: NotesStore
    public let chatsStore: ChatsStore
    public let feedViewModel: FeedViewModel

    // MARK: - Services (Phase 6)
    public let appLock: AppLockService
    public let ttsPlayer: TTSPlayer?
    public let voiceService: VoiceService?

    // MARK: - Sync
    public let syncCoordinator: AppleSyncCoordinator

    private let authService: AuthService
    private let authTestSecret: String?
    private var hasBooted = false

    public var canFetchLocalTestOTP: Bool {
        authTestSecret != nil && state.pendingEmail.isEmpty == false
    }

    public init(
        authService: AuthService,
        notesStore: NotesStore,
        chatsStore: ChatsStore,
        feedViewModel: FeedViewModel,
        syncCoordinator: AppleSyncCoordinator,
        appLock: AppLockService = AppLockService(),
        voiceService: VoiceService? = nil,
        ttsPlayer: TTSPlayer? = nil,
        authTestSecret: String? = nil
    ) {
        self.authService = authService
        self.notesStore = notesStore
        self.chatsStore = chatsStore
        self.feedViewModel = feedViewModel
        self.syncCoordinator = syncCoordinator
        self.appLock = appLock
        self.voiceService = voiceService
        self.ttsPlayer = ttsPlayer
        self.authTestSecret = authTestSecret
    }

    public static func live() -> AppModel {
        let environment = AppEnvironment.live()
        let sessionStore = KeychainSessionStore(service: environment.sessionStoreService)
        if environment.resetSessionOnLaunch {
            try? sessionStore.clear()
        }
        let client = APIClient(baseURL: environment.apiBaseURL, sessionStore: sessionStore)
        let authService = AuthService(
            client: client,
            passkeyProvider: SystemPasskeyProvider()
        )
        // Build local database (silently disabled on failure)
        let database = try? LocalDatabase.onDisk()
        let notesStore = NotesStore(service: NotesService(client: client), database: database)
        let chatsStore = ChatsStore(service: ChatsService(client: client), database: database)
        let feedViewModel = FeedViewModel(notesStore: notesStore, chatsStore: chatsStore)
        let voiceService = VoiceService(client: client)
        let ttsPlayer = TTSPlayer(voiceService: voiceService)
        let syncCoordinator = AppleSyncCoordinator(
            authService: authService,
            notesStore: notesStore,
            chatsStore: chatsStore
        )
        return AppModel(
            authService: authService,
            notesStore: notesStore,
            chatsStore: chatsStore,
            feedViewModel: feedViewModel,
            syncCoordinator: syncCoordinator,
            appLock: AppLockService(),
            voiceService: voiceService,
            ttsPlayer: ttsPlayer,
            authTestSecret: environment.authTestSecret
        )
    }

    public func bootIfNeeded() async {
        guard hasBooted == false else {
            return
        }

        hasBooted = true
        await apply(.bootStarted)

        do {
            if let session = try await authService.restoreSession() {
                // Hydrate stores from cache BEFORE updating UI state so the first
                // render already has content available.
                await notesStore.hydrateFromCache(userId: session.user.id)
                await chatsStore.hydrateFromCache(userId: session.user.id)
                feedViewModel.rebuild()

                await apply(.sessionLoaded(session))
                let passkeys = try await authService.listPasskeys()
                await apply(.passkeysLoaded(passkeys))
            } else {
                await apply(.sessionMissing)
            }
        } catch {
            await apply(.failed(error.localizedDescription))
        }
    }

    public func requestEmailOTP() async {
        let email = emailInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard email.isEmpty == false else {
            await apply(.failed("Enter your email address first."))
            return
        }

        await apply(.emailOTPStarted(email))

        do {
            try await authService.sendEmailOTP(email: email)
            await apply(.emailOTPSent)
        } catch {
            await apply(.failed(error.localizedDescription))
        }
    }

    public func verifyEmailOTP() async {
        guard state.pendingEmail.isEmpty == false else {
            await apply(.failed("Request a sign-in code first."))
            return
        }

        await apply(.emailOTPVerificationStarted)

        do {
            let session = try await authService.verifyEmailOTP(
                email: state.pendingEmail,
                otp: otpInput,
                name: normalized(value: nameInput)
            )
            await apply(.sessionLoaded(session))
            let passkeys = try await authService.listPasskeys()
            await apply(.passkeysLoaded(passkeys))
        } catch {
            await apply(.failed(error.localizedDescription))
        }
    }

    public func fetchLatestTestOTP() async {
        guard let authTestSecret else {
            await apply(.failed("Local test OTP tools are not enabled for this build."))
            return
        }

        guard state.pendingEmail.isEmpty == false else {
            await apply(.failed("Request a sign-in code first."))
            return
        }

        do {
            otpInput = try await authService.fetchLatestTestOTP(
                email: state.pendingEmail,
                secret: authTestSecret
            )
            state.errorMessage = nil
        } catch {
            await apply(.failed(error.localizedDescription))
        }
    }

    public func signInWithPasskey() async {
        await apply(.passkeySignInStarted)

        do {
            let session = try await authService.signInWithPasskey()
            await apply(.sessionLoaded(session))
            let passkeys = try await authService.listPasskeys()
            await apply(.passkeysLoaded(passkeys))
        } catch {
            await apply(.failed(error.localizedDescription))
        }
    }

    public func refreshPasskeys() async {
        await apply(.passkeysRefreshStarted)

        do {
            let passkeys = try await authService.listPasskeys()
            await apply(.passkeysLoaded(passkeys))
        } catch {
            await apply(.failed(error.localizedDescription))
        }
    }

    public func registerPasskey() async {
        await apply(.passkeyRegistrationStarted)

        do {
            let passkeys = try await authService.registerPasskey(name: normalized(value: passkeyNameInput))
            passkeyNameInput = ""
            await apply(.passkeysLoaded(passkeys))
        } catch {
            await apply(.failed(error.localizedDescription))
        }
    }

    public func deletePasskey(id: String) async {
        await apply(.passkeyDeletionStarted)

        do {
            let passkeys = try await authService.deletePasskey(id: id)
            await apply(.passkeysLoaded(passkeys))
        } catch {
            await apply(.failed(error.localizedDescription))
        }
    }

    public func signOut() async {
        // Capture userId before we lose the session
        let userId = state.session?.user.id
        await apply(.signOutStarted)

        do {
            try await authService.signOut()
            otpInput = ""
            emailInput = ""
            nameInput = ""
            passkeyNameInput = ""
            ttsPlayer?.stop()

            // Clear all persisted content for this user
            if let userId {
                await notesStore.clearCache(userId: userId)
                await chatsStore.clearCache(userId: userId)
            }

            await apply(.sessionMissing)
        } catch {
            await apply(.failed(error.localizedDescription))
        }
    }

    public func clearError() {
        state = reduceAuthState(state, .clearError)
    }

    private func normalized(value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func apply(_ action: AuthAction) async {
        state = reduceAuthState(state, action)
    }
}
