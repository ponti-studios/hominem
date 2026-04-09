import SwiftUI

/// A searchable, filterable list of notes.
///
/// Driven by `NotesStore`. Tap a row to navigate to `NoteDetailView` (Sprint 3).
public struct NotesListView: View {
    var notesStore: NotesStore

    @State private var searchText = ""
    @State private var selectedType: NoteContentType? = nil
    @State private var showingNewNote = false
    @State private var newNoteContent = ""
    @State private var isCreatingNote = false

    public init(notesStore: NotesStore) {
        self.notesStore = notesStore
    }

    private var filteredNotes: [Note] {
        var result = notesStore.notes
        if searchText.isEmpty == false {
            let q = searchText.lowercased()
            result = result.filter {
                ($0.title ?? "").lowercased().contains(q) ||
                $0.content.lowercased().contains(q)
            }
        }
        if let type = selectedType {
            result = result.filter { $0.type == type }
        }
        return result
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Filter chips
            if selectedType != nil || !notesStore.notes.isEmpty {
                filterChips
                    .padding(.horizontal, AppleTheme.md)
                    .padding(.bottom, AppleTheme.sm)
            }

            List {
                ForEach(filteredNotes) { note in
                    NavigationLink {
                        NoteDetailView(note: note, notesStore: notesStore)
                    } label: {
                        NoteRow(note: note)
                            .listRowInsets(EdgeInsets(
                                top: AppleTheme.sm,
                                leading: AppleTheme.md,
                                bottom: AppleTheme.sm,
                                trailing: AppleTheme.md
                            ))
                    }
                    .listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
            .overlay {
                if notesStore.isLoading && notesStore.notes.isEmpty {
                    ProgressView()
                } else if filteredNotes.isEmpty && !notesStore.isLoading {
                    ContentUnavailableView(
                        searchText.isEmpty ? "No Notes" : "No Results",
                        systemImage: "note.text",
                        description: Text(
                            searchText.isEmpty
                                ? "Notes you create will appear here."
                                : "No notes match \"\(searchText)\"."
                        )
                    )
                }
            }
            .refreshable {
                await notesStore.refresh()
            }
        }
        .navigationTitle("Notes")
        .searchable(text: $searchText, prompt: "Search notes")
        .task {
            if notesStore.notes.isEmpty {
                await notesStore.refresh()
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingNewNote = true
                } label: {
                    Image(systemName: "square.and.pencil")
                }
            }
        }
        .sheet(isPresented: $showingNewNote) {
            newNoteSheet
        }
        .onReceive(NotificationCenter.default.publisher(for: .hominemNewNote)) { _ in
            showingNewNote = true
        }
    }

    // MARK: - New note sheet

    private var newNoteSheet: some View {
        NavigationStack {
            Form {
                Section("Content") {
                    TextEditor(text: $newNoteContent)
                        .frame(minHeight: 120)
                }
            }
            .navigationTitle("New Note")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        newNoteContent = ""
                        showingNewNote = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await createNote() }
                    }
                    .disabled(
                        newNoteContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            || isCreatingNote
                    )
                }
            }
        }
        #if os(iOS)
        .presentationDetents([.medium, .large])
        #endif
    }

    private func createNote() async {
        let content = newNoteContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard content.isEmpty == false else { return }
        isCreatingNote = true
        defer { isCreatingNote = false }
        do {
            _ = try await notesStore.createNote(
                NotesCreateInput(content: content, type: .note)
            )
            newNoteContent = ""
            showingNewNote = false
        } catch {
            // Error visible via notesStore.error
        }
    }

    // MARK: - Filter chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppleTheme.sm) {
                FilterChip(
                    label: "All",
                    isSelected: selectedType == nil,
                    action: { selectedType = nil }
                )
                ForEach(NoteContentType.allCases, id: \.self) { type in
                    FilterChip(
                        label: type.displayName,
                        isSelected: selectedType == type,
                        action: {
                            selectedType = selectedType == type ? nil : type
                        }
                    )
                }
            }
        }
    }
}

// MARK: - NoteRow

private struct NoteRow: View {
    let note: Note

    var body: some View {
        VStack(alignment: .leading, spacing: AppleTheme.xs) {
            Text(note.title ?? "Untitled")
                .font(AppleTheme.bodyStrongFont)
                .foregroundStyle(AppleTheme.foreground)
                .lineLimit(1)

            let preview = note.excerpt ?? String(note.content.prefix(120))
            if preview.isEmpty == false {
                Text(preview)
                    .font(AppleTheme.captionFont)
                    .foregroundStyle(AppleTheme.secondaryText)
                    .lineLimit(2)
            }

            HStack(spacing: AppleTheme.sm) {
                Text(note.type.displayName)
                    .font(.caption2)
                    .padding(.horizontal, AppleTheme.xs + 2)
                    .padding(.vertical, 2)
                    .background(AppleTheme.muted)
                    .clipShape(Capsule())
                    .foregroundStyle(AppleTheme.secondaryText)

                Spacer()

                Text(note.relativeDate)
                    .font(AppleTheme.monoCaptionFont)
                    .foregroundStyle(AppleTheme.tertiaryText)
            }
        }
        .padding(AppleTheme.sm12)
        .background(AppleTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppleTheme.cardRadius, style: .continuous))
    }
}

// MARK: - FilterChip

private struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(AppleTheme.captionFont)
                .padding(.horizontal, AppleTheme.sm12)
                .padding(.vertical, AppleTheme.xs)
                .background(isSelected ? AppleTheme.accent : AppleTheme.surface)
                .foregroundStyle(isSelected ? Color.white : AppleTheme.foreground)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - NoteContentType display helper

extension NoteContentType {
    var displayName: String {
        rawValue.replacingOccurrences(of: "_", with: " ").capitalized
    }
}
