import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Control Center Widget (iOS 18+)

@available(iOS 18.0, *)
struct AddNoteControlWidget: ControlWidget {
  static let kind: String = "com.pontistudios.hakumi.control.add-note"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: AddNoteControlCenterIntent()) {
        Label("Add Note", systemImage: "note.text.badge.plus")
          .accessibilityLabel("Add a new note in Hakumi")
      }
    }
    .displayName("Add Note")
    .description("Quickly open Hakumi to create a new note.")
  }
}

@available(iOS 18.0, *)
struct OpenChatControlWidget: ControlWidget {
  static let kind: String = "com.pontistudios.hakumi.control.open-chat"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: StartChatControlCenterIntent()) {
        Label("Open Chat", systemImage: "sparkles")
          .accessibilityLabel("Open Hakumi AI assistant")
      }
    }
    .displayName("Open Chat")
    .description("Quickly open the Hakumi AI assistant.")
  }
}

// MARK: - Widget Bundle

@available(iOS 18.0, *)
@main
struct ControlCenterWidgetBundle: WidgetBundle {
  var body: some Widget {
    AddNoteControlWidget()
    OpenChatControlWidget()
  }
}