import { sql } from "drizzle-orm";
import {
	boolean,
	doublePrecision,
	foreignKey,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const itemType = pgEnum("ItemType", ["FLIGHT", "PLACE"]);
export const tokenType = pgEnum("TokenType", ["EMAIL", "API"]);

export const VerificationToken = pgTable(
	"VerificationToken",
	{
		identifier: text("identifier").notNull(),
		token: text("token").notNull(),
		expires: timestamp("expires", { precision: 3, mode: "string" }).notNull(),
	},
	(table) => {
		return {
			identifierTokenKey: uniqueIndex(
				"VerificationToken_identifier_token_key",
			).using(
				"btree",
				table.identifier.asc().nullsLast(),
				table.token.asc().nullsLast(),
			),
			tokenKey: uniqueIndex("VerificationToken_token_key").using(
				"btree",
				table.token.asc().nullsLast(),
			),
		};
	},
);

export const User = pgTable(
	"User",
	{
		id: text("id").primaryKey().notNull(),
		email: text("email").notNull(),
		name: text("name"),
		isAdmin: boolean("isAdmin").default(false).notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		emailVerified: timestamp("emailVerified", { precision: 3, mode: "string" }),
		image: text("image"),
	},
	(table) => {
		return {
			emailKey: uniqueIndex("User_email_key").using(
				"btree",
				table.email.asc().nullsLast(),
			),
		};
	},
);

export const Account = pgTable(
	"Account",
	{
		id: text("id").primaryKey().notNull(),
		userId: text("userId").notNull(),
		type: text("type").notNull(),
		provider: text("provider").notNull(),
		providerAccountId: text("providerAccountId").notNull(),
		refreshToken: text("refresh_token"),
		accessToken: text("access_token"),
		expiresAt: integer("expires_at"),
		tokenType: text("token_type"),
		scope: text("scope"),
		idToken: text("id_token"),
		sessionState: text("session_state"),
	},
	(table) => {
		return {
			providerProviderAccountIdKey: uniqueIndex(
				"Account_provider_providerAccountId_key",
			).using(
				"btree",
				table.provider.asc().nullsLast(),
				table.providerAccountId.asc().nullsLast(),
			),
			accountUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "Account_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const Bookmark = pgTable(
	"Bookmark",
	{
		id: text("id").primaryKey().notNull(),
		image: text("image"),
		title: text("title").notNull(),
		description: text("description"),
		imageHeight: text("imageHeight"),
		imageWidth: text("imageWidth"),
		locationAddress: text("locationAddress"),
		locationLat: text("locationLat"),
		locationLng: text("locationLng"),
		siteName: text("siteName").notNull(),
		url: text("url").notNull(),
		userId: text("userId").notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
	},
	(table) => {
		return {
			bookmarkUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "Bookmark_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const Chat = pgTable(
	"Chat",
	{
		id: text("id").primaryKey().notNull(),
		title: text("title").notNull(),
		userId: text("userId").notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
	},
	(table) => {
		return {
			chatUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "Chat_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const ChatMessage = pgTable(
	"ChatMessage",
	{
		id: text("id").primaryKey().notNull(),
		chatId: text("chatId").notNull(),
		userId: text("userId").notNull(),
		role: text("role").notNull(),
		content: text("content").notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
	},
	(table) => {
		return {
			chatMessageChatIdChatIdFk: foreignKey({
				columns: [table.chatId],
				foreignColumns: [Chat.id],
				name: "ChatMessage_chatId_Chat_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
			chatMessageUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "ChatMessage_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const Flight = pgTable(
	"Flight",
	{
		id: text("id").primaryKey().notNull(),
		flightNumber: text("flightNumber").notNull(),
		departureAirport: text("departureAirport").notNull(),
		departureDate: timestamp("departureDate", { mode: "string" }).notNull(),
		arrivalDate: timestamp("arrivalDate", { mode: "string" }).notNull(),
		arrivalAirport: text("arrivalAirport").notNull(),
		airline: text("airline").notNull(),
		reservationNumber: text("reservationNumber").notNull(),
		url: text("url").notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		userId: text("userId").notNull(),
		listId: text("listId"),
	},
	(table) => {
		return {
			flightUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "Flight_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
			flightListIdListIdFk: foreignKey({
				columns: [table.listId],
				foreignColumns: [List.id],
				name: "Flight_listId_List_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const List = pgTable(
	"List",
	{
		id: text("id").primaryKey().notNull(),
		name: text("name").notNull(),
		description: text("description"),
		userId: text("userId").notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
	},
	(table) => {
		return {
			listUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "List_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const Idea = pgTable(
	"Idea",
	{
		id: text("id").primaryKey().notNull(),
		description: text("description").notNull(),
		userId: text("userId").notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
	},
	(table) => {
		return {
			ideaUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "Idea_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const Item = pgTable(
	"Item",
	{
		id: text("id").primaryKey().notNull(),
		type: text("type").notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		itemId: text("itemId").notNull(),
		listId: text("listId").notNull(),
		userId: text("userId").notNull(),
		itemType: itemType("itemType").default("PLACE").notNull(),
	},
	(table) => {
		return {
			listIdItemIdKey: uniqueIndex("Item_listId_itemId_key").using(
				"btree",
				table.listId.asc().nullsLast(),
				table.itemId.asc().nullsLast(),
			),
			itemListIdListIdFk: foreignKey({
				columns: [table.listId],
				foreignColumns: [List.id],
				name: "Item_listId_List_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("restrict"),
			itemUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "Item_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const Token = pgTable(
	"Token",
	{
		id: serial("id").primaryKey().notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		type: tokenType("type").notNull(),
		emailToken: text("emailToken"),
		valid: boolean("valid").default(true).notNull(),
		expiration: timestamp("expiration", {
			precision: 3,
			mode: "string",
		}).notNull(),
		userId: text("userId").notNull(),
		accessToken: text("accessToken"),
		refreshToken: text("refreshToken"),
	},
	(table) => {
		return {
			accessTokenKey: uniqueIndex("Token_accessToken_key").using(
				"btree",
				table.accessToken.asc().nullsLast(),
			),
			emailTokenKey: uniqueIndex("Token_emailToken_key").using(
				"btree",
				table.emailToken.asc().nullsLast(),
			),
			refreshTokenKey: uniqueIndex("Token_refreshToken_key").using(
				"btree",
				table.refreshToken.asc().nullsLast(),
			),
			tokenUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "Token_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("restrict"),
		};
	},
);

export const Movie = pgTable("Movie", {
	id: text("id").primaryKey().notNull(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	image: text("image").notNull(),
	director: text("director"),
	userId: text("userId").notNull(),
	createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
		.defaultNow()
		.notNull(),
});

export const MovieViewings = pgTable(
	"MovieViewings",
	{
		id: text("id").primaryKey().notNull(),
		movieId: text("movieId").notNull(),
		userId: text("userId").notNull(),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
	},
	(table) => {
		return {
			movieViewingsMovieIdMovieIdFk: foreignKey({
				columns: [table.movieId],
				foreignColumns: [Movie.id],
				name: "MovieViewings_movieId_Movie_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
			movieViewingsUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "MovieViewings_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const Place = pgTable(
	"Place",
	{
		id: text("id").primaryKey().notNull(),
		name: text("name").notNull(),
		description: text("description"),
		address: text("address"),
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		userId: text("userId").notNull(),
		itemId: text("itemId"),
		googleMapsId: text("googleMapsId"),
		types: text("types").array(),
		imageUrl: text("imageUrl"),
		phoneNumber: text("phoneNumber"),
		rating: doublePrecision("rating"),
		websiteUri: text("websiteUri"),
		latitude: doublePrecision("latitude"),
		longitude: doublePrecision("longitude"),
	},
	(table) => {
		return {
			placeUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "Place_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
			placeItemIdItemIdFk: foreignKey({
				columns: [table.itemId],
				foreignColumns: [Item.id],
				name: "Place_itemId_Item_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const Session = pgTable(
	"Session",
	{
		id: text("id").primaryKey().notNull(),
		sessionToken: text("sessionToken").notNull(),
		userId: text("userId").notNull(),
		expires: timestamp("expires", { precision: 3, mode: "string" }).notNull(),
	},
	(table) => {
		return {
			sessionTokenKey: uniqueIndex("Session_sessionToken_key").using(
				"btree",
				table.sessionToken.asc().nullsLast(),
			),
			sessionUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "Session_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
		};
	},
);

export const UserLists = pgTable(
	"UserLists",
	{
		createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updatedAt", { precision: 3, mode: "string" })
			.defaultNow()
			.notNull(),
		listId: text("listId").notNull(),
		userId: text("userId").notNull(),
	},
	(table) => {
		return {
			userListsListIdListIdFk: foreignKey({
				columns: [table.listId],
				foreignColumns: [List.id],
				name: "UserLists_listId_List_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
			userListsUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "UserLists_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
			userListsPkey: primaryKey({
				columns: [table.listId, table.userId],
				name: "UserLists_pkey",
			}),
		};
	},
);

export const ListInvite = pgTable(
	"ListInvite",
	{
		accepted: boolean("accepted").default(false).notNull(),
		listId: text("listId").notNull(),
		invitedUserEmail: text("invitedUserEmail").notNull(),
		invitedUserId: text("invitedUserId"),
		userId: text("userId").notNull(),
	},
	(table) => {
		return {
			listInviteListIdListIdFk: foreignKey({
				columns: [table.listId],
				foreignColumns: [List.id],
				name: "ListInvite_listId_List_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
			listInviteInvitedUserIdUserIdFk: foreignKey({
				columns: [table.invitedUserId],
				foreignColumns: [User.id],
				name: "ListInvite_invitedUserId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
			listInviteUserIdUserIdFk: foreignKey({
				columns: [table.userId],
				foreignColumns: [User.id],
				name: "ListInvite_userId_User_id_fk",
			})
				.onUpdate("cascade")
				.onDelete("cascade"),
			listInvitePkey: primaryKey({
				columns: [table.listId, table.invitedUserEmail],
				name: "ListInvite_pkey",
			}),
		};
	},
);
