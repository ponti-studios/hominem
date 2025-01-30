import type { tags } from "./tagging";

export interface Note {
	id: string;
	content: string;
	title?: string;
	createdAt: Date;
	updatedAt?: Date;
}

export interface NoteTag {
	noteId: string;
	tagId: (typeof tags.$inferSelect)["id"];
}
