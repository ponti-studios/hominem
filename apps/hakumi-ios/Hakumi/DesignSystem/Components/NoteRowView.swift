import SwiftUI

struct NoteRowView: View {
    let note: NoteItem
    let isPending: Bool

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.sm) {
                    Text(note.displayTitle)
                        .textStyle(AppTypography.subhead)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.Hakumi.textPrimary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if !isPending {
                        Text(note.createdAt.relativeListString)
                            .textStyle(AppTypography.caption1)
                            .foregroundStyle(Color.Hakumi.textTertiary)
                            .fixedSize()
                    }
                }

                if !note.contentPreview.isEmpty {
                    Text(note.contentPreview)
                        .textStyle(AppTypography.caption1)
                        .foregroundStyle(Color.Hakumi.textSecondary)
                        .lineLimit(2)
                }

                if note.hasAttachments {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "paperclip")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.Hakumi.textTertiary)
                        Text("Attachment")
                            .textStyle(AppTypography.caption2)
                            .foregroundStyle(Color.Hakumi.textTertiary)
                    }
                }
            }

            if isPending {
                ProgressView()
                    .scaleEffect(0.7)
                    .tint(Color.Hakumi.textTertiary)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, Spacing.sm2)
        .opacity(isPending ? 0.6 : 1)
    }
}
