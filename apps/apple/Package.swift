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
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.29.0"),
    ],
    targets: [
        .target(
            name: "HominemAppleCore",
            dependencies: [
                .product(name: "GRDB", package: "GRDB.swift"),
            ]
        ),
        .testTarget(
            name: "HominemAppleCoreTests",
            dependencies: [
                "HominemAppleCore",
                .product(name: "GRDB", package: "GRDB.swift"),
            ]
        ),
    ]
)
