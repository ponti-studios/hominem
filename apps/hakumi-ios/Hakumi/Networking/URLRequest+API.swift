import Foundation

// MARK: - URLRequest helpers
//
// Centralises the two patterns repeated across every service:
//  1. Injecting auth headers from AuthProvider.
//  2. Validating the HTTP status code and throwing a typed error on failure.

extension URLRequest {

    // MARK: - Auth headers

    /// Applies the current session cookie headers from AuthProvider.
    /// Must be called from a @MainActor context (all API services qualify).
    @MainActor @discardableResult
    mutating func applyAuthHeaders() -> Self {
        for (key, value) in AuthProvider.shared.getAuthHeaders() {
            setValue(value, forHTTPHeaderField: key)
        }
        return self
    }

    // MARK: - Response validation

    /// Throws `error` when the HTTP status code is outside 200–299.
    static func validate(_ response: URLResponse, throwing error: Error) throws {
        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            throw error
        }
    }
}
