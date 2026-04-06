import SwiftUI

struct AccountView: View {
    @Bindable var model: AppModel

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: AppleTheme.sm) {
                    Text("SETTINGS")
                        .font(AppleTheme.sectionTitleFont)
                        .foregroundStyle(AppleTheme.foreground)

                    VStack(alignment: .leading, spacing: AppleTheme.lg) {
                        if let session = model.state.session {
                            PanelSection(title: "ACCOUNT") {
                                VStack(alignment: .leading, spacing: AppleTheme.sm) {
                                    Text(session.user.email)
                                        .font(AppleTheme.bodyStrongFont)
                                        .foregroundStyle(AppleTheme.foreground)
                                        .accessibilityIdentifier("account.emailText")

                                    Text(session.user.name ?? "Unnamed user")
                                        .font(AppleTheme.bodyFont)
                                        .foregroundStyle(AppleTheme.secondaryText)
                                        .accessibilityIdentifier("account.nameText")

                                    Text("Session: \(session.session.id)")
                                        .font(AppleTheme.monoCaptionFont)
                                        .foregroundStyle(AppleTheme.tertiaryText)
                                        .accessibilityIdentifier("account.sessionText")
                                }
                            }
                        }

                        PanelSection(title: "PASSKEYS") {
                            VStack(alignment: .leading, spacing: AppleTheme.sm) {
                                AppTextInput(
                                    label: "Passkey name",
                                    placeholder: "Name this passkey",
                                    text: $model.passkeyNameInput,
                                    accessibilityIdentifier: "account.passkeyNameField"
                                )

                                if model.state.passkeys.isEmpty {
                                    Text("No passkeys registered.")
                                        .font(AppleTheme.captionFont)
                                        .foregroundStyle(AppleTheme.tertiaryText)
                                } else {
                                    ForEach(model.state.passkeys) { passkey in
                                        HStack(alignment: .center, spacing: AppleTheme.sm) {
                                            VStack(alignment: .leading, spacing: AppleTheme.xs) {
                                                Text(passkey.name ?? "Unnamed passkey")
                                                    .font(AppleTheme.captionFont)
                                                    .foregroundStyle(AppleTheme.foreground)

                                                Text(passkey.id)
                                                    .font(AppleTheme.monoCaptionFont)
                                                    .foregroundStyle(AppleTheme.tertiaryText)
                                            }

                                            Spacer()

                                            Button("Remove") {
                                                Task {
                                                    await model.deletePasskey(id: passkey.id)
                                                }
                                            }
                                            .buttonStyle(AppButtonStyle(.destructiveLink))
                                        }
                                        .padding(AppleTheme.sm)
                                        .background(AppleTheme.background)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: AppleTheme.cardRadius, style: .continuous)
                                                .stroke(AppleTheme.border, lineWidth: 1)
                                        )
                                    }
                                }

                                Button("Add passkey") {
                                    Task {
                                        await model.registerPasskey()
                                    }
                                }
                                .buttonStyle(AppButtonStyle(.standard, fullWidth: true))
                                .accessibilityIdentifier("account.addPasskeyButton")

                                Button("Refresh passkeys") {
                                    Task {
                                        await model.refreshPasskeys()
                                    }
                                }
                                .buttonStyle(AppButtonStyle(.standard, fullWidth: true))
                                .accessibilityIdentifier("account.refreshPasskeysButton")
                            }
                        }

                        if let errorMessage = model.state.errorMessage {
                            PanelSection(title: "ERROR") {
                                Text(errorMessage)
                                    .font(AppleTheme.captionFont)
                                    .foregroundStyle(AppleTheme.destructive)
                                    .accessibilityIdentifier("account.errorText")

                                Button("Dismiss") {
                                    model.clearError()
                                }
                                .buttonStyle(AppButtonStyle(.link))
                                .accessibilityIdentifier("account.dismissErrorButton")
                            }
                        }
                    }
                }
                .frame(maxWidth: AppleTheme.contentWidth, alignment: .leading)
                .padding(.horizontal, AppleTheme.sm12)
                .padding(.top, AppleTheme.lg)
                .padding(.bottom, AppleTheme.md)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            VStack(spacing: AppleTheme.sm12) {
                Button("Sign out") {
                    Task {
                        await model.signOut()
                    }
                }
                .buttonStyle(AppButtonStyle(.standard, fullWidth: true))
                .accessibilityIdentifier("account.signOutButton")
            }
            .padding(.horizontal, AppleTheme.sm12)
            .padding(.top, AppleTheme.sm12)
            .padding(.bottom, AppleTheme.md)
            .background(AppleTheme.background)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(AppleTheme.border)
                    .frame(height: 1)
            }
        }
        .background(AppleTheme.background.ignoresSafeArea())
    }
}
