import Foundation

@Observable
@MainActor
final class SettingsViewModel {

    private(set) var passkeys: [ManagedPasskey] = []
    private(set) var isLoadingPasskeys = false
    private(set) var isAddingPasskey = false
    private(set) var isSavingName = false
    private(set) var passkeyError: String? = nil

    // MARK: Name

    /// Returns `true` on success. Screen is responsible for rolling back the text field on failure.
    func saveName(_ name: String) async -> Bool {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return false }
        isSavingName = true
        defer { isSavingName = false }
        do {
            try await AuthProvider.shared.updateName(trimmed)
            return true
        } catch {
            return false
        }
    }

    // MARK: Passkeys

    func loadPasskeys() async {
        isLoadingPasskeys = true
        defer { isLoadingPasskeys = false }
        passkeys = (try? await PasskeyManagementService.listPasskeys()) ?? []
    }

    func addPasskey() async {
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

    func deletePasskey(_ passkey: ManagedPasskey) async {
        do {
            try await PasskeyManagementService.deletePasskey(id: passkey.id)
            passkeys.removeAll { $0.id == passkey.id }
        } catch {
            passkeyError = "Could not remove passkey."
        }
    }
}
