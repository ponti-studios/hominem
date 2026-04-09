# Hominem Apple — developer convenience targets
#
# Usage:
#   make gen            — regenerate Xcode project from project.yml
#   make test-ios       — build + test on iPhone 17 Pro simulator
#   make test-macos     — build + test macOS (unit tests)
#   make test-e2e       — run macOS UI test (requires live API)
#   make test-all       — unit tests on both platforms
#   make clean          — remove DerivedData for this project

SCHEME_IOS  := HominemAppleiOS
SCHEME_MAC  := HominemAppleMac
DEST_IOS    := platform=iOS Simulator,name=iPhone 17 Pro
DEST_MAC    := platform=macOS
CONFIG      := Debug
PROJECT     := HominemApple.xcodeproj

.PHONY: gen test-ios test-macos test-e2e test-all clean

gen:
	xcodegen generate --spec project.yml

test-ios: gen
	xcodebuild \
	  -project $(PROJECT) \
	  -scheme $(SCHEME_IOS) \
	  -configuration $(CONFIG) \
	  -destination "$(DEST_IOS)" \
	  -only-testing:HominemAppleiOSTests \
	  test | xcpretty

test-macos: gen
	xcodebuild \
	  -project $(PROJECT) \
	  -scheme $(SCHEME_MAC) \
	  -configuration $(CONFIG) \
	  -destination "$(DEST_MAC)" \
	  -only-testing:HominemAppleMacCoreTests \
	  test | xcpretty

test-e2e: gen
	xcodebuild \
	  -project $(PROJECT) \
	  -scheme $(SCHEME_MAC) \
	  -configuration $(CONFIG) \
	  -destination "$(DEST_MAC)" \
	  -only-testing:HominemAppleMacE2E \
	  test | xcpretty

test-all: test-ios test-macos

clean:
	xcodebuild \
	  -project $(PROJECT) \
	  -scheme $(SCHEME_IOS) \
	  clean
	xcodebuild \
	  -project $(PROJECT) \
	  -scheme $(SCHEME_MAC) \
	  clean
