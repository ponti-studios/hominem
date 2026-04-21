import SwiftUI
import UIKit

// MARK: - RootView

struct RootView: View {
    @State private var router = Router()
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic

    var body: some View {
        Group {
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
    }

    // MARK: Onboarding

    private var onboardingStack: some View {
        NavigationStack {
            OnboardingScreen()
        }
        .styledBars()
    }

    // MARK: Protected shell

    private var protectedShell: some View {
        ZStack {
            NavigationSplitView(columnVisibility: $columnVisibility) {
                SidebarView()
                    .styledBars()
            } detail: {
                NavigationStack {
                    detailContent
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
            }
            .task { updateComposerTarget() }
            .onChange(of: router.sidebarSelection) { _, _ in updateComposerTarget() }
            .sheet(isPresented: $router.showSettings) {
                NavigationStack(path: $router.settingsPath) {
                    SettingsScreen()
                        .navigationDestination(for: ProtectedRoute.self) { route in
                            protectedDestination(route)
                        }
                }
                .styledBars()
            }

            if AppLock.shared.isEnabled && !AppLock.shared.isUnlocked {
                lockOverlay
            }
        }
        .appLockObserver()
    }

    @ViewBuilder
    private var detailContent: some View {
        if let selection = router.sidebarSelection {
            protectedDestination(selection)
        } else {
            emptyDetail
        }
    }

    @ViewBuilder
    private func protectedDestination(_ route: ProtectedRoute) -> some View {
        switch route {
        case .noteDetail(let id): NoteDetailScreen(id: id)
        case .chat(let id):       ChatScreen(id: id)
        case .archivedChats:      ArchivedChatsScreen()
        }
    }

    private var emptyDetail: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "sidebar.leading")
                .font(.system(size: 36))
                .foregroundStyle(Color.Hakumi.textTertiary)
            VStack(spacing: Spacing.xs) {
                Text("Nothing selected")
                    .textStyle(AppTypography.headline)
                    .foregroundStyle(Color.Hakumi.textPrimary)
                Text("Choose a note or chat from the sidebar.")
                    .textStyle(AppTypography.footnote)
                    .foregroundStyle(Color.Hakumi.textTertiary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.Hakumi.bgBase)
    }

    private var lockOverlay: some View {
        ZStack {
            Color.Hakumi.bgBase.ignoresSafeArea()
            VStack(spacing: Spacing.lg) {
                Text("Hakumi")
                    .textStyle(AppTypography.title1)
                    .foregroundStyle(Color.Hakumi.textPrimary)
                Text("Unlock to continue")
                    .textStyle(AppTypography.subhead)
                    .foregroundStyle(Color.Hakumi.textSecondary)
                AppButton("Unlock", variant: .primary) {
                    Task { await AppLock.shared.authenticate() }
                }
            }
        }
        .transition(.opacity)
    }

    private func updateComposerTarget() {
        ComposerState.shared.updateTarget(sidebarSelection: router.sidebarSelection)
    }

    private static var windowBounds: CGRect? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first(where: { $0.activationState == .foregroundActive })?
            .windows
            .first(where: \.isKeyWindow)?
            .bounds
    }
}

// MARK: - Bar styling helper

private extension View {
    func styledBars() -> some View {
        self
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar(.visible, for: .navigationBar)
            .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
    }
}

#Preview {
    RootView()
}
