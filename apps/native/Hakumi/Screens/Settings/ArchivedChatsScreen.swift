import SwiftUI

// MARK: - ArchivedChat model

private struct ArchivedChat: Identifiable, Sendable {
    let id: String
    let title: String
    let archivedAt: Date
}

// MARK: - ArchivedChatsScreen

struct ArchivedChatsScreen: View {
    @Environment(Router.self) private var router
    @State private var chats: [ArchivedChat] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                VStack { Spacer(); ProgressView().tint(Color.Hakumi.textTertiary); Spacer() }
                    .frame(maxWidth: .infinity)
            } else if chats.isEmpty {
                emptyView
            } else {
                chatList
            }
        }
        .navigationTitle("Archived Chats")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.Hakumi.bgBase.ignoresSafeArea())
        .task { await load() }
    }

    // MARK: List

    private var chatList: some View {
        List {
            ForEach(chats) { chat in
                Button {
                    router.selectedTab = .inbox
                    router.protectedPath = [.chat(id: chat.id)]
                } label: {
                    HStack(spacing: Spacing.md) {
                        ZStack {
                            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                                .fill(Color.Hakumi.bgSurface)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                                        .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                                )
                                .frame(width: 32, height: 32)
                            Image(systemName: "tray")
                                .font(.system(size: 13))
                                .foregroundStyle(Color.Hakumi.textTertiary)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(chat.title)
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(Color.Hakumi.textPrimary)
                                .lineLimit(1)
                            Text("Archived \(chat.archivedAt.relativeString)")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.Hakumi.textTertiary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.Hakumi.textTertiary)
                    }
                    .padding(.vertical, Spacing.xs)
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.Hakumi.bgBase)
                .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    // MARK: Empty

    private var emptyView: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Archived chats")
                .font(.system(size: 12))
                .tracking(1)
                .foregroundStyle(Color.Hakumi.textSecondary)

            Text("Revisit past conversations")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Color.Hakumi.textPrimary)

            Text("Archived chats are hidden from the main feed but remain available here.")
                .font(.system(size: 15))
                .foregroundStyle(Color.Hakumi.textSecondary)

            Surface(elevation: .surface, showShadow: false) {
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("No archived chats yet")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Color.Hakumi.textPrimary)
                    Text("Chats you archive will appear here for later reference.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.Hakumi.textSecondary)
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.xl)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.lg)
        .padding(.top, Spacing.lg)
    }

    // MARK: Data

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let url = URL(string: AuthService.apiURL("/api/chats").absoluteString + "?limit=100")!
            var request = URLRequest(url: url)
            request.timeoutInterval = 15
            for (k, v) in AuthProvider.shared.getAuthHeaders() { request.setValue(v, forHTTPHeaderField: k) }

            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return
            }

            guard let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return }

            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let isoNoFrac = ISO8601DateFormatter()
            isoNoFrac.formatOptions = [.withInternetDateTime]

            func parseDate(_ s: String) -> Date? { iso.date(from: s) ?? isoNoFrac.date(from: s) }

            chats = arr.compactMap { dict -> ArchivedChat? in
                guard
                    let id = dict["id"] as? String,
                    let archivedStr = dict["archivedAt"] as? String,
                    let archivedAt = parseDate(archivedStr)
                else { return nil }
                let title = dict["title"] as? String ?? "Untitled chat"
                return ArchivedChat(id: id, title: title, archivedAt: archivedAt)
            }
            .sorted { $0.archivedAt > $1.archivedAt }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Date helper

private extension Date {
    var relativeString: String {
        let now = Date()
        let diff = now.timeIntervalSince(self)
        if diff < 60 { return "just now" }
        if diff < 3600 { return "\(Int(diff / 60))m ago" }
        if diff < 86400 { return "\(Int(diff / 3600))h ago" }
        if diff < 7 * 86400 { return "\(Int(diff / 86400))d ago" }
        let f = DateFormatter()
        f.dateFormat = Calendar.current.isDate(self, equalTo: now, toGranularity: .year)
            ? "MMM d" : "MMM d, yyyy"
        return f.string(from: self)
    }
}

#Preview {
    NavigationStack {
        ArchivedChatsScreen()
            .environment(Router())
    }
}
