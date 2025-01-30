import { eq } from "drizzle-orm";
import { db } from "../db";
import { Account } from "../db/drizzle/schema";

export function getUserAccount(userId: string) {
	return db.select().from(Account).where(eq(Account.userId, userId)).limit(1);
}
