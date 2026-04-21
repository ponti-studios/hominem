import Foundation

extension Date {
    @MainActor
    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        f.dateTimeStyle = .named
        return f
    }()

    /// Short relative string suitable for list rows: "now", "5m", "3h", "Mon", "Apr 20", "Apr 20, 2024"
    var relativeListString: String {
        let now = Date()
        let diff = now.timeIntervalSince(self)
        if diff < 60 { return "now" }
        if diff < 3600 { return "\(Int(diff / 60))m" }
        if diff < 86400 { return "\(Int(diff / 3600))h" }

        let cal = Calendar.current
        let diffDays = cal.dateComponents([.day],
            from: cal.startOfDay(for: self),
            to: cal.startOfDay(for: now)).day ?? 0

        if diffDays == 1 { return "Yesterday" }
        if diffDays < 7 {
            let f = DateFormatter()
            f.dateFormat = "EEE"
            return f.string(from: self)
        }
        let f = DateFormatter()
        f.dateFormat = diffDays < 365 ? "MMM d" : "MMM d, yyyy"
        return f.string(from: self)
    }

    /// Longer relative string for detail contexts: "just now", "5m ago", "3h ago", "Apr 20"
    var relativeDetailString: String {
        let diff = -timeIntervalSinceNow
        if diff < 60 { return "just now" }
        if diff < 3600 { return "\(Int(diff / 60))m ago" }
        if diff < 86400 { return "\(Int(diff / 3600))h ago" }
        if diff < 7 * 86400 { return "\(Int(diff / 86400))d ago" }
        let now = Date()
        let f = DateFormatter()
        f.dateFormat = Calendar.current.isDate(self, equalTo: now, toGranularity: .year)
            ? "MMM d" : "MMM d, yyyy"
        return f.string(from: self)
    }
}
