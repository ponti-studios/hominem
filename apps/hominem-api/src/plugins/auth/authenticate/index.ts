import { add } from "date-fns";
import { and, eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { APP_USER_ID, EVENTS, track } from "../../../analytics";
import { db, takeUniqueOrThrow } from "../../../db";
import { List, Token, User } from "../../../db/drizzle/schema";

interface AuthenticateInput {
	email: string;
	emailToken: string;
}

export const TOKEN_FAILURE_REASONS = {
	EXPIRED: "expired",
	INVALID: "token_invalid",
	NOT_FOUND: "token_not_found",
	EMAIL_MISMATCH: "email_mismatch",
} as const;

const AUTHENTICATION_TOKEN_EXPIRATION_HOURS = 12;

const authenticatePlugin: FastifyPluginAsync = async (server) => {
	server.post<{ Body: AuthenticateInput }>(
		"/authenticate",
		{
			schema: {
				body: {
					type: "object",
					required: ["email", "emailToken"],
					properties: {
						email: { type: "string" },
						emailToken: { type: "string" },
					},
				},
			},
		},
		async (request, reply) => {
			// 👇 get the email and emailToken from the request payload
			const { email, emailToken } = request.body as AuthenticateInput;

			// Get short lived email token
			const tokenResults = await db
				.selectDistinct()
				.from(Token)
				.where(eq(Token.emailToken, emailToken))
				.leftJoin(User, eq(User.id, Token.userId));

			if (!tokenResults || tokenResults.length === 0) {
				reply.log.error("Login token does not exist");
				track(APP_USER_ID, EVENTS.USER_EVENTS.EMAIL_TOKEN_VALIDATED_FAILURE, {
					reason: TOKEN_FAILURE_REASONS.NOT_FOUND,
				});
				return reply.code(400).send("Invalid token");
			}

			const [fetchedEmailToken] = tokenResults;
			if (!fetchedEmailToken.Token.valid) {
				request.session.delete();
				reply.log.error("Login token is not valid");
				track(APP_USER_ID, EVENTS.USER_EVENTS.EMAIL_TOKEN_VALIDATED_FAILURE, {
					reason: TOKEN_FAILURE_REASONS.INVALID,
				});
				return reply.code(401).send();
			}

			if (new Date(fetchedEmailToken.Token.expiration) < new Date()) {
				// If the token has expired, return 401 unauthorized
				request.session.delete();
				reply.log.error("Login token has expired");
				track(APP_USER_ID, EVENTS.USER_EVENTS.EMAIL_TOKEN_VALIDATED_FAILURE, {
					reason: TOKEN_FAILURE_REASONS.EXPIRED,
				});
				return reply.code(401).send("Token expired");
			}

			if (!fetchedEmailToken.User) {
				// If the user doesn't exist, create a new user
				request.session.delete();
				return reply.code(401).send();
			}

			if (fetchedEmailToken.User.email !== email) {
				request.session.delete();
				// If token doesn't match the email passed in the payload, return 401 unauthorized
				reply.log.error("Token email does not match email");
				track(APP_USER_ID, EVENTS.USER_EVENTS.EMAIL_TOKEN_VALIDATED_FAILURE, {
					reason: TOKEN_FAILURE_REASONS.EMAIL_MISMATCH,
				});
				return reply.code(401).send();
			}

			const tokenBase = {
				isAdmin: fetchedEmailToken.User.isAdmin,
				roles: ["user", !!fetchedEmailToken.User.isAdmin && "admin"].filter(
					Boolean,
				),
				userId: fetchedEmailToken.User.id,
			};

			const accessToken = server.jwt.sign(tokenBase);
			const refreshToken = crypto.randomUUID();

			const newUser = await db.transaction(async (t) => {
				// 👇 Check if the user already exists
				const existingUser = await t
					.select()
					.from(User)
					.where(eq(User.email, email))
					.execute();

				if (existingUser.length > 0) {
					// If the user exists, return the existing user
					return existingUser[0];
				}

				const [createdUser] = await t
					.insert(User)
					.values({
						id: crypto.randomUUID(),
						email,
					})
					.returning();

				// 👇 create a list for the new user
				await t.insert(List).values({
					id: crypto.randomUUID(),
					name: "General",
					userId: createdUser.id,
				});

				// 👇 create a long lived token for the new user
				await t.insert(Token).values({
					userId: createdUser.id,
					type: "API",
					accessToken,
					refreshToken,
					expiration: add(new Date(), {
						hours: AUTHENTICATION_TOKEN_EXPIRATION_HOURS,
					}).toISOString(),
				});

				//👇 Invalidate the email token after it's been used
				await t
					.update(Token)
					.set({
						valid: false,
					})
					.where(
						and(
							eq(Token.id, fetchedEmailToken.Token.id),
							eq(Token.type, "EMAIL"),
						),
					);

				return createdUser;
			});

			const { id: userId, isAdmin, name } = newUser;
			const responseUser = {
				...tokenBase,
				name,
			};

			track(userId, EVENTS.USER_EVENTS.LOGIN_SUCCESS, { isAdmin });

			request.session.set("data", responseUser);

			return reply
				.code(200)
				.send({ user: responseUser })
				.headers({
					Authorization: `Bearer ${accessToken}`,
				});
		},
	);
};

export default authenticatePlugin;
