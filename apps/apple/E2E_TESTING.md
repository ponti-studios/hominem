# E2E Testing Guide for Apple Apps (iOS & macOS)

This document explains how to run end-to-end (E2E) tests for the iOS and macOS applications.

## Overview

The E2E tests verify complete user workflows:
- ✅ User authentication (email OTP)
- ✅ Note creation, viewing, and archiving
- ✅ Chat messaging
- ✅ Settings and account management
- ✅ Sign out and session persistence
- ✅ Navigation between app sections
- ✅ Error handling

Tests are written in **XCUITest** (Apple's native UI testing framework) and test the compiled app through its UI.

## Architecture

```
apps/apple/
├── iosUITests/
│   └── HominemAppleiOSE2ETests.swift    (iOS tests)
├── macOSUITests/
│   └── HominemAppleMacE2ETests.swift    (macOS tests - enhanced)
└── HominemApple.xcodeproj              (Xcode project)
```

## Prerequisites

### Software
- **Xcode** 15.0 or later
- **macOS** 14.0 or later
- **Swift** 6.0 or later
- **Backend API server** running and accessible

### Backend Setup
- API running at `http://localhost:4040` (or configure custom URL)
- Auth test hook enabled (via `HOMINEM_ENABLE_AUTH_TEST_HOOK=YES` in config)
- E2E mode configured with `HOMINEM_E2E_MODE=1`

### Configuration Files

#### Info.plist Configuration
Ensure your app's Info.plist has:
```xml
<key>HOMINEM_ENABLE_AUTH_TEST_HOOK</key>
<true/>
<key>HOMINEM_API_BASE_URL</key>
<string>http://localhost:4040</string>
<key>HOMINEM_APP_ENV</key>
<string>Debug</string>
```

#### Build Configuration (Info.plist or xcconfig)
```
HOMINEM_API_BASE_URL = http://localhost:4040
HOMINEM_ENABLE_AUTH_TEST_HOOK = YES
HOMINEM_APP_ENV = Debug
```

## Running Tests

### Prerequisites: Set Environment Variables

Tests require these environment variables:

```bash
# Required: Auth test secret for E2E tests
export HOMINEM_E2E_AUTH_TEST_SECRET="your-test-secret-here"

# Optional: Custom API URL (defaults to http://localhost:4040)
export HOMINEM_E2E_API_BASE_URL="http://localhost:4040"
```

### Running iOS Tests

#### Via Xcode UI
1. Open `HominemApple.xcodeproj` in Xcode
2. Set environment variables in Xcode:
   - Product → Scheme → Edit Scheme
   - Test → Pre-actions
   - Add environment variable: `HOMINEM_E2E_AUTH_TEST_SECRET=your-secret`
3. Select iOS simulator (e.g., iPhone 15)
4. Product → Test (or ⌘U)

#### Via Command Line
```bash
# Set environment variables
export HOMINEM_E2E_AUTH_TEST_SECRET="your-test-secret"
export HOMINEM_E2E_API_BASE_URL="http://localhost:4040"

# Run all iOS E2E tests
xcodebuild test \
  -project "apps/apple/HominemApple.xcodeproj" \
  -scheme "HominemApple" \
  -configuration Debug \
  -destination "platform=iOS Simulator,name=iPhone 15" \
  -derivedDataPath ".build/xcode-build" \
  TEST_TARGET_NAME="HominemAppleiOSE2ETests"

# Run specific test method
xcodebuild test \
  -project "apps/apple/HominemApple.xcodeproj" \
  -scheme "HominemApple" \
  -configuration Debug \
  -destination "platform=iOS Simulator,name=iPhone 15" \
  -only-testing "HominemAppleiOSE2ETests/HominemAppleiOSE2ETests/testEmailOTPAuthFlow"
```

### Running macOS Tests

#### Via Xcode UI
1. Open `HominemApple.xcodeproj` in Xcode
2. Set environment variables in Xcode:
   - Product → Scheme → Edit Scheme
   - Test → Pre-actions
   - Add environment variable: `HOMINEM_E2E_AUTH_TEST_SECRET=your-secret`
3. Select macOS destination
4. Product → Test (or ⌘U)

#### Via Command Line
```bash
# Set environment variables
export HOMINEM_E2E_AUTH_TEST_SECRET="your-test-secret"
export HOMINEM_E2E_API_BASE_URL="http://localhost:4040"

# Run all macOS E2E tests
xcodebuild test \
  -project "apps/apple/HominemApple.xcodeproj" \
  -scheme "HominemApple" \
  -configuration Debug \
  -destination "platform=macOS" \
  -derivedDataPath ".build/xcode-build" \
  TEST_TARGET_NAME="HominemAppleMacE2ETests"

# Run specific test method
xcodebuild test \
  -project "apps/apple/HominemApple.xcodeproj" \
  -scheme "HominemApple" \
  -configuration Debug \
  -destination "platform=macOS" \
  -only-testing "HominemAppleMacE2ETests/HominemAppleMacE2ETests/testCoreSignedInWorkflow"
```

## Test Coverage

### iOS Tests (`HominemAppleiOSE2ETests.swift`)

**Authentication Tests:**
- `testEmailOTPAuthFlow` - Complete email OTP sign-in
- `testSignOutFlow` - Sign out and return to sign-in
- `testMissingEnvironmentFails` - Proper error handling for missing config

**Notes Tests:**
- `testNoteCreationFlow` - Create note with title and content
- `testNoteDetailFlow` - View and edit note details

**Chats Tests:**
- `testChatMessageFlow` - Send and receive messages
- `testNewChatCreation` - Start new chat session

**Navigation Tests:**
- `testTabNavigation` - Navigate between app tabs (Notes, Chats, Feed, Account)
- `testSettingsNavigation` - Access settings/account screen

**Integration Tests:**
- `testCoreSignedInWorkflow` - Full workflow: sign-in → create note → send chat → settings → sign-out

**Total: 12 test methods**

### macOS Tests (`HominemAppleMacE2ETests.swift`)

**Original Tests:**
- `testEmailOTPAuthFlow` - Email OTP authentication
- `testCoreSignedInWorkflow` - Complete user workflow
- `testMissingEnvironmentFails` - Environment validation

**Enhanced Tests:**
- `testNoteCreation` - Note creation and verification
- `testNoteDetailView` - Note detail view and editing
- `testNoteArchiving` - Archive notes functionality
- `testChatMessageSending` - Chat message operations
- `testMultipleChatSessions` - Multiple chat sessions
- `testMainNavigation` - Section navigation
- `testSettingsAndAccount` - Settings access
- `testSessionPersistence` - Session persistence across app restart
- `testNetworkErrorHandling` - Graceful network error handling

**Total: 14 test methods**

## Test Execution Flow

### Typical Test Flow
1. App launched with test environment configuration
2. E2E mode enabled (triggers reset of session on launch)
3. Sign-in with dynamically generated test email (includes UUID)
4. Navigate to app features (notes, chats, etc.)
5. Verify functionality works as expected
6. Clean up (sign out, optional: delete test data)

### Environment Variables Set Per Test
Each test instance receives:
- `HOMINEM_E2E_MODE=1` - Enables E2E-specific behavior
- `HOMINEM_API_BASE_URL` - API endpoint to test against
- `HOMINEM_AUTH_TEST_SECRET` - Secret for test auth hook
- Session reset on launch - Ensures clean state for each test

### Unique Test Identities
- Test emails include UUID to avoid conflicts
- Example: `otp-ios-e2e-a1b2c3d4-e5f6-4ghi@hominem.test`
- Prevents test data contamination between runs

## Expected Behaviors

### Timeouts
- App launch: 20 seconds
- UI element appearance: 10-20 seconds (varies by operation)
- Network operations: 10 seconds
- After sign-in: 5-10 seconds for UI to stabilize

### Success Criteria
- No exceptions thrown (except XCTSkip for missing config)
- All assertions pass
- Expected UI elements appear within timeout
- Sign-out returns to sign-in screen

### Failure Modes
- `XCTSkip` - Missing required environment variables
- `XCTAssertThrowsError` - Unexpected errors
- Timeout - Element didn't appear within timeout period
- Assertion failure - UI doesn't match expected state

## Debugging Failed Tests

### Enable Detailed Logging
In Xcode:
1. Product → Scheme → Edit Scheme
2. Test → Pre-actions or Post-actions
3. Add logging commands

### Common Issues

#### "Send code button not found"
- ❌ App not launching properly
- ✅ Check: API URL accessible, app builds without errors
- ✅ Check: Info.plist has correct configuration

#### "Timeout waiting for element"
- ❌ Element hasn't rendered yet
- ✅ Increase timeout in test (be reasonable, max 30 seconds)
- ✅ Check: Network latency, backend responsiveness

#### "Auth test secret not set"
- ❌ Environment variable not passed to test
- ✅ Set: `export HOMINEM_E2E_AUTH_TEST_SECRET="..."`
- ✅ Verify in Xcode scheme settings

#### "Database connection error"
- ❌ Local database can't be created
- ✅ Check: Write permissions in test sandbox
- ✅ Check: GRDB library properly linked

### Debugging Commands

```bash
# Run with verbose output
xcodebuild test \
  -project "apps/apple/HominemApple.xcodeproj" \
  -scheme "HominemApple" \
  -verbose \
  -showBuildTimingSummary

# Run tests with result bundle (for analysis)
xcodebuild test \
  -project "apps/apple/HominemApple.xcodeproj" \
  -scheme "HominemApple" \
  -resultBundlePath "TestResults.xcresult"

# Open result bundle in Xcode
open "TestResults.xcresult"
```

## Performance Expectations

### Typical Test Execution Times

**Per Test Method:**
- Simple auth test: 30-45 seconds
- Note creation: 20-30 seconds
- Chat message: 25-35 seconds
- Full workflow: 90-120 seconds

**Full Test Suite:**
- iOS (12 tests): 8-12 minutes
- macOS (14 tests): 10-15 minutes
- Both: 18-27 minutes

Factors affecting duration:
- Network latency to backend
- Simulator/app startup time
- System load
- Timeout wait times

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Xcode
        run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
      
      - name: Run iOS E2E Tests
        env:
          HOMINEM_E2E_AUTH_TEST_SECRET: ${{ secrets.E2E_AUTH_SECRET }}
          HOMINEM_E2E_API_BASE_URL: http://localhost:4040
        run: |
          xcodebuild test \
            -project "apps/apple/HominemApple.xcodeproj" \
            -scheme "HominemApple" \
            -configuration Debug \
            -destination "platform=iOS Simulator,name=iPhone 15"
      
      - name: Run macOS E2E Tests
        env:
          HOMINEM_E2E_AUTH_TEST_SECRET: ${{ secrets.E2E_AUTH_SECRET }}
        run: |
          xcodebuild test \
            -project "apps/apple/HominemApple.xcodeproj" \
            -scheme "HominemApple" \
            -configuration Debug \
            -destination "platform=macOS"
```

### Environment Secrets
Store in GitHub repository settings:
- `E2E_AUTH_SECRET` - HOMINEM_E2E_AUTH_TEST_SECRET value

## Best Practices

### Writing New Tests

1. **Use descriptive names:**
   ```swift
   func testUserCanCreateNoteWithTitleAndContent() { ... }
   ```

2. **Test one thing per test:**
   - Good: `testNoteCreation`
   - Bad: `testNoteCreationAndDeletion` (two things)

3. **Use helpers for common flows:**
   ```swift
   try signIn(app: app, email: email)
   ```

4. **Wait for elements explicitly:**
   ```swift
   XCTAssertTrue(element.waitForExistence(timeout: 20))
   ```

5. **Clean up after tests:**
   - Sign out at the end
   - Close dialogs/sheets
   - Reset state for next test

### Accessibility Identifiers

Mark UI elements with accessibility identifiers for testing:
```swift
.accessibilityIdentifier("sendButton")
// Then find in test:
let sendButton = app.buttons["sendButton"]
```

### Handling Flaky Tests

If tests fail intermittently:
1. Increase timeouts (max 30 seconds)
2. Add explicit waits for UI state
3. Use retry logic with XCTWaiter
4. Check for race conditions

## Troubleshooting

### "No such module 'HominemAppleCore'"
- ❌ Test target doesn't link framework
- ✅ In Xcode: Target → Build Phases → Link Binary With Libraries
- ✅ Add HominemAppleCore framework

### "App crashes on launch"
- ❌ Missing dependencies
- ✅ Check: Build succeeds, no linker errors
- ✅ Check: All required frameworks linked

### "Test times out consistently"
- ❌ Slow network or unresponsive backend
- ✅ Check: Backend responding to requests
- ✅ Check: Network latency (ping localhost)
- ✅ Increase timeouts if needed

## Support

For issues or questions:
1. Check console output for error details
2. Run with `-verbose` for more logging
3. Check backend logs for API errors
4. Review Recent Runs in Xcode for crash reports

## Future Enhancements

Planned improvements:
- [ ] Visual regression testing
- [ ] Performance benchmarking
- [ ] Load testing with multiple users
- [ ] Accessibility compliance testing
- [ ] Offline functionality testing
- [ ] Cross-version compatibility testing
