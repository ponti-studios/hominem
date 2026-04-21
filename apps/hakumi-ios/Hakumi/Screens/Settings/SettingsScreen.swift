import SwiftUI

// MARK: - SettingsScreen

struct SettingsScreen: View {
    @Environment(Router.self) private var router
    @State private var vm = SettingsViewModel()
    @State private var nameText: String = ""
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
            await vm.loadPasskeys()
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
                    if vm.isSavingName {
                        ProgressView().scaleEffect(0.75)
                    } else {
                        Button("Save") {
                            Task {
                                let success = await vm.saveName(nameText)
                                if !success { nameText = user?.name ?? "" }
                            }
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.Hakumi.accent)
                    }
                }
            }
            .settingsRow()

            SettingsDivider()

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
            Button {
                Task { await vm.addPasskey() }
            } label: {
                HStack {
                    Image(systemName: "person.badge.key.fill")
                        .settingsIcon()
                    Text("Add passkey")
                        .font(.system(size: 15))
                        .foregroundStyle(Color.Hakumi.textPrimary)
                    Spacer()
                    if vm.isAddingPasskey || vm.isLoadingPasskeys {
                        ProgressView().scaleEffect(0.75)
                    }
                }
                .settingsRow()
            }
            .buttonStyle(.plain)
            .disabled(vm.isAddingPasskey || vm.isLoadingPasskeys)

            if let err = vm.passkeyError {
                Text(err)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.Hakumi.destructive)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.bottom, Spacing.xs)
            }

            ForEach(vm.passkeys) { passkey in
                SettingsDivider()
                HStack {
                    Image(systemName: "key.fill")
                        .settingsIcon()
                    Text(passkey.name)
                        .font(.system(size: 15))
                        .foregroundStyle(Color.Hakumi.textPrimary)
                    Spacer()
                    Button {
                        Task { await vm.deletePasskey(passkey) }
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.Hakumi.destructive)
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
                .cardStyle()
            }
            .buttonStyle(.plain)

            Button {
                // Account deletion not available in this release — alert only.
            } label: {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "trash")
                        .font(.system(size: 15))
                        .foregroundStyle(Color.Hakumi.textDisabled)
                    Text("Delete account")
                        .font(.system(size: 15))
                        .foregroundStyle(Color.Hakumi.textDisabled)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
            }
            .buttonStyle(.plain)
            .disabled(true)
        }
        .padding(.top, Spacing.md)
    }
}

#Preview {
    NavigationStack {
        SettingsScreen()
            .environment(Router())
    }
}
