import SwiftUI

// MARK: - SettingsScreen

struct SettingsScreen: View {
    @Environment(Router.self) private var router
    @State private var nameText: String = ""
    @State private var isSavingName = false
    @State private var passkeys: [ManagedPasskey] = []
    @State private var isLoadingPasskeys = false
    @State private var isAddingPasskey = false
    @State private var passkeyError: String?
    @State private var showSignOutConfirm = false

    private let appLock = AppLock.shared
    private let screenCapture = ScreenCaptureService.shared

    private var user: AuthUser? {
        AuthProvider.shared.currentUser
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                accountSection
                privacySection
                chatsSection
                passkeysSection
                dangerSection
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, Spacing.lg)
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.Hakumi.bgBase.ignoresSafeArea())
        .task {
            nameText = user?.name ?? ""
            await loadPasskeys()
        }
        .confirmationDialog("Sign out", isPresented: $showSignOutConfirm, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) {
                Task {
                    await AuthProvider.shared.signOut()
                    router.resetForSignOut()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to sign out?")
        }
    }

    // MARK: Account

    private var accountSection: some View {
        SettingsSectionView(label: "Account") {
            // Name
            HStack {
                Image(systemName: "person")
                    .settingsIcon()
                TextField("Display name", text: $nameText)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.words)
                Spacer()
                if nameText != (user?.name ?? "") {
                    if isSavingName {
                        ProgressView().scaleEffect(0.75)
                    } else {
                        Button("Save") {
                            Task { await saveName() }
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.Hakumi.accent)
                    }
                }
            }
            .settingsRow()

            SettingsDivider()

            // Email
            HStack {
                Image(systemName: "envelope")
                    .settingsIcon()
                Text("Email")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.Hakumi.textPrimary)
                Spacer()
                Text(user?.email ?? "—")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .lineLimit(1)
            }
            .settingsRow()
        }
    }

    // MARK: Privacy

    private var privacySection: some View {
        SettingsSectionView(label: "Privacy") {
            HStack {
                Image(systemName: "faceid")
                    .settingsIcon()
                Text("Lock with Face ID")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.Hakumi.textPrimary)
                Spacer()
                Toggle("", isOn: Binding(
                    get: { appLock.isEnabled },
                    set: { appLock.isEnabled = $0 }
                ))
                .labelsHidden()
                .tint(Color.Hakumi.accent)
            }
            .settingsRow()

            SettingsDivider()

            HStack {
                Image(systemName: "eye.slash")
                    .settingsIcon()
                Text("Prevent screenshots")
                    .font(.system(size: 15))
                    .foregroundStyle(Color.Hakumi.textPrimary)
                Spacer()
                Toggle("", isOn: Binding(
                    get: { screenCapture.isPreventingScreenshots },
                    set: { screenCapture.isPreventingScreenshots = $0 }
                ))
                .labelsHidden()
                .tint(Color.Hakumi.accent)
            }
            .settingsRow()
        }
    }

    // MARK: Chats

    private var chatsSection: some View {
        SettingsSectionView(label: "Chats") {
            NavigationLink(value: ProtectedRoute.archivedChats) {
                HStack {
                    Image(systemName: "archivebox")
                        .settingsIcon()
                    Text("Archived chats")
                        .font(.system(size: 15))
                        .foregroundStyle(Color.Hakumi.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                }
                .settingsRow()
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: Passkeys

    private var passkeysSection: some View {
        SettingsSectionView(label: "Passkeys") {
            // Add passkey row
            Button {
                Task { await addPasskey() }
            } label: {
                HStack {
                    Image(systemName: "person.badge.key.fill")
                        .settingsIcon()
                    Text("Add passkey")
                        .font(.system(size: 15))
                        .foregroundStyle(Color.Hakumi.textPrimary)
                    Spacer()
                    if isAddingPasskey || isLoadingPasskeys {
                        ProgressView().scaleEffect(0.75)
                    }
                }
                .settingsRow()
            }
            .buttonStyle(.plain)
            .disabled(isAddingPasskey || isLoadingPasskeys)

            if let err = passkeyError {
                Text(err)
                    .font(.system(size: 12))
                    .foregroundStyle(.red.opacity(0.8))
                    .padding(.horizontal, Spacing.lg)
                    .padding(.bottom, Spacing.xs)
            }

            // Existing passkeys
            ForEach(passkeys) { passkey in
                SettingsDivider()
                HStack {
                    Image(systemName: "key.fill")
                        .settingsIcon()
                    Text(passkey.name)
                        .font(.system(size: 15))
                        .foregroundStyle(Color.Hakumi.textPrimary)
                    Spacer()
                    Button {
                        Task { await deletePasskey(passkey) }
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.red.opacity(0.8))
                    }
                    .buttonStyle(.plain)
                }
                .settingsRow()
            }
        }
    }

    // MARK: Danger zone

    private var dangerSection: some View {
        VStack(spacing: Spacing.sm) {
            Button {
                showSignOutConfirm = true
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 15))
                        .foregroundStyle(.red)
                    Text("Sign out")
                        .font(.system(size: 15))
                        .foregroundStyle(.red)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .fill(Color.Hakumi.bgSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                                .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)

            Button {
                // Account deletion not available in this release — alert only.
                // Matches Expo DangerZone behavior.
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "trash")
                        .font(.system(size: 15))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                    Text("Delete account")
                        .font(.system(size: 15))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
            }
            .buttonStyle(.plain)
        }
        .padding(.top, Spacing.md)
    }

    // MARK: Actions

    private func saveName() async {
        let trimmed = nameText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        isSavingName = true
        defer { isSavingName = false }
        do {
            try await AuthProvider.shared.updateName(trimmed)
        } catch {
            nameText = user?.name ?? ""
        }
    }

    private func loadPasskeys() async {
        isLoadingPasskeys = true
        defer { isLoadingPasskeys = false }
        passkeys = (try? await PasskeyManagementService.listPasskeys()) ?? []
    }

    private func addPasskey() async {
        isAddingPasskey = true
        passkeyError = nil
        defer { isAddingPasskey = false }
        do {
            try await PasskeyManagementService.addPasskey()
            await loadPasskeys()
        } catch PasskeyServiceError.cancelled {
            // User cancelled — silent
        } catch {
            passkeyError = "Could not add passkey. Please try again."
        }
    }

    private func deletePasskey(_ passkey: ManagedPasskey) async {
        do {
            try await PasskeyManagementService.deletePasskey(id: passkey.id)
            passkeys.removeAll { $0.id == passkey.id }
        } catch {
            passkeyError = "Could not remove passkey."
        }
    }
}

// MARK: - Section + Row helpers

private struct SettingsSectionView<Content: View>: View {
    let label: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(label.uppercased())
                .font(.system(size: 12, weight: .medium))
                .tracking(0.4)
                .foregroundStyle(Color.Hakumi.textTertiary)
                .padding(.horizontal, Spacing.xs)

            VStack(spacing: 0) {
                content()
            }
            .background(
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(Color.Hakumi.bgSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                            .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                    )
            )
        }
    }
}

private struct SettingsDivider: View {
    var body: some View {
        Divider()
            .background(Color.Hakumi.borderSubtle)
            .padding(.leading, Spacing.lg + 20 + Spacing.md)
    }
}

private extension View {
    func settingsRow() -> some View {
        self.padding(.horizontal, Spacing.lg)
             .padding(.vertical, Spacing.md)
    }
}

private extension Image {
    func settingsIcon() -> some View {
        self
            .font(.system(size: 14))
            .foregroundStyle(Color.Hakumi.textSecondary)
            .frame(width: 20)
    }
}

#Preview {
    NavigationStack {
        SettingsScreen()
            .environment(Router())
    }
}
