# Journal

- 2026-04-18T06:24:23Z: Created work item `settings-account-and-passkey-management`.
- 2026-04-18T11:00:00Z: Implemented settings account and passkey management.
  - `PasskeyManagementService` (`Services/Settings/PasskeyManagementService.swift`): list (`GET /api/auth/passkey/list-user-passkeys`), add (full WebAuthn registration ceremony via `ASAuthorizationPlatformPublicKeyCredentialProvider.createCredentialRegistrationRequest` → `POST /api/auth/passkey/verify-registration`), delete (`POST /api/auth/passkey/delete-passkey`). Uses same `PasskeyRegistrationSession` delegate pattern as sign-in.
  - `SettingsScreen` (`Screens/Settings/SettingsScreen.swift`): replaces Phase 1 Navigation/ placeholder. Sections: Account (inline name editor with save, email display), Privacy (AppLock + screenshot toggles), Chats (NavigationLink to ArchivedChatsScreen), Passkeys (list + add + delete with confirmation), DangerZone (sign out confirmation dialog, delete account stub).
  - Removed old `Navigation/SettingsScreen.swift` Phase 1 placeholder.
  - Build verified: `BUILD SUCCEEDED`.
  - Follow-up: passkey add flow requires associated-domains entitlement (webcredentials) already present in project.yml.
