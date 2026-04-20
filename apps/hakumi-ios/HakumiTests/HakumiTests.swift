import Foundation
import Testing

@testable import Hakumi

struct HakumiTests {
    @Test func base64URLRoundTrip() {
        let data = Data([0xde, 0xad, 0xbe, 0xef])
        let encoded = data.base64URLEncodedString()

        #expect(Data(base64URLEncoded: encoded) == data)
    }

    @Test func deepLinkParserHandlesCustomSchemeHosts() {
        let url = URL(string: "hakumi://notes/abc123")!

        #expect(DeepLinkParser.parse(url) == .noteDetail(id: "abc123"))
    }

    @Test func deepLinkParserHandlesUniversalLinks() {
        let url = URL(string: "https://hakumi.app/settings/archived-chats")!

        #expect(DeepLinkParser.parse(url) == .archivedChats)
    }

    @MainActor
    @Test func topAnchorSignalRequestsAndConsumesReveal() {
        let signal = TopAnchorSignal()

        #expect(signal.hasPendingReveal == false)

        signal.request()

        #expect(signal.hasPendingReveal)

        signal.markHandled()

        #expect(signal.hasPendingReveal == false)
    }

    @MainActor
    @Test func topAnchorSignalOnlyHandlesPendingRequests() {
        let signal = TopAnchorSignal()

        signal.markHandled()
        #expect(signal.hasPendingReveal == false)

        signal.request()
        signal.request()

        #expect(signal.hasPendingReveal)

        signal.markHandled()

        #expect(signal.hasPendingReveal == false)
    }

    @MainActor
    @Test func routerBuffersDeepLinksWhileBootingAndFlushesAfterAuthentication() async {
        let router = Router()
        let url = URL(string: "hakumi://chat/thread-123")!

        router.handle(url: url)

        #expect(router.authPhase == .booting)
        #expect(router.selectedTab == .inbox)
        #expect(router.protectedPath.isEmpty)

        AuthProvider.shared.completeSignIn(user: AuthUser(id: "user-1", email: "user@example.com", name: "User"))
        router.completeAuthentication()

        #expect(router.authPhase == .authenticated)
        #expect(router.selectedTab == .inbox)
        #expect(router.protectedPath == [.chat(id: "thread-123")])

        await AuthProvider.shared.signOut()
    }

    @MainActor
    @Test func routerDoesNotBypassAuthenticationForProtectedRoutes() async {
        let router = Router()
        router.authPhase = .unauthenticated
        router.selectedTab = .settings

        router.navigate(to: .noteDetail(id: "note-1"))

        #expect(router.authPhase == .unauthenticated)
        #expect(router.selectedTab == .settings)
        #expect(router.notesPath.isEmpty)
        #expect(router.authPath.isEmpty)

        await AuthProvider.shared.signOut()
    }

    @MainActor
    @Test func routerResetForSignOutClearsNavigationState() {
        let router = Router()
        router.authPhase = .authenticated
        router.authPath = [.verifyOTP(email: "user@example.com")]
        router.protectedPath = [.chat(id: "thread-1")]
        router.notesPath = [.noteDetail(id: "note-1")]
        router.settingsPath = [.archivedChats]
        router.selectedTab = .settings

        router.resetForSignOut()

        #expect(router.authPhase == .unauthenticated)
        #expect(router.authPath.isEmpty)
        #expect(router.protectedPath.isEmpty)
        #expect(router.notesPath.isEmpty)
        #expect(router.settingsPath.isEmpty)
        #expect(router.selectedTab == .inbox)
    }

    @Test func authServiceUsesExpectedOtpEndpoints() {
        #expect(AuthService.sendOTPPath == "/api/auth/email-otp/send-verification-otp")
        #expect(AuthService.verifyOTPPath == "/api/auth/sign-in/email-otp")
        // Verify path structure without hardcoding the host (varies by build config).
        let sendURL = AuthService.apiURL(AuthService.sendOTPPath)
        #expect(sendURL.path == "/api/auth/email-otp/send-verification-otp")
        #expect(sendURL.host != nil)
    }

    @Test func passkeyAuthenticationResponseEncodesWebAuthnShape() throws {
        let credentialID = Data([0x01, 0x02, 0x03])
        let clientDataJSON = Data([0x04, 0x05, 0x06])
        let authenticatorData = Data([0x07, 0x08, 0x09])
        let signature = Data([0x0a, 0x0b, 0x0c])

        let response = PasskeyAuthenticationResponse(
            credentialID: credentialID,
            clientDataJSON: clientDataJSON,
            authenticatorData: authenticatorData,
            signature: signature
        )

        let encoded = try JSONEncoder().encode(response)
        let json = try JSONSerialization.jsonObject(with: encoded) as? [String: Any]

        #expect(json?["type"] as? String == "public-key")
        #expect(json?["id"] as? String == credentialID.base64URLEncodedString())
        #expect(json?["rawId"] as? String == credentialID.base64URLEncodedString())

        let payload = json?["response"] as? [String: Any]
        #expect(payload?["clientDataJSON"] as? String == clientDataJSON.base64URLEncodedString())
        #expect(payload?["authenticatorData"] as? String == authenticatorData.base64URLEncodedString())
        #expect(payload?["signature"] as? String == signature.base64URLEncodedString())
    }
}
