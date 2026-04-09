import SwiftUI

/// Full settings screen — account info, passkey management, app-lock toggle.
///
/// Replaces the old `AccountView`. The E2E test still resolves
/// `account.emailText` and `Sign out` button from this view.
public struct SettingsView: View {
    @Bindable var model: AppModel

    public init(model: AppModel) {
        self.model = model
    }

    public var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: AppleTheme.lg) {
                    accountSection
                    passkeySection
                    appLockSection
                    errorSection
                }
                .frame(maxWidth: AppleTheme.contentWidth, alignment: .leading)
                .padding(.horizontal, AppleTheme.sm12)
                .padding(.top, AppleTheme.lg)
                .padding(.bottom, AppleTheme.md)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            bottomBar
        }
        .background(AppleTheme.background.ignoresSafeArea())
        .navigationTitle("Settings")
    }

    // MARK: - Account section

    @ViewBuilder
    private var accountSection: some View {
        if let session = model.state.session {
            PanelSection(title: "ACCOUNT") {
                VStack(alignment: .leading, spacing: AppleTheme.sm) {
                    Text(session.user.email)
                        .font(AppleTheme.bodyStrongFont)
                        .foregroundStyle(AppleTheme.foreground)
                        .accessibilityIdentifier("account.emailText")
                        .accessibilityValue(session.user.email)

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
    }

    // MARK: - Passkey section

    private var passkeySection: some View {
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
                        PasskeyRow(passkey: passkey) {
                            Task { await model.deletePasskey(id: passkey.id) }
                        }
                    }
                }

                Button("Add passkey") {
                    Task { await model.registerPasskey() }
                }
                .buttonStyle(AppButtonStyle(.standard, fullWidth: true))
                .accessibilityIdentifier("account.addPasskeyButton")

                Button("Refresh passkeys") {
                    Task { await model.refreshPasskeys() }
                }
                .buttonStyle(AppButtonStyle(.standard, fullWidth: true))
                .accessibilityIdentifier("account.refreshPasskeysButton")
            }
        }
    }

    // MARK: - App lock section

    @ViewBuilder
    private var appLockSection: some View {
        if model.appLock.biometryType != .none {
            PanelSection(title: "SECURITY") {
                Toggle(isOn: Binding(
                    get: { model.appLock.isEnabled },
                    set: { model.appLock.isEnabled = $0 }
                )) {
                    VStack(alignment: .leading, spacing: AppleTheme.xs) {
                        Text("\(model.appLock.biometryLabel) Lock")
                            .font(AppleTheme.bodyFont)
                            .foregroundStyle(AppleTheme.foreground)
                        Text("Require authentication when the app becomes active.")
                            .font(AppleTheme.captionFont)
                            .foregroundStyle(AppleTheme.secondaryText)
                    }
                }
                .accessibilityIdentifier("settings.appLockToggle")
            }
        }
    }

    // MARK: - Error section

    @ViewBuilder
    private var errorSection: some View {
        if let errorMessage = model.state.errorMessage {
            PanelSection(title: "ERROR") {
                Text(errorMessage)
                    .font(AppleTheme.captionFont)
                    .foregroundStyle(AppleTheme.destructive)
                    .accessibilityIdentifier("account.errorText")

                Button("Dismiss") { model.clearError() }
                    .buttonStyle(AppButtonStyle(.link))
                    .accessibilityIdentifier("account.dismissErrorButton")
            }
        }
    }

    // MARK: - Bottom bar

    private var bottomBar: some View {
        VStack(spacing: AppleTheme.sm12) {
            Button("Sign out") {
                Task { await model.signOut() }
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
}

// MARK: - PasskeyRow

private struct PasskeyRow: View {
    let passkey: RegisteredPasskey
    let onDelete: () -> Void

    var body: some View {
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

            Button("Remove", action: onDelete)
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

// MARK: - App lock overlay

/// Full-screen lock overlay shown when `AppLockService.state == .locked`.
/// Embed this above the root `ContentView` in the app entry point.
public struct AppLockOverlay: View {
    @Bindable var appLock: AppLockService

    public init(appLock: AppLockService) {
        self.appLock = appLock
    }

    public var body: some View {
        ZStack {
            AppleTheme.background.ignoresSafeArea()
            VStack(spacing: AppleTheme.lg) {
                Image(systemName: lockIcon)
                    .font(.system(size: 48))
                    .foregroundStyle(AppleTheme.secondaryText)

                Text("Hominem is locked")
                    .font(AppleTheme.bodyStrongFont)
                    .foregroundStyle(AppleTheme.foreground)

                Button("Unlock with \(appLock.biometryLabel)") {
                    Task { await appLock.unlock() }
                }
                .buttonStyle(AppButtonStyle(.standard, fullWidth: false))
                .accessibilityIdentifier("appLock.unlockButton")

                if case .failed(let msg) = appLock.state {
                    Text(msg)
                        .font(AppleTheme.captionFont)
                        .foregroundStyle(AppleTheme.destructive)
                        .multilineTextAlignment(.center)

                    Button("Try again") { appLock.resetFailedState() }
                        .buttonStyle(AppButtonStyle(.link))
                }
            }
            .padding(AppleTheme.xl)
        }
    }

    private var lockIcon: String {
        switch appLock.biometryType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        default: return "lock.fill"
        }
    }
}
