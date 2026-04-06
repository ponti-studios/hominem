import Foundation
import Security

public protocol SessionStore: Sendable {
    func load() throws -> CookieJar
    func save(_ cookieJar: CookieJar) throws
    func clear() throws
}

public struct KeychainSessionStore: SessionStore {
    private let service: String
    private let account: String
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(
        service: String = "io.hominem.apple.auth",
        account: String = "session-cookies"
    ) {
        self.service = service
        self.account = account
    }

    public func load() throws -> CookieJar {
        var item: CFTypeRef?
        let status = SecItemCopyMatching(
            [
                kSecClass: kSecClassGenericPassword,
                kSecAttrService: service,
                kSecAttrAccount: account,
                kSecReturnData: true,
                kSecMatchLimit: kSecMatchLimitOne,
            ] as CFDictionary,
            &item
        )

        if status == errSecItemNotFound {
            return CookieJar()
        }

        guard status == errSecSuccess, let data = item as? Data else {
            throw SessionStoreError.readFailed(status)
        }

        return try decoder.decode(CookieJar.self, from: data)
    }

    public func save(_ cookieJar: CookieJar) throws {
        let data = try encoder.encode(cookieJar)
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ] as CFDictionary

        let status = SecItemCopyMatching(query, nil)
        if status == errSecSuccess {
            let updateStatus = SecItemUpdate(query, [kSecValueData: data] as CFDictionary)
            guard updateStatus == errSecSuccess else {
                throw SessionStoreError.writeFailed(updateStatus)
            }
            return
        }

        let addStatus = SecItemAdd(
            [
                kSecClass: kSecClassGenericPassword,
                kSecAttrService: service,
                kSecAttrAccount: account,
                kSecValueData: data,
            ] as CFDictionary,
            nil
        )

        guard addStatus == errSecSuccess else {
            throw SessionStoreError.writeFailed(addStatus)
        }
    }

    public func clear() throws {
        let status = SecItemDelete(
            [
                kSecClass: kSecClassGenericPassword,
                kSecAttrService: service,
                kSecAttrAccount: account,
            ] as CFDictionary
        )

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SessionStoreError.deleteFailed(status)
        }
    }
}

public enum SessionStoreError: Error, LocalizedError, Equatable {
    case readFailed(OSStatus)
    case writeFailed(OSStatus)
    case deleteFailed(OSStatus)

    public var errorDescription: String? {
        switch self {
        case .readFailed(let status):
            return "Unable to read the saved session (\(status))."
        case .writeFailed(let status):
            return "Unable to save the session (\(status))."
        case .deleteFailed(let status):
            return "Unable to clear the session (\(status))."
        }
    }
}
