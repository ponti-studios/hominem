import { desc, eq, type InferInsertModel } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { EVENTS, track } from "../../analytics";
import { db, takeUniqueOrThrow } from "../../db";
import { List, User } from "../../db/drizzle/schema";
import type { RequestWithSession } from "../../typings";
import { verifySession } from "../auth/utils";
import acceptListInviteRoute from "./accept-invite/route";
import getListInvitesRoute from "./invites";
import { deleteListItemRoute, getListRoute } from "./list";
import { getUserLists } from "./lists.service";

// Cron jobs
// import addPhotoToPlaces from "./crons/addPhotoToPlaces";
// import migrateLatLngFloat from "./crons/migrateLatLngFloat";

const listsPlugin: FastifyPluginAsync = async (server) => {
	server.get(
		"/lists",
		{
			preValidation: verifySession,
		},
		async (request: RequestWithSession) => {
			const { userId } = request.session.get("data");
			const lists = await db
				.select()
				.from(List)
				.where(eq(List.userId, userId))
				.leftJoin(User, eq(List.userId, User.id))
				.orderBy(desc(List.createdAt));
			const userLists = await getUserLists(userId);

			return [
				...lists,
				...userLists.map(({ List, User }) => ({
					...List,
					createdBy: {
						email: User?.email,
					},
				})),
			];
		},
	);

	server.post(
		"/lists",
		{
			preValidation: verifySession,
			schema: {
				body: {
					type: "object",
					required: ["name"],
					properties: {
						name: {
							type: "string",
							minLength: 3,
							maxLength: 50,
						},
					},
				},
				response: {
					200: {
						type: "object",
						properties: {
							list: {
								type: "object",
								properties: {
									id: { type: "string" },
									name: { type: "string" },
									createdAt: { type: "string" },
									updatedAt: { type: "string" },
								},
							},
						},
					},
				},
			},
		},
		async (
			request: RequestWithSession,
		): Promise<{ list: InferInsertModel<typeof List> }> => {
			const { name } = request.body as { name: string };
			const { userId } = request.session.get("data");
			const list = await db
				.insert(List)
				.values({
					id: crypto.randomUUID(),
					name,
					userId,
				})
				.returning()
				.then(takeUniqueOrThrow);

			track(userId, EVENTS.USER_EVENTS.LIST_CREATED, { name });

			return { list };
		},
	);

	server.put(
		"/lists/:id",
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
				body: {
					type: "object",
					properties: {
						name: { type: "string" },
					},
					required: ["name"],
				},
				response: {
					200: {
						type: "object",
						properties: {
							list: {
								type: "object",
								properties: {
									id: { type: "string" },
									name: { type: "string" },
									createdAt: { type: "string" },
									updatedAt: { type: "string" },
								},
							},
						},
					},
				},
			},
		},
		async (request) => {
			const { id, name } = request.body as { id: string; name: string };
			const list = await db
				.update(List)
				.set({
					name,
				})
				.where(eq(List.id, id))
				.returning();
			return { list };
		},
	);

	server.delete(
		"/lists/:id",
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
			},
		},
		async (request, reply) => {
			const { id } = request.params as { id: string };

			await db.delete(List).where(eq(List.id, id));

			return reply.status(204).send();
		},
	);

	acceptListInviteRoute(server);
	deleteListItemRoute(server);
	getListRoute(server);
	getListInvitesRoute(server);

	// Cron jobs
	// if (process.env.NODE_ENV !== "test") {
	// addPhotoToPlaces(server).catch((err) => {
	//   console.error("Error adding photo to place", err);
	// });
	// migrateLatLngFloat(server).catch((err) => {
	//   console.error("Error migrating lat and lng", err);
	// });
	// }
};

export default fastifyPlugin(listsPlugin);
