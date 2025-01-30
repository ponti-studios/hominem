import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { db } from "../../db";
import { Idea } from "../../db/drizzle/schema";
import type { RequestWithSession } from "../../typings";
import { verifySession } from "../auth/utils";

const ideaSchema = {
	type: "object",
	properties: {
		id: { type: "string" },
		description: { type: "string" },
		createdAt: { type: "string" },
		updatedAt: { type: "string" },
	},
};
const ideasPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
	server.get(
		"/ideas",
		{
			preValidation: verifySession,
			schema: {
				response: {
					200: {
						type: "array",
						items: ideaSchema,
					},
				},
			},
		},
		async (request: RequestWithSession) => {
			const { userId } = request.session.get("data");
			const ideas = await db
				.select()
				.from(Idea)
				.where(eq(Idea.userId, userId))
				.orderBy(desc(Idea.createdAt));
			return ideas;
		},
	);

	server.post(
		"/ideas",
		{
			preValidation: verifySession,
			schema: {
				body: {
					type: "object",
					properties: {
						description: { type: "string" },
					},
					required: ["description"],
				},
				response: {
					200: ideaSchema,
				},
			},
		},
		async (request: RequestWithSession) => {
			const { description } = request.body as { description: string };
			const { userId } = request.session.get("data");
			const idea = await db.insert(Idea).values({
				id: crypto.randomUUID(),
				description,
				userId,
			});
			return idea;
		},
	);

	server.delete(
		"/ideas/:id",
		{
			preValidation: verifySession,
			schema: {
				params: {
					type: "object",
					properties: {
						id: { type: "string" },
					},
					required: ["id"],
				},
				response: {
					200: ideaSchema,
				},
			},
		},
		async (request: RequestWithSession) => {
			const { id } = request.params as { id: string };
			const { userId } = request.session.get("data");
			await db
				.delete(Idea)
				.where(and(eq(Idea.userId, userId), eq(Idea.id, id)));
			return true;
		},
	);
};

export default ideasPlugin;
