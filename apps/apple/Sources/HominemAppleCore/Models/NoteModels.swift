import Foundation

// MARK: - NoteContentType

public enum NoteContentType: String, Codable, Sendable, CaseIterable {
    case note
    case document
    case task
    case timer
    case journal
    case tweet
    case essay
    case blogPost = "blog_post"
    case socialPost = "social_post"
}

// MARK: - NoteStatus

public enum NoteStatus: String, Codable, Sendable, CaseIterable {
    case draft
    case published
    case archived
}

// MARK: - Supporting value types

public struct ContentTag: Codable, Sendable, Equatable, Hashable {
    public let value: String

    public init(value: String) {
        self.value = value
    }
}

public struct NoteMention: Codable, Sendable, Equatable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct NoteAnalysis: Codable, Sendable, Equatable {
    public let readingTimeMinutes: Int?
    public let summary: String?
    public let keywords: [String]?
    public let sentiment: String?
    public let language: String?

    public init(
        readingTimeMinutes: Int? = nil,
        summary: String? = nil,
        keywords: [String]? = nil,
        sentiment: String? = nil,
        language: String? = nil
    ) {
        self.readingTimeMinutes = readingTimeMinutes
        self.summary = summary
        self.keywords = keywords
        self.sentiment = sentiment
        self.language = language
    }
}

public struct NoteFile: Codable, Identifiable, Sendable, Equatable {
    public let id: String
    public let originalName: String
    public let mimetype: String
    public let size: Int
    public let url: String
    public let uploadedAt: String
    public let content: String?
    public let textContent: String?

    public init(
        id: String,
        originalName: String,
        mimetype: String,
        size: Int,
        url: String,
        uploadedAt: String,
        content: String? = nil,
        textContent: String? = nil
    ) {
        self.id = id
        self.originalName = originalName
        self.mimetype = mimetype
        self.size = size
        self.url = url
        self.uploadedAt = uploadedAt
        self.content = content
        self.textContent = textContent
    }
}

// MARK: - Note

public struct Note: Codable, Identifiable, Sendable, Equatable {
    public let id: String
    public let userId: String
    public let type: NoteContentType
    public let status: NoteStatus
    public let title: String?
    public let content: String
    public let excerpt: String?
    public let tags: [ContentTag]
    public let mentions: [NoteMention]?
    public let analysis: NoteAnalysis?
    public let parentNoteId: String?
    public let files: [NoteFile]
    public let versionNumber: Int
    public let isLatestVersion: Bool
    public let publishedAt: String?
    public let scheduledFor: String?
    public let createdAt: String
    public let updatedAt: String
}

// MARK: - List

public struct NotesListOutput: Decodable, Sendable {
    public let notes: [Note]
}

public struct NotesListQuery: Sendable {
    public var types: [NoteContentType]?
    public var status: [NoteStatus]?
    public var tags: [String]?
    public var query: String?
    public var since: String?
    public var sortBy: String?
    public var sortOrder: String?
    public var limit: Int?
    public var offset: Int?
    public var includeAllVersions: Bool?

    public init(
        types: [NoteContentType]? = nil,
        status: [NoteStatus]? = nil,
        tags: [String]? = nil,
        query: String? = nil,
        since: String? = nil,
        sortBy: String? = nil,
        sortOrder: String? = nil,
        limit: Int? = nil,
        offset: Int? = nil,
        includeAllVersions: Bool? = nil
    ) {
        self.types = types
        self.status = status
        self.tags = tags
        self.query = query
        self.since = since
        self.sortBy = sortBy
        self.sortOrder = sortOrder
        self.limit = limit
        self.offset = offset
        self.includeAllVersions = includeAllVersions
    }

    public var queryItems: [URLQueryItem] {
        var items: [URLQueryItem] = []
        if let types, !types.isEmpty {
            items.append(URLQueryItem(name: "types", value: types.map(\.rawValue).joined(separator: ",")))
        }
        if let status, !status.isEmpty {
            items.append(URLQueryItem(name: "status", value: status.map(\.rawValue).joined(separator: ",")))
        }
        if let tags, !tags.isEmpty {
            items.append(URLQueryItem(name: "tags", value: tags.joined(separator: ",")))
        }
        if let query { items.append(URLQueryItem(name: "query", value: query)) }
        if let since { items.append(URLQueryItem(name: "since", value: since)) }
        if let sortBy { items.append(URLQueryItem(name: "sortBy", value: sortBy)) }
        if let sortOrder { items.append(URLQueryItem(name: "sortOrder", value: sortOrder)) }
        if let limit { items.append(URLQueryItem(name: "limit", value: String(limit))) }
        if let offset { items.append(URLQueryItem(name: "offset", value: String(offset))) }
        if let includeAllVersions {
            items.append(URLQueryItem(name: "includeAllVersions", value: String(includeAllVersions)))
        }
        return items
    }
}

// MARK: - Create

public struct NotesCreateInput: Encodable, Sendable {
    public let type: NoteContentType?
    public let status: NoteStatus?
    public let title: String?
    public let content: String
    public let fileIds: [String]?
    public let excerpt: String?
    public let tags: [ContentTag]?
    public let mentions: [NoteMention]?

    public init(
        content: String,
        type: NoteContentType? = nil,
        status: NoteStatus? = nil,
        title: String? = nil,
        fileIds: [String]? = nil,
        excerpt: String? = nil,
        tags: [ContentTag]? = nil,
        mentions: [NoteMention]? = nil
    ) {
        self.content = content
        self.type = type
        self.status = status
        self.title = title
        self.fileIds = fileIds
        self.excerpt = excerpt
        self.tags = tags
        self.mentions = mentions
    }
}

// MARK: - Update
//
// Fields absent from the JSON body are left unchanged by the server (PATCH semantics).
// To explicitly set a nullable field to null, use the `clearTitle` / `clearExcerpt` flags.

public struct NotesUpdateInput: Sendable {
    public let type: NoteContentType?
    public let status: NoteStatus?
    public let title: String?
    public let clearTitle: Bool
    public let content: String?
    public let fileIds: [String]?
    public let excerpt: String?
    public let clearExcerpt: Bool
    public let tags: [ContentTag]?

    public init(
        type: NoteContentType? = nil,
        status: NoteStatus? = nil,
        title: String? = nil,
        clearTitle: Bool = false,
        content: String? = nil,
        fileIds: [String]? = nil,
        excerpt: String? = nil,
        clearExcerpt: Bool = false,
        tags: [ContentTag]? = nil
    ) {
        self.type = type
        self.status = status
        self.title = title
        self.clearTitle = clearTitle
        self.content = content
        self.fileIds = fileIds
        self.excerpt = excerpt
        self.clearExcerpt = clearExcerpt
        self.tags = tags
    }
}

extension NotesUpdateInput: Encodable {
    enum CodingKeys: String, CodingKey {
        case type, status, title, content, fileIds, excerpt, tags
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(type, forKey: .type)
        try container.encodeIfPresent(status, forKey: .status)
        if clearTitle {
            try container.encodeNil(forKey: .title)
        } else {
            try container.encodeIfPresent(title, forKey: .title)
        }
        try container.encodeIfPresent(content, forKey: .content)
        try container.encodeIfPresent(fileIds, forKey: .fileIds)
        if clearExcerpt {
            try container.encodeNil(forKey: .excerpt)
        } else {
            try container.encodeIfPresent(excerpt, forKey: .excerpt)
        }
        try container.encodeIfPresent(tags, forKey: .tags)
    }
}

// MARK: - Classify / Review

public struct ClassifyNoteOutput: Decodable, Sendable {
    public let reviewItemId: String
    public let proposedTitle: String
    public let proposedChanges: [String]
    public let previewContent: String
}

public struct AcceptReviewOutput: Decodable, Sendable {
    public let success: Bool
}
