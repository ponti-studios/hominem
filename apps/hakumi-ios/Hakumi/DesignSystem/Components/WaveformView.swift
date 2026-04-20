import SwiftUI

// MARK: - WaveformView
//
// Animated bar-graph waveform driven by a 0…1 amplitude value.
// Used in SharedComposerCard during voice recording.

struct WaveformView: View {
    let amplitude: Float

    private let barCount = 5
    private let barWidth: CGFloat = 3
    private let spacing: CGFloat = 3

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(0..<barCount, id: \.self) { index in
                RoundedRectangle(cornerRadius: barWidth / 2, style: .continuous)
                    .fill(Color.Hakumi.accent)
                    .frame(width: barWidth, height: barHeight(for: index))
                    .animation(
                        .easeInOut(duration: 0.12).delay(Double(index) * 0.02),
                        value: amplitude
                    )
            }
        }
        .frame(height: 28)
    }

    private func barHeight(for index: Int) -> CGFloat {
        let base: CGFloat = 4
        let maxHeight: CGFloat = 24
        let phase = Double(index) / Double(barCount - 1) * .pi
        let factor = (sin(phase) * 0.4 + 0.6) * CGFloat(amplitude)
        return base + (maxHeight - base) * Swift.max(0.08, factor)
    }
}

#Preview {
    WaveformView(amplitude: 0.6)
        .padding()
        .background(Color.black)
}
