import SwiftUI
import UIKit

    
// MARK: - RootView

struct RootView: View {
    @State private var router = Router()
    
    var body: some View {
        ZStack {
            switch router.authPhase {
            case .booting:
                bootingView
            case .unauthenticated:
                authStack
            case .onboarding:
                onboardingStack
            case .authenticated:
                protectedShell
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .environment(router)
        .onOpenURL { url in router.handle(url: url) }
        .task { router.bootstrap() }
    }

    // MARK: Booting

    private var bootingView: some View {
        ZStack {
            Color.Hakumi.bgBase.ignoresSafeArea()
            ProgressView().tint(Color.Hakumi.textTertiary)
        }
    }

    // MARK: Auth stack

    private var authStack: some View {
        NavigationStack(path: $router.authPath) {
            AuthSignInScreen()
                .navigationDestination(for: AuthRoute.self) { route in
                    switch route {
                    case .verifyOTP(let email):
                        VerifyOTPScreen(email: email)
                    }
                }
        }
        .styledBars()
        .toolbar(.hidden, for: .tabBar)
    }

    // MARK: Onboarding

    private var onboardingStack: some View {
        NavigationStack {
            OnboardingScreen()
        }
        .styledBars()
        .toolbar(.hidden, for: .tabBar)
    }

    // MARK: Protected shell
    // Each tab owns its own NavigationStack so the outer shell has no nav bar.
    // Push destinations (NoteDetail, Chat, ArchivedChats) are driven by
    // Router.protectedPath and handled inside each tab's stack via the environment.

    private var protectedShell: some View {
        ZStack {
            tabShell

            // App-lock overlay — shown when lock is enabled and the user hasn't authenticated
            if AppLock.shared.isEnabled && !AppLock.shared.isUnlocked {
                lockOverlay
            }
        }
        .appLockObserver()
    }

    private var tabShell: some View {
        TabView(selection: $router.selectedTab) {
            Tab(value: ProtectedTab.inbox) {
                NavigationStack(path: $router.protectedPath) {
                    InboxScreen()
                        .navigationDestination(for: ProtectedRoute.self) { route in
                            protectedDestination(route)
                        }
                }
                .styledBars()
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if !ComposerState.shared.target.isHidden {
                        SharedComposerCard(target: ComposerState.shared.target)
                    }
                }
            } label: {
                Label("Inbox", systemImage: "tray")
            }

            Tab(value: ProtectedTab.notes) {
                NavigationStack(path: $router.notesPath) {
                    NotesScreen()
                        .navigationDestination(for: ProtectedRoute.self) { route in
                            protectedDestination(route)
                        }
                }
                .styledBars()
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if !ComposerState.shared.target.isHidden {
                        SharedComposerCard(target: ComposerState.shared.target)
                    }
                }
            } label: {
                Label("Notes", systemImage: "note.text")
            }

            Tab(value: ProtectedTab.settings) {
                NavigationStack(path: $router.settingsPath) {
                    SettingsScreen()
                        .navigationDestination(for: ProtectedRoute.self) { route in
                            protectedDestination(route)
                        }
                }
                .styledBars()
            } label: {
                Label("Settings", systemImage: "gearshape")
            }
        }
        .tint(Color.Hakumi.accent)
        .toolbarBackground(.hidden, for: .tabBar)
        .toolbar(.visible, for: .tabBar)
        .task { updateComposerTarget() }
        .onChange(of: router.selectedTab) { _, _ in updateComposerTarget() }
        .onChange(of: router.protectedPath) { _, _ in updateComposerTarget() }
        .onChange(of: router.notesPath) { _, _ in updateComposerTarget() }
    }

    private func updateComposerTarget() {
        ComposerState.shared.updateTarget(
            selectedTab: router.selectedTab,
            protectedPath: router.protectedPath,
            notesPath: router.notesPath
        )
    }

    private static var windowBounds: CGRect? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first(where: { $0.activationState == .foregroundActive })?
            .windows
            .first(where: \.isKeyWindow)?
            .bounds
    }

    private var lockOverlay: some View {
        ZStack {
            Color.Hakumi.bgBase.ignoresSafeArea()
            VStack(spacing: Spacing.lg) {
                Text("Hakumi")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(Color.Hakumi.textPrimary)
                Text("Unlock to continue")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.Hakumi.textSecondary)
                AppButton("Unlock", variant: .primary) {
                    Task { await AppLock.shared.authenticate() }
                }
            }
        }
        .transition(.opacity)
    }

    @ViewBuilder
    private func protectedDestination(_ route: ProtectedRoute) -> some View {
        switch route {
        case .noteDetail(let id): NoteDetailScreen(id: id)
        case .chat(let id):       ChatScreen(id: id)
        case .archivedChats:      ArchivedChatsScreen()
        }
    }
}

// MARK: - Bar styling helper

private extension View {
    func styledBars() -> some View {
        self
            // Make navigation bar transparent so app background shows through
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar(.visible, for: .navigationBar)
            .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
    }
}

#Preview {
    RootView()
}
