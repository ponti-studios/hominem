import Foundation

public struct CookieJar: Codable, Equatable, Sendable {
    public struct StoredCookie: Codable, Equatable, Sendable {
        public let name: String
        public let value: String

        public init(name: String, value: String) {
            self.name = name
            self.value = value
        }
    }

    public private(set) var cookies: [StoredCookie]

    public init(cookies: [StoredCookie] = []) {
        self.cookies = cookies
    }

    public init(httpCookies: [HTTPCookie]) {
        self.cookies = httpCookies
            .sorted { $0.name < $1.name }
            .map { StoredCookie(name: $0.name, value: $0.value) }
    }

    public func merging(_ incoming: [StoredCookie]) -> CookieJar {
        guard incoming.isEmpty == false else {
            return self
        }

        var byName = Dictionary(uniqueKeysWithValues: cookies.map { ($0.name, $0) })
        incoming.forEach { cookie in
            if cookie.value.isEmpty {
                byName.removeValue(forKey: cookie.name)
            } else {
                byName[cookie.name] = cookie
            }
        }

        return CookieJar(cookies: byName.values.sorted { $0.name < $1.name })
    }

    public var isEmpty: Bool {
        cookies.isEmpty
    }

    public var headerValue: String? {
        guard cookies.isEmpty == false else {
            return nil
        }

        return cookies
            .map { "\($0.name)=\($0.value)" }
            .joined(separator: "; ")
    }

    public func httpCookies(for baseURL: URL) -> [HTTPCookie] {
        guard let host = baseURL.host() else {
            return []
        }

        return cookies.compactMap { cookie in
            HTTPCookie(
                properties: [
                    .domain: host,
                    .path: "/",
                    .name: cookie.name,
                    .value: cookie.value,
                    .secure: (baseURL.scheme ?? "http") == "https",
                ]
            )
        }
    }
}
