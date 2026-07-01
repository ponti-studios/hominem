# Omiro Mobile Naming

Canonical product terms for `apps/omiro`:

- `inbox`: the signed-in root surface and mixed recent list
- `chat`: a conversation
- `note`: a saved note
- `composer`: the input surface used to create notes or start chats
- `settings`: account and app settings
- `archived chats`: archived conversation list

Implementation rules:

- Do not use `workspace` as a product or module concept.
- Do not use `feed` as an active app concept.
- Reserve `session` for auth only.
- Avoid `artifact` in app-owned exports and feature names.
- When code needs a shared `chat | note` union, prefer a small explicit type such as
  `ContentKind` or `ResumeTarget`.
