import SwiftUI

// Source: packages/platform/ui/src/tokens/motion.ts
// Easing maps: enter → easeOut, exit → easeIn, standard → easeInOut

enum Motion {

    // MARK: Durations
    static let enterDuration:   TimeInterval = 0.150
    static let exitDuration:    TimeInterval = 0.120
    static let standardDuration: TimeInterval = 0.120
    static let breezyDuration:  TimeInterval = 1.800
    static let spinDuration:    TimeInterval = 1.200

    // MARK: Translate distances (points)
    static let enterY: CGFloat = 6
    static let exitY:  CGFloat = 4
    static let enterX: CGFloat = 6
    static let exitX:  CGFloat = 4

    // MARK: Animation presets
    static var enter:    Animation { .easeOut(duration: enterDuration) }
    static var exit:     Animation { .easeIn(duration: exitDuration) }
    static var standard: Animation { .easeInOut(duration: standardDuration) }
    static var breezy:   Animation { .easeInOut(duration: breezyDuration).repeatForever(autoreverses: true) }
    static var spin:     Animation { .linear(duration: spinDuration).repeatForever(autoreverses: false) }
}
