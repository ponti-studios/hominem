import Foundation
import Security

// MARK: - AppLockStore
//
// Keychain-backed persistence for the app-lock enabled flag.
// Replaced UserDefaults so the setting is encrypted at rest.

enum AppLockStore {

    private static var service: String {
        (Bundle.main.bundleIdentifier ?? "com.pontistudios.hakumi") + ".applock"
    }
    private static let account = "enabled"

    // MARK: - Load

    static func load() -> Bool {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData:  true,
            kSecMatchLimit:  kSecMatchLimitOne
        ]
        var item: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let str = String(data: data, encoding: .utf8) else { return false }
        return str == "1"
    }

    // MARK: - Save

    static func save(_ enabled: Bool) {
        let data = Data((enabled ? "1" : "0").utf8)
        // Delete any existing entry first (SecItemUpdate is more complex and not needed here).
        delete()
        let query: [CFString: Any] = [
            kSecClass:              kSecClassGenericPassword,
            kSecAttrService:        service,
            kSecAttrAccount:        account,
            kSecValueData:          data,
            kSecAttrAccessible:     kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    // MARK: - Delete

    @discardableResult
    static func delete() -> Bool {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}
