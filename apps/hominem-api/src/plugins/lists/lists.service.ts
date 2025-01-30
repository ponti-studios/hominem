import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { List, User, UserLists } from "../../db/drizzle/schema";

export async function getUserLists(userId: string) {
	return db
		.select()
		.from(UserLists)
		.where(eq(UserLists.userId, userId))
		.leftJoin(List, eq(UserLists.listId, List.id))
		.leftJoin(User, eq(UserLists.userId, User.id))
		.orderBy(desc(List.createdAt));
}
