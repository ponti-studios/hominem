// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "OnDeviceAI",
  platforms: [.macOS(.v15)],
  products: [
    .library(name: "CalendarAssistantCore", targets: ["CalendarAssistantCore"]),
  ],
  targets: [
    .target(name: "CalendarAssistantCore", path: "ios/Core"),
    .testTarget(
      name: "CalendarAssistantCoreTests",
      dependencies: ["CalendarAssistantCore"],
      path: "Tests/CalendarAssistantCoreTests"
    ),
  ]
)
