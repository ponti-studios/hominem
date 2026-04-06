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

    private let authService: AuthService
    private let authTestSecret: String?
    private var hasBooted = false

    public var canFetchLocalTestOTP: Bool {
        authTestSecret != nil && state.pendingEmail.isEmpty == false
    }

    public init(authService: AuthService, authTestSecret: String? = nil) {
        self.authService = authService
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
        return AppModel(authService: authService, authTestSecret: environment.authTestSecret)
    }

    public func bootIfNeeded() async {
        guard hasBooted == false else {
            return
        }

        hasBooted = true
        await apply(.bootStarted)

        do {
            if let session = try await authService.restoreSession() {
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
        await apply(.signOutStarted)

        do {
            try await authService.signOut()
            otpInput = ""
            emailInput = ""
            nameInput = ""
            passkeyNameInput = ""
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
