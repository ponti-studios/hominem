import Foundation
import Testing
@testable import HominemAppleCore

struct AppEnvironmentTests {
    @Test
    func resolveUsesBundleConfigurationByDefault() {
        let environment = AppEnvironment.resolve(
            processEnvironment: [:],
            bundleInfo: [
                "HOMINEM_APP_ENV": "Release",
                "HOMINEM_API_BASE_URL": "https://api.ponti.io",
                "HOMINEM_ASSOCIATED_DOMAIN": "api.ponti.io",
                "HOMINEM_PASSKEY_RP_ID": "api.ponti.io",
                "HOMINEM_ENABLE_AUTH_TEST_HOOK": false,
            ]
        )

        #expect(environment.name == "Release")
        #expect(environment.apiBaseURL == URL(string: "https://api.ponti.io")!)
        #expect(environment.passkeyAssociatedDomain == "api.ponti.io")
        #expect(environment.passkeyRPID == "api.ponti.io")
        #expect(environment.isAuthTestHookEnabled == false)
        #expect(environment.authTestSecret == nil)
    }

    @Test
    func resolveAllowsProcessOverrideForBaseURL() {
        let environment = AppEnvironment.resolve(
            processEnvironment: [
                "HOMINEM_API_BASE_URL": "https://override.ponti.io",
            ],
            bundleInfo: [
                "HOMINEM_API_BASE_URL": "https://api.ponti.io",
            ]
        )

        #expect(environment.apiBaseURL == URL(string: "https://override.ponti.io")!)
    }

    @Test
    func resolveOnlyEnablesAuthTestHookForInternalBuilds() {
        let lockedEnvironment = AppEnvironment.resolve(
            processEnvironment: [
                "HOMINEM_AUTH_TEST_SECRET": "otp-secret",
            ],
            bundleInfo: [
                "HOMINEM_ENABLE_AUTH_TEST_HOOK": false,
            ]
        )

        let internalEnvironment = AppEnvironment.resolve(
            processEnvironment: [
                "HOMINEM_AUTH_TEST_SECRET": "otp-secret",
            ],
            bundleInfo: [
                "HOMINEM_ENABLE_AUTH_TEST_HOOK": true,
            ]
        )

        #expect(lockedEnvironment.authTestSecret == nil)
        #expect(internalEnvironment.authTestSecret == "otp-secret")
    }

    @Test
    func resolveEnablesAuthTestHookForE2EIsolation() {
        let environment = AppEnvironment.resolve(
            processEnvironment: [
                "HOMINEM_E2E_MODE": "1",
                "HOMINEM_AUTH_TEST_SECRET": "otp-secret",
            ],
            bundleInfo: [
                "HOMINEM_ENABLE_AUTH_TEST_HOOK": false,
            ]
        )

        #expect(environment.isAuthTestHookEnabled == true)
        #expect(environment.authTestSecret == "otp-secret")
        #expect(environment.sessionStoreService == "io.hominem.apple.auth.e2e")
        #expect(environment.resetSessionOnLaunch == true)
    }
}
