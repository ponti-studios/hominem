import Foundation
import Security

// MARK: - SessionStore
// Keychain-backed persistence for the session cookie header string.
// Mirrors the Expo app's expo-secure-store usage in session-cookie.ts.

enum SessionStore {

    // Keep service scoped per bundle so variants don't share sessions.
    private static var service: String {
        Bundle.main.bundleIdentifier ?? "com.pontistudios.hakumi"
    }
    private static let account = "session-cookie"

    // MARK: - Save

    static func save(_ cookieHeader: String) throws {
        let data = Data(cookieHeader.utf8)
        delete() // Remove any existing entry first

        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecValueData:   data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw SessionStoreError.saveFailed(status)
        }
    }

    // MARK: - Load

    static func load() -> String? {
        let query: [CFString: Any] = [
            kSecClass:          kSecClassGenericPassword,
            kSecAttrService:    service,
            kSecAttrAccount:    account,
            kSecReturnData:     true,
            kSecMatchLimit:     kSecMatchLimitOne
        ]

        var item: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        guard status == errSecSuccess,
              let data = item as? Data,
              let cookie = String(data: data, encoding: .utf8) else {
            return nil
        }
        return cookie
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

// MARK: - Error

enum SessionStoreError: LocalizedError {
    case saveFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .saveFailed(let status):
            return "Keychain write failed (OSStatus \(status))."
        }
    }
}
