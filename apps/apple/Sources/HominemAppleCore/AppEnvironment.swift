import Foundation

public struct AppEnvironment: Equatable, Sendable {
    public let name: String
    public let apiBaseURL: URL
    public let passkeyAssociatedDomain: String
    public let passkeyRPID: String
    public let isAuthTestHookEnabled: Bool
    public let authTestSecret: String?
    public let sessionStoreService: String
    public let resetSessionOnLaunch: Bool

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

    public static func live(
        processInfo: ProcessInfo = .processInfo,
        bundle: Bundle = .main
    ) -> AppEnvironment {
        resolve(
            processEnvironment: processInfo.environment,
            bundleInfo: bundle.infoDictionary ?? [:]
        )
    }

    static func resolve(
        processEnvironment: [String: String],
        bundleInfo: [String: Any]
    ) -> AppEnvironment {
        let defaultBaseURL = stringValue(for: "HOMINEM_API_BASE_URL", in: bundleInfo) ?? "http://localhost:4040"
        let rawBaseURL = processEnvironment["HOMINEM_API_BASE_URL"] ?? defaultBaseURL
        let fallbackURL = URL(string: defaultBaseURL) ?? URL(string: "http://localhost:4040")!
        let resolvedURL = URL(string: rawBaseURL) ?? fallbackURL
        let name = stringValue(for: "HOMINEM_APP_ENV", in: bundleInfo) ?? "Debug"
        let passkeyAssociatedDomain = stringValue(for: "HOMINEM_ASSOCIATED_DOMAIN", in: bundleInfo) ?? "api.ponti.io"
        let passkeyRPID = stringValue(for: "HOMINEM_PASSKEY_RP_ID", in: bundleInfo) ?? passkeyAssociatedDomain
        let isE2E = processEnvironment["HOMINEM_E2E_MODE"] == "1"
        let isAuthTestHookEnabled = boolValue(for: "HOMINEM_ENABLE_AUTH_TEST_HOOK", in: bundleInfo) || isE2E
        let rawSecret = processEnvironment["HOMINEM_AUTH_TEST_SECRET"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let authTestSecret: String?
        if isAuthTestHookEnabled, let rawSecret, rawSecret.isEmpty == false {
            authTestSecret = rawSecret
        } else {
            authTestSecret = nil
        }
        let sessionStoreService = isE2E ? "io.hominem.apple.auth.e2e" : "io.hominem.apple.auth"

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

    private static func stringValue(for key: String, in dictionary: [String: Any]) -> String? {
        (dictionary[key] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func boolValue(for key: String, in dictionary: [String: Any]) -> Bool {
        if let value = dictionary[key] as? Bool {
            return value
        }

        if let value = dictionary[key] as? String {
            return NSString(string: value).boolValue
        }

        if let value = dictionary[key] as? NSNumber {
            return value.boolValue
        }

        return false
    }
}
