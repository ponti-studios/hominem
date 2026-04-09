// MARK: - Application Environment Configuration
// This file manages all environment-specific settings for the app.
// It reads from Info.plist and environment variables to configure the app behavior.

import Foundation

/// Represents the app's runtime environment and configuration
///
/// This struct holds all environment-specific settings needed throughout the app:
/// - API endpoint URLs
/// - Authentication configuration
/// - Feature flags for testing
/// - Keychain service identifiers
///
/// Conformances:
/// - Equatable: Can be compared for equality (useful for testing)
/// - Sendable: Can be safely passed across thread boundaries (required by Swift concurrency)
public struct AppEnvironment: Equatable, Sendable {
    /// Human-readable environment name (e.g., "Debug", "Release", "Staging")
    /// Used for logging and UI to identify which build you're running
    public let name: String

    /// The base URL for all API requests (e.g., "http://localhost:4040")
    /// All API endpoints are relative to this URL
    public let apiBaseURL: URL

    /// Associated domain for passkey autofill (e.g., "api.ponti.io")
    /// Used by Apple's passkey system to link credentials to your domain
    /// Must match the Associated Domains entitlement in the app
    public let passkeyAssociatedDomain: String

    /// Relying Party ID for passkey authentication (e.g., "api.ponti.io")
    /// Identifies your service to the passkey provider
    /// Usually the domain name of your API server
    public let passkeyRPID: String

    /// Whether the authentication test hook is enabled
    /// Test hook allows bypassing passkey auth in test/debug builds
    /// Only enabled in debug builds or when explicitly configured
    public let isAuthTestHookEnabled: Bool

    /// Secret required to use the auth test hook (if enabled)
    /// This prevents unauthorized use of the test bypass
    /// May be nil if test hook is disabled
    public let authTestSecret: String?

    /// Keychain service identifier for storing session credentials
    /// Different values for normal and E2E test builds to avoid cross-contamination
    /// Uses iOS-specific Keychain format: "io.hominem.apple.auth" or "io.hominem.apple.auth.e2e"
    public let sessionStoreService: String

    /// Whether to reset the session when the app launches
    /// True in E2E test builds to ensure clean state
    /// False in normal builds to persist user sessions
    public let resetSessionOnLaunch: Bool

    /// Initialize an AppEnvironment with explicit values
    /// - Parameters:
    ///   - name: Environment name for logging/identification
    ///   - apiBaseURL: Base URL for API requests
    ///   - passkeyAssociatedDomain: Domain for passkey autofill
    ///   - passkeyRPID: Relying Party ID for passkey auth
    ///   - isAuthTestHookEnabled: Enable test auth bypass
    ///   - authTestSecret: Secret for test auth bypass
    ///   - sessionStoreService: Keychain service identifier
    ///   - resetSessionOnLaunch: Clear session at app start
    public init(
        name: String = "Debug",
        apiBaseURL: URL,
        passkeyAssociatedDomain: String = "api.ponti.io",
        passkeyRPID: String = "api.ponti.io",
        isAuthTestHookEnabled: Bool = false,
        authTestSecret: String? = nil,
        sessionStoreService: String = "io.hominem.apple.auth",
        resetSessionOnLaunch: Bool = false
    ) {
        self.name = name
        self.apiBaseURL = apiBaseURL
        self.passkeyAssociatedDomain = passkeyAssociatedDomain
        self.passkeyRPID = passkeyRPID
        self.isAuthTestHookEnabled = isAuthTestHookEnabled
        self.authTestSecret = authTestSecret
        self.sessionStoreService = sessionStoreService
        self.resetSessionOnLaunch = resetSessionOnLaunch
    }

    /// Load the current environment configuration from the app's runtime context
    /// This reads from Info.plist and environment variables
    /// - Parameters:
    ///   - processInfo: Access to environment variables (default: .processInfo)
    ///   - bundle: The app's bundle to read Info.plist from (default: .main)
    /// - Returns: Configured AppEnvironment for the current build
    public static func live(
        processInfo: ProcessInfo = .processInfo,
        bundle: Bundle = .main
    ) -> AppEnvironment {
        resolve(
            processEnvironment: processInfo.environment,
            bundleInfo: bundle.infoDictionary ?? [:]
        )
    }

    /// Resolve environment configuration from Info.plist and environment variables
    /// Priority order (highest to lowest):
    /// 1. Runtime environment variables (overrides all)
    /// 2. Info.plist values (build-time configuration)
    /// 3. Hardcoded defaults (fallback)
    /// - Parameters:
    ///   - processEnvironment: Environment variables available at runtime
    ///   - bundleInfo: Info.plist dictionary from the app bundle
    /// - Returns: Resolved AppEnvironment configuration
    static func resolve(
        processEnvironment: [String: String],
        bundleInfo: [String: Any]
    ) -> AppEnvironment {
        // MARK: API Base URL Resolution
        // Allows overriding API endpoint at runtime (useful for testing)
        // Follows a fallback chain: env var → plist → hardcoded default
        let defaultBaseURL = stringValue(for: "HOMINEM_API_BASE_URL", in: bundleInfo) ?? "http://localhost:4040"
        let rawBaseURL = processEnvironment["HOMINEM_API_BASE_URL"] ?? defaultBaseURL
        let fallbackURL = URL(string: defaultBaseURL) ?? URL(string: "http://localhost:4040")!
        let resolvedURL = URL(string: rawBaseURL) ?? fallbackURL

        // MARK: Environment Name
        // Identifies which build/environment this is (Debug, Release, Staging, etc.)
        let name = stringValue(for: "HOMINEM_APP_ENV", in: bundleInfo) ?? "Debug"

        // MARK: Passkey Configuration
        // Specifies the domain for passkey/WebAuthn operations
        // Must match your backend API domain and Apple's Associated Domains
        let passkeyAssociatedDomain = stringValue(for: "HOMINEM_ASSOCIATED_DOMAIN", in: bundleInfo) ?? "api.ponti.io"
        let passkeyRPID = stringValue(for: "HOMINEM_PASSKEY_RP_ID", in: bundleInfo) ?? passkeyAssociatedDomain

        // MARK: Test Mode Detection
        // E2E tests set HOMINEM_E2E_MODE to enable testing-specific behavior
        // This enables auth test hooks and resets session on each launch
        let isE2E = processEnvironment["HOMINEM_E2E_MODE"] == "1"

        // MARK: Auth Test Hook Configuration
        // In debug/test builds, allows bypassing passkey auth for easier testing
        // Enabled via Info.plist or E2E environment variable
        let isAuthTestHookEnabled = boolValue(for: "HOMINEM_ENABLE_AUTH_TEST_HOOK", in: bundleInfo) || isE2E

        // Extract and validate the auth test secret
        // Must be non-empty if test hook is enabled
        let rawSecret = processEnvironment["HOMINEM_AUTH_TEST_SECRET"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let authTestSecret: String?
        if isAuthTestHookEnabled, let rawSecret, rawSecret.isEmpty == false {
            authTestSecret = rawSecret
        } else {
            authTestSecret = nil
        }

        // MARK: Session Store Service
        // Keychain service identifier for credential storage
        // E2E tests use a separate service to avoid contaminating real credentials
        let sessionStoreService = isE2E ? "io.hominem.apple.auth.e2e" : "io.hominem.apple.auth"

        // Return the fully resolved environment configuration
        return AppEnvironment(
            name: name,
            apiBaseURL: resolvedURL,
            passkeyAssociatedDomain: passkeyAssociatedDomain,
            passkeyRPID: passkeyRPID,
            isAuthTestHookEnabled: isAuthTestHookEnabled,
            authTestSecret: authTestSecret,
            sessionStoreService: sessionStoreService,
            resetSessionOnLaunch: isE2E
        )
    }

    /// Extract a string value from Info.plist or environment
    /// Trims whitespace and handles missing values gracefully
    /// - Parameters:
    ///   - key: The configuration key to look up
    ///   - dictionary: The Info.plist dictionary to search
    /// - Returns: The trimmed string value, or nil if not found/empty
    private static func stringValue(for key: String, in dictionary: [String: Any]) -> String? {
        (dictionary[key] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Extract a boolean value from Info.plist
    /// Handles multiple input types: Bool, String ("YES"/"NO"/"true"/"false"), NSNumber
    /// This flexibility is needed because Info.plist can store values in different formats
    /// - Parameters:
    ///   - key: The configuration key to look up
    ///   - dictionary: The Info.plist dictionary to search
    /// - Returns: The boolean value, or false if not found
    private static func boolValue(for key: String, in dictionary: [String: Any]) -> Bool {
        // First, try to read as native Bool
        if let value = dictionary[key] as? Bool {
            return value
        }

        // Try to read as String ("YES", "NO", "true", "false", etc.)
        // NSString.boolValue understands most common boolean string representations
        if let value = dictionary[key] as? String {
            return NSString(string: value).boolValue
        }

        // Try to read as NSNumber (can be converted to Bool)
        if let value = dictionary[key] as? NSNumber {
            return value.boolValue
        }

        // Default to false if key is missing or value can't be converted
        return false
    }
}
