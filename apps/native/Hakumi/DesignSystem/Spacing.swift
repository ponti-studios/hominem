import CoreFoundation

// Source: packages/platform/ui/src/tokens/spacing.ts
// 8px primary grid, 4px secondary grid.

enum Spacing {
    // Named scale
    static let step1: CGFloat = 4
    static let step2: CGFloat = 8
    static let step3: CGFloat = 12
    static let step4: CGFloat = 16
    static let step5: CGFloat = 24
    static let step6: CGFloat = 32
    static let step7: CGFloat = 48
    static let step8: CGFloat = 64

    // Semantic aliases (match mobile theme naming)
    static let xs:  CGFloat = 4
    static let sm:  CGFloat = 8
    static let sm2: CGFloat = 12
    static let md:  CGFloat = 16
    static let lg:  CGFloat = 24
    static let xl:  CGFloat = 32
    static let xl2: CGFloat = 48
    static let xl3: CGFloat = 64
}
