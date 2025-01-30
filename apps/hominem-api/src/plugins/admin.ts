import type { FastifyPluginAsync } from "fastify";
import { db } from "../db";
import { User } from "../db/drizzle/schema";
import { verifyIsAdmin } from "./auth/utils";

const adminPlugin: FastifyPluginAsync = async (server) => {
	server.get(
		"/admin/users",
		{
			preValidation: verifyIsAdmin,
			config: {
				summary: "Fetch all users",
				description: "Fetch all users",
				tags: ["Admin"],
			},
		},
		async (request, reply) => {
			try {
				const users = await db.select().from(User);
				return reply.code(200).send(users);
			} catch (err) {
				request.log.info("Could not fetch users", err);
				return reply.code(500).send();
			}
		},
	);
};

export default adminPlugin;
