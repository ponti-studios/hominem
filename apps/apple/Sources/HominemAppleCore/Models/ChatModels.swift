import Foundation

// MARK: - ChatMessageRole

public enum ChatMessageRole: String, Codable, Sendable {
    case system
    case user
    case assistant
    case tool
}

// MARK: - ChatMessageToolCall

public struct ChatMessageToolCall: Codable, Sendable, Equatable {
    public let toolName: String
    public let type: String
    public let toolCallId: String
    public let args: [String: String]

    public init(toolName: String, type: String, toolCallId: String, args: [String: String]) {
        self.toolName = toolName
        self.type = type
        self.toolCallId = toolCallId
        self.args = args
    }
}

// MARK: - ChatMessageFile

public struct ChatMessageFile: Codable, Sendable, Equatable {
    public let type: String
    public let fileId: String?
    public let url: String?
    public let filename: String?
    public let mimeType: String?
    public let size: Int?

    public init(
        type: String,
        fileId: String? = nil,
        url: String? = nil,
        filename: String? = nil,
        mimeType: String? = nil,
        size: Int? = nil
    ) {
        self.type = type
        self.fileId = fileId
        self.url = url
        self.filename = filename
        self.mimeType = mimeType
        self.size = size
    }
}

// MARK: - ChatMessageReferencedNote

public struct ChatMessageReferencedNote: Codable, Sendable, Equatable {
    public let id: String
    public let title: String?

    public init(id: String, title: String?) {
        self.id = id
        self.title = title
    }
}

// MARK: - Chat

public struct Chat: Codable, Identifiable, Sendable, Equatable {
    public let id: String
    public let userId: String
    public let title: String
    public let noteId: String?
    public let archivedAt: String?
    public let createdAt: String
    public let updatedAt: String

    public init(
        id: String,
        userId: String,
        title: String,
        noteId: String? = nil,
        archivedAt: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.userId = userId
        self.title = title
        self.noteId = noteId
        self.archivedAt = archivedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - ChatMessage

public struct ChatMessage: Codable, Identifiable, Sendable, Equatable {
    public let id: String
    public let chatId: String
    public let userId: String
    public let role: ChatMessageRole
    public let content: String
    public let files: [ChatMessageFile]?
    public let referencedNotes: [ChatMessageReferencedNote]?
    public let toolCalls: [ChatMessageToolCall]?
    public let reasoning: String?
    public let parentMessageId: String?
    public let createdAt: String
    public let updatedAt: String

    public init(
        id: String,
        chatId: String,
        userId: String,
        role: ChatMessageRole,
        content: String,
        files: [ChatMessageFile]? = nil,
        referencedNotes: [ChatMessageReferencedNote]? = nil,
        toolCalls: [ChatMessageToolCall]? = nil,
        reasoning: String? = nil,
        parentMessageId: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.chatId = chatId
        self.userId = userId
        self.role = role
        self.content = content
        self.files = files
        self.referencedNotes = referencedNotes
        self.toolCalls = toolCalls
        self.reasoning = reasoning
        self.parentMessageId = parentMessageId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - ChatWithMessages

public struct ChatWithMessages: Decodable, Sendable {
    public let id: String
    public let userId: String
    public let title: String
    public let noteId: String?
    public let archivedAt: String?
    public let createdAt: String
    public let updatedAt: String
    public let messages: [ChatMessage]

    public var chat: Chat {
        Chat(
            id: id,
            userId: userId,
            title: title,
            noteId: noteId,
            archivedAt: archivedAt,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}

// MARK: - Input types

public struct ChatsCreateInput: Encodable, Sendable {
    public let title: String
    public let noteId: String?

    public init(title: String, noteId: String? = nil) {
        self.title = title
        self.noteId = noteId
    }
}

public struct ChatsUpdateInput: Encodable, Sendable {
    public let title: String

    public init(title: String) {
        self.title = title
    }
}

public struct ChatsSendInput: Encodable, Sendable {
    public let message: String
    public let fileIds: [String]?
    public let noteIds: [String]?

    public init(message: String, fileIds: [String]? = nil, noteIds: [String]? = nil) {
        self.message = message
        self.fileIds = fileIds
        self.noteIds = noteIds
    }
}

// MARK: - Output types

public struct ChatsSendOutput: Decodable, Sendable {
    public struct Messages: Decodable, Sendable {
        public let user: ChatMessage
        public let assistant: ChatMessage
    }

    public struct Metadata: Decodable, Sendable {
        public let startTime: Double
        public let timestamp: String
    }

    public let streamId: String
    public let chatId: String
    public let chatTitle: String
    public let messages: Messages
    public let metadata: Metadata
}
