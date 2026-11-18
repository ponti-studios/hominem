# Omiro system integrations

How Omiro shows up in the rest of iOS: system search, the Home Screen, Siri,
notifications and the share sheet. Everything here runs on the device; none of
it sends content anywhere new.

The native side lives in two local Expo modules: `modules/omiro-system`
(Spotlight, quick actions, text recognition, PDF) and `modules/omiro-intents`
(App Intents). JavaScript entry points are under `apps/omiro/services/system/`.

## Deep links from the system

Quick actions and Spotlight results arrive in native code as app paths
(`chat/<id>`, `notes/<id>`, `task/add`), not URLs. `useSystemLinks` (mounted in
the protected shell, after sign-in and the app lock) reads the one that
launched the app and listens for later ones, then routes them through
`redirectSystemPath` in `app/+native-intent.ts`, the same rewrite every other
deep link gets. A link never opens content behind the app lock.

## Spotlight

- Chats and notes that have appeared in the Chat or Notes tab are indexed in
  the device's Spotlight index (title, plus the preview as the description).
  Tapping a result opens that chat or note.
- Archiving a chat or deleting a note removes it from the index in the same
  step. Signing out clears the whole index (`clearLocalSessionState`).
- The index is on-device. Tasks are not indexed.

## Home Screen quick actions

Long-pressing the app icon offers New Chat, New Note and New Task. They are
static (`UIApplicationShortcutItems` in `app.config.js`); the type-to-path map
is `OmiroSystemPath.quickActions` in Swift. Keep the two in step.

## Siri and Shortcuts

| Intent     | Asks for    | Opens                                         |
| ---------- | ----------- | --------------------------------------------- |
| Add a Note | nothing     | Notes tab                                     |
| Start Chat | nothing     | New chat                                      |
| Ask Omiro  | a question  | New chat seeded with the question             |
| Add a Task | a task name | Tasks tab, composer focused with the name in it |

Ask Omiro and Add a Task only fill the composer. The person still sends the
message or adds the task: nothing is created or sent to the model from Siri.

## Search in the Chat and Notes tabs

Each tab has the system search field in its navigation bar. It filters that
tab's rows by title and preview (every word must match, any order, any case)
and keeps loading older pages while a search is active, so it covers
everything, not only what was already on screen. It does not search inside
chat messages; that is the in-chat search.

## Row previews and menus

Pressing and holding a chat or note row peeks at the screen and offers Share
and the row's own action (Archive for a chat, Delete for a note). Rows open
with the system zoom transition.

## Task reminder buttons

A task reminder notification carries two buttons, handled without opening the
app (`reminder-actions.ts`):

- **Done** completes the task.
- **In an hour** moves it an hour on from now. A time block keeps its length.

Both write to the local task database; sync and rescheduling follow from the
change. A reminder for a task that is already done, deleted or gone is ignored.

## Morning brief

Off by default; a switch in Settings. When on, a notification at 8:00 names how
many tasks the day has and the first three ("3 tasks today", then "Standup,
Call bank, Dentist"). A day with no tasks gets no notification. Only the next three
mornings are scheduled, because iOS keeps 64 pending local notifications and
task reminders use up to 60. Turning it on asks for notification permission; a
refusal leaves the switch off.

## Scan Text from Photo

The composer's attach menu can read the text out of a photo from the library
(Vision, on-device) and add it to the draft as a new paragraph. The photo
itself is not attached or uploaded.

## Export as PDF

A note's menu exports it as a PDF (title as the heading, markdown rendered
beneath) and hands the file to the share sheet. The PDF is rendered on-device
into the caches directory. Raw HTML in a note is not interpreted.

## Appearance

Settings can pin the app to light or dark, or follow the system (default). The
choice is stored on the device and applied before the first frame.
