import SwiftUI

// MARK: - OnboardingScreen
// Mirrors the Expo onboarding.tsx: collects a display name from new users.
// Shown when the signed-in user has no name set.
// On success routes to .authenticated via Router.authPhase.

struct OnboardingScreen: View {
    @Environment(Router.self) private var router

    @State private var name = ""
    @State private var isSubmitting = false
    @State private var error: String? = nil

    private var trimmedName: String { name.trimmingCharacters(in: .whitespaces) }
    private var canSubmit: Bool { !trimmedName.isEmpty && !isSubmitting }

    var body: some View {
        GeometryReader { proxy in
            VStack(spacing: 0) {
                Spacer()

                VStack(alignment: .center, spacing: Spacing.xl) {
                    VStack(spacing: Spacing.sm) {
                        Text("WELCOME")
                            .font(.system(size: 32, weight: .black))
                            .foregroundStyle(Color.Hakumi.textPrimary)
                            .tracking(4)

                        Text("DEFINE PROFILE IDENTIFIER.")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.Hakumi.textTertiary)
                            .tracking(2)
                    }

                    AppTextField(
                        label: "Name",
                        placeholder: "Enter your name",
                        text: Binding(
                            get: { name },
                            set: { name = $0; error = nil }
                        ),
                        isDisabled: isSubmitting,
                        error: error
                    )
                    .autocorrectionDisabled()

                    VStack(spacing: Spacing.sm) {
                        AppButton("Create profile", variant: .primary, isLoading: isSubmitting) {
                            Task { await handleCreateProfile() }
                        }
                        .disabled(!canSubmit)
                        .frame(maxWidth: .infinity)

                        AppButton("Sign out", variant: .ghost) {
                            Task { await AuthProvider.shared.signOut()
                                router.authPhase = .unauthenticated
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, Spacing.lg)

                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .frame(minHeight: proxy.size.height)
        }
        .background(Color.Hakumi.bgBase)
        .navigationTitle("")
        .navigationBarHidden(true)
    }

    // MARK: - Actions

    private func handleCreateProfile() async {
        guard canSubmit else { return }

        isSubmitting = true
        error = nil
        defer { isSubmitting = false }

        do {
            try await AuthProvider.shared.updateName(trimmedName)
            router.completeAuthentication()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        OnboardingScreen()
            .environment(Router())
    }
}
