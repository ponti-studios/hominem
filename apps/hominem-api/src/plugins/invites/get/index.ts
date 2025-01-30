import { and, asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../../../db";
import { List, ListInvite, User } from "../../../db/drizzle/schema";
import type { RequestWithSession } from "../../../typings";
import { verifySession } from "../../auth/utils";

const getUserInvitesRoute = (server: FastifyInstance) => {
	server.get(
		"/invites",
		{
			preValidation: verifySession,
			schema: {
				response: {
					200: {
						type: "array",
						items: {
							type: "object",
							properties: {
								accepted: { type: "boolean" },
								listId: { type: "string" },
								invitedUserEmail: { type: "string" },
								invitedUserId: { type: "string" },
								// The user who created the invite
								list: {
									type: "object",
									properties: {
										id: { type: "string" },
										name: { type: "string" },
									},
								},
								user: {
									type: "object",
									properties: {
										id: { type: "string" },
										email: { type: "string" },
										name: { type: "string" },
									},
								},
								createdAt: { type: "string" },
								updatedAt: { type: "string" },
							},
						},
					},
				},
			},
		},
		async (request: RequestWithSession, reply) => {
			const { userId } = request.session.get("data");
			const invites = await db
				.select()
				.from(ListInvite)
				.where(
					and(
						eq(ListInvite.invitedUserId, userId),
						eq(ListInvite.accepted, false),
					),
				)
				.leftJoin(List, eq(List.id, ListInvite.listId))
				.leftJoin(User, eq(User.id, ListInvite.userId))
				.orderBy(asc(ListInvite.listId));

			return reply.status(200).send(invites);
		},
	);

	server.get(
		"/invites/outgoing",
		{
			preValidation: verifySession,
			schema: {
				response: {
					200: {
						type: "array",
						items: {
							type: "object",
							properties: {
								accepted: { type: "boolean" },
								listId: { type: "string" },
								invitedUserEmail: { type: "string" },
								invitedUserId: { type: "string" },
								// The user who created the invite
								user: {
									type: "object",
									properties: {
										id: { type: "string" },
										email: { type: "string" },
										name: { type: "string" },
									},
								},
								createdAt: { type: "string" },
								updatedAt: { type: "string" },
							},
						},
					},
				},
			},
		},
		async (request: RequestWithSession, reply) => {
			const { userId } = request.session.get("data");
			const invites = await db
				.select()
				.from(ListInvite)
				.where(and(eq(ListInvite.userId, userId)));

			return reply.status(200).send(invites);
		},
	);
};

export default getUserInvitesRoute;
