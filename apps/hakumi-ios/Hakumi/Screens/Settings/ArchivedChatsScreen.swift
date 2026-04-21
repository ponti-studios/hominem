import SwiftUI

// MARK: - ArchivedChatsScreen

struct ArchivedChatsScreen: View {
    @Environment(Router.self) private var router
    @State private var chats: [ChatService.ArchivedChatSummary] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                ScreenLoadingView()
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
                    router.showSettings = false
                    router.sidebarSelection = .chat(id: chat.id)
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
                            Text("Archived \(chat.archivedAt.relativeDetailString)")
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
            chats = try await ChatService.fetchArchivedChats()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        ArchivedChatsScreen()
            .environment(Router())
    }
}
