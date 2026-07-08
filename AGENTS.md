## Rules

- Follow YAGNI (You Aren't Gonna Need It) principle and one-liner solutions whenever possible.
<<<<<<< HEAD
=======
- Never commit code. The user must review and commit the changes themselves.
>>>>>>> origin/main
- `apps/omiro` should only support Apple devices. Do not add fallbacks for other platforms such as Android.

## Testing the omiro app (iOS Simulator)

Use **Maestro** for programmatic UI testing of `apps/omiro`. The app is installed on the booted simulator as `com.pontistudios.hakumi.dev`.

**Prerequisites — Java 17 must be on PATH before running Maestro:**

```bash
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
```

**Launch the app:**

```bash
xcrun simctl launch booted com.pontistudios.hakumi.dev
```

**Take a screenshot:**

```bash
xcrun simctl io booted screenshot /tmp/omiro_screen.png
```

**Run a Maestro flow:**

```bash
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH" && export JAVA_HOME="/opt/homebrew/opt/openjdk@17" && maestro test my_flow.yaml
```

**Maestro flow skeleton:**

```yaml
appId: com.pontistudios.hakumi.dev
---
- launchApp
- assertVisible: 'Omiro'
- tapOn:
    id: 'feed-composer-input' # use testID values from source
- inputText: 'some text'
- takeScreenshot: /tmp/omiro_step
```

Tap targets use the React Native `testID` prop. Key IDs already in the codebase:

- `feed-composer` — the composer shell on the home screen
- `feed-composer-input` — the text input inside the home composer
- `chat-composer` / `chat-composer-input` — same for the chat detail screen

The booted simulator is iPhone 17 Pro (UDID `BD390792-D3EC-4351-BE57-EAF642FABD34`).

**Known issue — always tap by `id`, not by fuzzy text:** iOS's accessibility tree merges all children of a screen (e.g. a bottom sheet) into a single node whenever no text field currently has focus. When that happens, `tapOn: text: '...'` (or the Maestro MCP `tap_on` tool's `text` param) resolves to the center point of that merged node's bounds — which is often the modal backdrop, not the element you meant — and silently dismisses the sheet instead of tapping the target. Tapping by `id` (i.e. the element's `testID`) works reliably regardless of focus state and does not suffer from this merging. Prefer `id` selectors over `text` selectors for anything inside a modal/sheet.

## code style

- if a function only calls a function use `() => <function name>(<args>)` style instead of unnecessary curly braces.
