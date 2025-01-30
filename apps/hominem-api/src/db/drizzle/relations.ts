import { relations } from "drizzle-orm/relations";
import {
	Account,
	Bookmark,
	Chat,
	ChatMessage,
	Flight,
	Idea,
	Item,
	List,
	ListInvite,
	Movie,
	MovieViewings,
	Place,
	Session,
	Token,
	User,
	UserLists,
} from "./schema";

export const accountRelations = relations(Account, ({ one }) => ({
	user: one(User, {
		fields: [Account.userId],
		references: [User.id],
	}),
}));

export const userRelations = relations(User, ({ many }) => ({
	accounts: many(Account),
	bookmarks: many(Bookmark),
	chats: many(Chat),
	chatMessages: many(ChatMessage),
	flights: many(Flight),
	lists: many(List),
	ideas: many(Idea),
	items: many(Item),
	tokens: many(Token),
	movieViewings: many(MovieViewings),
	places: many(Place),
	sessions: many(Session),
	userLists: many(UserLists),
	listInvites_invitedUserId: many(ListInvite, {
		relationName: "listInvite_invitedUserId_user_id",
	}),
	listInvites_userId: many(ListInvite, {
		relationName: "listInvite_userId_user_id",
	}),
}));

export const bookmarkRelations = relations(Bookmark, ({ one }) => ({
	user: one(User, {
		fields: [Bookmark.userId],
		references: [User.id],
	}),
}));

export const chatRelations = relations(Chat, ({ one, many }) => ({
	user: one(User, {
		fields: [Chat.userId],
		references: [User.id],
	}),
	chatMessages: many(ChatMessage),
}));

export const chatMessageRelations = relations(ChatMessage, ({ one }) => ({
	chat: one(Chat, {
		fields: [ChatMessage.chatId],
		references: [Chat.id],
	}),
	user: one(User, {
		fields: [ChatMessage.userId],
		references: [User.id],
	}),
}));

export const flightRelations = relations(Flight, ({ one }) => ({
	user: one(User, {
		fields: [Flight.userId],
		references: [User.id],
	}),
	list: one(List, {
		fields: [Flight.listId],
		references: [List.id],
	}),
}));

export const listRelations = relations(List, ({ one, many }) => ({
	flights: many(Flight),
	user: one(User, {
		fields: [List.userId],
		references: [User.id],
	}),
	items: many(Item),
	userLists: many(UserLists),
	listInvites: many(ListInvite),
}));

export const ideaRelations = relations(Idea, ({ one }) => ({
	user: one(User, {
		fields: [Idea.userId],
		references: [User.id],
	}),
}));

export const itemRelations = relations(Item, ({ one, many }) => ({
	list: one(List, {
		fields: [Item.listId],
		references: [List.id],
	}),
	user: one(User, {
		fields: [Item.userId],
		references: [User.id],
	}),
	places: many(Place),
}));

export const tokenRelations = relations(Token, ({ one }) => ({
	user: one(User, {
		fields: [Token.userId],
		references: [User.id],
	}),
}));

export const movieViewingsRelations = relations(MovieViewings, ({ one }) => ({
	movie: one(Movie, {
		fields: [MovieViewings.movieId],
		references: [Movie.id],
	}),
	user: one(User, {
		fields: [MovieViewings.userId],
		references: [User.id],
	}),
}));

export const movieRelations = relations(Movie, ({ many }) => ({
	movieViewings: many(MovieViewings),
}));

export const placeRelations = relations(Place, ({ one }) => ({
	user: one(User, {
		fields: [Place.userId],
		references: [User.id],
	}),
	item: one(Item, {
		fields: [Place.itemId],
		references: [Item.id],
	}),
}));

export const sessionRelations = relations(Session, ({ one }) => ({
	user: one(User, {
		fields: [Session.userId],
		references: [User.id],
	}),
}));

export const userListsRelations = relations(UserLists, ({ one }) => ({
	list: one(List, {
		fields: [UserLists.listId],
		references: [List.id],
	}),
	user: one(User, {
		fields: [UserLists.userId],
		references: [User.id],
	}),
}));

export const listInviteRelations = relations(ListInvite, ({ one }) => ({
	list: one(List, {
		fields: [ListInvite.listId],
		references: [List.id],
	}),
	user_invitedUserId: one(User, {
		fields: [ListInvite.invitedUserId],
		references: [User.id],
		relationName: "listInvite_invitedUserId_user_id",
	}),
	user_userId: one(User, {
		fields: [ListInvite.userId],
		references: [User.id],
		relationName: "listInvite_userId_user_id",
	}),
}));
