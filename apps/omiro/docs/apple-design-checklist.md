# Omiro Apple design checklist

A working checklist for auditing Omiro screens against Apple's Human Interface Guidelines
(iOS 26 era: Liquid Glass, SF type, large titles, system motion). Each item is pass, fail, or n/a
with a screenshot as evidence.

## Layout and type
- [ ] Large title on top-level tabs, with the standard back and trailing toolbar placement
- [ ] Uses SF / system type scale with Dynamic Type sizes kept readable
- [ ] 16pt side gutters; no horizontal scroll at iPhone width
- [ ] Tap targets at least 44x44pt

## Glass and materials
- [ ] Glass used only for controls and floating chrome, not for content
- [ ] Content scrolls under translucent bars without hard seams
- [ ] Background materials respond to light and dark appearance

## Motion
- [ ] Transitions use system-feel springs; nothing lingers past about 0.4s
- [ ] Reduced Motion turns off decorative movement
- [ ] Haptics match the action (selection, success, error)

## Color and contrast
- [ ] Text meets WCAG AA contrast on its background in light and dark
- [ ] Color is paired with a label or icon, never used alone

## Feedback and states
- [ ] Empty, loading, and error states exist and read clearly
- [ ] Destructive actions are confirmed or undoable

## Accessibility
- [ ] Interactive elements have accessibility labels
- [ ] VoiceOver order follows the visual order

## Verification log (2026-11-17)

- **Palette contrast (WCAG, computed from `components/theme/tokens.ts`).** Text pairs pass 4.5:1 in both themes after the fix. Fixes: light `warningText` `#8A4F00` (6.56:1 on white, was `warning` 2.15:1) for the offline save message; `primaryText` (light `#6C4DFF`, dark `#A894FF`, was `#6C4DFF` at 3.88:1 on dark) for text links and labels. Fills keep the base colors. Light `success` on card is 4.36:1, so it passes only for large or non-text use. `SaveStatusDot` uses it as a dot, not text.
- **Reduce Motion.** Code path verified: `hooks/use-reduced-motion.ts` reads `AccessibilityInfo.isReduceMotionEnabled()` and subscribes to `reduceMotionChanged`. Runtime change is NOT observed on the simulator. Toggling `ReduceMotionEnabled` via `defaults write` produced no visible app change, so this stays open.
- **Haptics.** Not verifiable on the simulator.
- **Gates.** Vitest 118 files / 656 tests pass. Typecheck exit 0. Lint exit 0. Format clean.
