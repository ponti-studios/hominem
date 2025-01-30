import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { db } from "../db";
import { User } from "../db/drizzle/schema";
import type { RequestWithSession } from "../typings";
import { verifySession } from "./auth/utils";

const usersPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
	server.get<{
		Querystring: object;
		Headers: object;
		Reply: typeof User.$inferSelect;
	}>(
		"/me",
		{
			preValidation: verifySession,
		},
		async (request: RequestWithSession, reply) => {
			const { userId } = request.session.get("data");

			try {
				const foundUser = await db
					.select()
					.from(User)
					.where(eq(User.id, userId))
					.limit(1);

				/**
				 * If user does not exist, then we should delete their
				 * session and return a 401.
				 */
				if (!foundUser) {
					request.session.delete();
					return reply.code(401).send();
				}

				return reply.code(200).send(foundUser[0]);
			} catch (err) {
				request.log.info("Could not fetch user", { err });
				return reply.code(500).send();
			}
		},
	);

	server.delete(
		"/me",
		{
			preValidation: verifySession,
		},
		async (request, reply) => {
			const { userId } = request.session.data;
			await db.delete(User).where(eq(User.id, userId));
			return true;
		},
	);
};

export default fp(usersPlugin);
