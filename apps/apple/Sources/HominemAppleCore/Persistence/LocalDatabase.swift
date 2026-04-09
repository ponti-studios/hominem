import Foundation
import GRDB

// MARK: - LocalDatabase

/// Actor-isolated wrapper around a GRDB DatabaseQueue providing SQLite persistence
/// for notes, chats, and chat messages, scoped by user ID.
///
/// All writes are serialized through GRDB's internal dispatch queue. The
/// `nonisolated(unsafe)` annotation on `dbQueue` is safe because GRDB manages
/// its own thread safety.
public actor LocalDatabase {

    nonisolated private let dbQueue: DatabaseQueue

    // MARK: - Init

    /// Open or create a database at the given file path.
    public init(path: String) throws {
        var config = Configuration()
        config.prepareDatabase { db in
            try db.execute(sql: "PRAGMA journal_mode = WAL")
        }
        let queue = try DatabaseQueue(path: path, configuration: config)
        self.dbQueue = queue
        try queue.write { db in
            try LocalDatabase.createSchema(db)
        }
    }

    /// In-memory database — intended for unit tests only.
    public static func inMemory() throws -> LocalDatabase {
        let queue = try DatabaseQueue()
        try queue.write { db in
            try LocalDatabase.createSchema(db)
        }
        return try LocalDatabase(dbQueue: queue)
    }

    /// Resolve the standard on-disk path inside Application Support.
    public static func onDisk() throws -> LocalDatabase {
        let appSupport = FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first!
        let dir = appSupport.appendingPathComponent("io.hominem.apple", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let dbPath = dir.appendingPathComponent("cache.sqlite").path
        return try LocalDatabase(path: dbPath)
    }

    private init(dbQueue: DatabaseQueue) throws {
        self.dbQueue = dbQueue
        try dbQueue.write { db in
            try LocalDatabase.createSchema(db)
        }
    }

    // MARK: - Schema

    private static func createSchema(_ db: Database) throws {
        // Notes
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS cached_notes (
                id TEXT NOT NULL,
                userId TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                payload BLOB NOT NULL,
                PRIMARY KEY (id, userId)
            )
        """)
        try db.execute(sql: """
            CREATE INDEX IF NOT EXISTS idx_cached_notes_user
            ON cached_notes (userId, updatedAt DESC)
        """)

        // Chats
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS cached_chats (
                id TEXT NOT NULL,
                userId TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                payload BLOB NOT NULL,
                PRIMARY KEY (id, userId)
            )
        """)
        try db.execute(sql: """
            CREATE INDEX IF NOT EXISTS idx_cached_chats_user
            ON cached_chats (userId, updatedAt DESC)
        """)

        // Chat messages
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS cached_chat_messages (
                id TEXT NOT NULL,
                chatId TEXT NOT NULL,
                userId TEXT NOT NULL,
                updatedAt TEXT NOT NULL,
                payload BLOB NOT NULL,
                PRIMARY KEY (id, chatId)
            )
        """)
        try db.execute(sql: """
            CREATE INDEX IF NOT EXISTS idx_cached_messages_chat
            ON cached_chat_messages (chatId, updatedAt ASC)
        """)
    }

    // MARK: - Notes

    /// Return all cached notes for a user, ordered by `updatedAt` descending.
    public func readNotes(userId: String) throws -> [Note] {
        try dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT payload FROM cached_notes WHERE userId = ? ORDER BY updatedAt DESC",
                arguments: [userId]
            )
            let decoder = JSONDecoder()
            return rows.compactMap { row -> Note? in
                guard let data = row["payload"] as? Data else { return nil }
                return try? decoder.decode(Note.self, from: data)
            }
        }
    }

    /// Replace all cached notes for a user with the provided array.
    public func writeNotes(_ notes: [Note], userId: String) throws {
        let encoder = JSONEncoder()
        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM cached_notes WHERE userId = ?",
                arguments: [userId]
            )
            for note in notes {
                let payload = try encoder.encode(note)
                try db.execute(
                    sql: """
                        INSERT INTO cached_notes (id, userId, updatedAt, payload)
                        VALUES (?, ?, ?, ?)
                    """,
                    arguments: [note.id, note.userId, note.updatedAt, payload]
                )
            }
        }
    }

    /// Insert or replace a single note in the cache.
    public func upsertNote(_ note: Note) throws {
        let encoder = JSONEncoder()
        let payload = try encoder.encode(note)
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT OR REPLACE INTO cached_notes (id, userId, updatedAt, payload)
                    VALUES (?, ?, ?, ?)
                """,
                arguments: [note.id, note.userId, note.updatedAt, payload]
            )
        }
    }

    /// Remove a single note from the cache.
    public func deleteNote(id: String, userId: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM cached_notes WHERE id = ? AND userId = ?",
                arguments: [id, userId]
            )
        }
    }

    /// Remove all cached notes for a user.
    public func clearNotes(userId: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM cached_notes WHERE userId = ?",
                arguments: [userId]
            )
        }
    }

    // MARK: - Chats

    /// Return all cached chats for a user, ordered by `updatedAt` descending.
    public func readChats(userId: String) throws -> [Chat] {
        try dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT payload FROM cached_chats WHERE userId = ? ORDER BY updatedAt DESC",
                arguments: [userId]
            )
            let decoder = JSONDecoder()
            return rows.compactMap { row -> Chat? in
                guard let data = row["payload"] as? Data else { return nil }
                return try? decoder.decode(Chat.self, from: data)
            }
        }
    }

    /// Replace all cached chats for a user with the provided array.
    public func writeChats(_ chats: [Chat], userId: String) throws {
        let encoder = JSONEncoder()
        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM cached_chats WHERE userId = ?",
                arguments: [userId]
            )
            for chat in chats {
                let payload = try encoder.encode(chat)
                try db.execute(
                    sql: """
                        INSERT INTO cached_chats (id, userId, updatedAt, payload)
                        VALUES (?, ?, ?, ?)
                    """,
                    arguments: [chat.id, chat.userId, chat.updatedAt, payload]
                )
            }
        }
    }

    /// Insert or replace a single chat in the cache.
    public func upsertChat(_ chat: Chat) throws {
        let encoder = JSONEncoder()
        let payload = try encoder.encode(chat)
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT OR REPLACE INTO cached_chats (id, userId, updatedAt, payload)
                    VALUES (?, ?, ?, ?)
                """,
                arguments: [chat.id, chat.userId, chat.updatedAt, payload]
            )
        }
    }

    /// Remove all cached chats for a user.
    public func clearChats(userId: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM cached_chats WHERE userId = ?",
                arguments: [userId]
            )
        }
    }

    // MARK: - Chat Messages

    /// Return cached messages for a chat, ordered by `updatedAt` ascending.
    public func readMessages(chatId: String) throws -> [ChatMessage] {
        try dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT payload FROM cached_chat_messages WHERE chatId = ? ORDER BY updatedAt ASC",
                arguments: [chatId]
            )
            let decoder = JSONDecoder()
            return rows.compactMap { row -> ChatMessage? in
                guard let data = row["payload"] as? Data else { return nil }
                return try? decoder.decode(ChatMessage.self, from: data)
            }
        }
    }

    /// Replace all cached messages for a chat with the provided array.
    public func writeMessages(_ messages: [ChatMessage], chatId: String, userId: String) throws {
        let encoder = JSONEncoder()
        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM cached_chat_messages WHERE chatId = ?",
                arguments: [chatId]
            )
            for message in messages {
                let payload = try encoder.encode(message)
                try db.execute(
                    sql: """
                        INSERT INTO cached_chat_messages (id, chatId, userId, updatedAt, payload)
                        VALUES (?, ?, ?, ?, ?)
                    """,
                    arguments: [message.id, chatId, userId, message.updatedAt, payload]
                )
            }
        }
    }

    /// Remove cached messages for a chat.
    public func clearMessages(chatId: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM cached_chat_messages WHERE chatId = ?",
                arguments: [chatId]
            )
        }
    }

    // MARK: - Clear All

    /// Remove all cached notes, chats, and chat messages for a user.
    public func clearAll(userId: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM cached_notes WHERE userId = ?",
                arguments: [userId]
            )
            try db.execute(
                sql: "DELETE FROM cached_chats WHERE userId = ?",
                arguments: [userId]
            )
            try db.execute(
                sql: "DELETE FROM cached_chat_messages WHERE userId = ?",
                arguments: [userId]
            )
        }
    }
}
