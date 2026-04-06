// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "HominemAppleCore",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "HominemAppleCore",
            targets: ["HominemAppleCore"]
        ),
    ],
    targets: [
        .target(
            name: "HominemAppleCore"
        ),
        .testTarget(
            name: "HominemAppleCoreTests",
            dependencies: ["HominemAppleCore"]
        ),
    ]
)
