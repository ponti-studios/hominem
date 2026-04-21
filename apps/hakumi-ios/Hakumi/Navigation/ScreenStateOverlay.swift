import SwiftUI

#if DEBUG
struct ScreenStateOverlay: View {
    let authPhase: AuthPhase
    let sidebarSelection: ProtectedRoute?
    let size: CGSize
    let safeAreaInsets: EdgeInsets
    let screenBounds: CGRect
    let nativeBounds: CGRect
    let scale: CGFloat
    let windowBounds: CGRect?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("phase: \(authPhaseLabel)")
            Text("sel: \(selectionLabel)")
            Text("size: \(Int(size.width))×\(Int(size.height))")
            Text("safe: t\(Int(safeAreaInsets.top)) b\(Int(safeAreaInsets.bottom))")
            Text("screen: \(format(screenBounds.size))")
            Text("native: \(format(nativeBounds.size)) @\(scaleLabel)x")
            Text("window: \(windowBounds.map { format($0.size) } ?? "nil")")
        }
        .font(.system(size: 10, weight: .medium, design: .monospaced))
        .foregroundStyle(Color.white)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.Hakumi.destructive.opacity(0.9))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .shadow(color: .black.opacity(0.25), radius: 6, x: 0, y: 2)
        .allowsHitTesting(false)
    }

    private var authPhaseLabel: String {
        switch authPhase {
        case .booting: return "booting"
        case .unauthenticated: return "unauthenticated"
        case .onboarding: return "onboarding"
        case .authenticated: return "authenticated"
        }
    }

    private var selectionLabel: String {
        switch sidebarSelection {
        case nil: return "none"
        case .noteDetail(let id): return "note:\(id.prefix(6))"
        case .chat(let id): return "chat:\(id.prefix(6))"
        case .archivedChats: return "archived"
        }
    }

    private func format(_ size: CGSize) -> String {
        "\(Int(size.width))×\(Int(size.height))"
    }

    private var scaleLabel: String {
        String(format: "%.1f", scale)
    }
}
#endif
