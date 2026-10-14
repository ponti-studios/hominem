import ExpoModulesCore
import Foundation
import HominemAuth

private struct AuthContext: @unchecked Sendable {
  let client: AuthClient
  let store: SessionStore
}

private actor AuthContextRegistry {
  private var contexts: [String: AuthContext] = [:]

  func context(baseURL: String) throws -> AuthContext {
    if let context = contexts[baseURL] {
      return context
    }
    guard let url = URL(string: baseURL), let scheme = url.scheme, let host = url.host else {
      throw HominemAuthError.invalidURL
    }
    let configuration = AuthConfiguration(
      baseURL: url,
      keychainService: "com.hominem.auth.omiro",
      userAgent: "Omiro"
    )
    guard !scheme.isEmpty, !host.isEmpty else {
      throw HominemAuthError.invalidURL
    }
    let store = SessionStore(configuration: configuration)
    let context = AuthContext(client: AuthClient(configuration: configuration, store: store), store: store)
    contexts[baseURL] = context
    return context
  }
}

private struct UpdateUserBody: Encodable {
  let name: String?
  let image: String?
}

public final class HominemAuthModule: Module {
  private let registry = AuthContextRegistry()

  public func definition() -> ModuleDefinition {
    let registry = self.registry
    Name("HominemAuth")

    AsyncFunction("getSession") { (baseURL: String) async throws -> [String: Any]? in
      let context = try await registry.context(baseURL: baseURL)
      do {
        guard let user = try await context.client.getSession() else { return nil }
        return try Self.userDictionary(user)
      } catch {
        guard let user = context.client.cachedUser() else { throw error }
        return try Self.userDictionary(user)
      }
    }

    AsyncFunction("requestOTP") { (baseURL: String, email: String) async throws in
      try await registry.context(baseURL: baseURL).client.requestOTP(email: email)
    }

    AsyncFunction("verifyOTP") { (baseURL: String, email: String, otp: String) async throws -> [String: Any] in
      let context = try await registry.context(baseURL: baseURL)
      guard let user = try await context.client.verifyOTP(email: email, otp: otp).user else {
        throw HominemAuthError.missingSessionToken
      }
      return try Self.userDictionary(user)
    }

    AsyncFunction("signOut") { (baseURL: String) async throws in
      let context = try await registry.context(baseURL: baseURL)
      do {
        try await context.client.signOut()
      } catch {
        context.store.clear()
        throw error
      }
    }

    AsyncFunction("updateUser") { (baseURL: String, name: String?, image: String?) async throws -> [String: Any] in
      let client = try await registry.context(baseURL: baseURL).client
      _ = try await client.authenticatedRequest(
        path: "/api/auth/update-user",
        method: "POST",
        body: UpdateUserBody(name: name, image: image)
      )
      guard let user = try await client.getSession() else {
        throw HominemAuthError.notAuthenticated
      }
      return try Self.userDictionary(user)
    }

    AsyncFunction("getCookie") { (baseURL: String) async throws -> String? in
      let store = try await registry.context(baseURL: baseURL).store
      if let cookies = store.storedCookies() {
        return cookies.headerValue
      }
      guard let token = store.sessionToken else { return nil }
      return "better-auth.session_token=\(token); __Secure-better-auth.session_token=\(token)"
    }
  }

  private static func userDictionary(_ user: AuthUser) throws -> [String: Any] {
    let data = try JSONEncoder().encode(user)
    guard let dictionary = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw HominemAuthError.server(status: -1, message: "Unable to serialize the authenticated user.")
    }
    return dictionary
  }
}
