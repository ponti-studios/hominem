import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, takeUniqueOrThrow } from "../../db";
import { Item, List, Place } from "../../db/drizzle/schema";
import { verifySession } from "../auth/utils";

async function getListPlaces(listId: string): Promise<
	{
		id: string;
		itemId: string;
		description: string | null;
		itemAddedAt: string;
		googleMapsId: string | null;
		name: string;
		imageUrl: string | null;
		type: string;
		types: string[] | null;
	}[]
> {
	const listPlaces = await db
		.select({
			id: Item.id,
			itemId: Item.itemId,
			description: Place.description,
			itemAddedAt: Item.createdAt,
			googleMapsId: Place.googleMapsId,
			name: Place.name,
			imageUrl: Place.imageUrl,
			types: Place.types,
			type: Item.type,
		})
		.from(Item)
		.innerJoin(Place, eq(Item.itemId, Place.id))
		.where(eq(Item.listId, listId));

	return listPlaces;
}

export const getListRoute = (server: FastifyInstance) => {
	server.get(
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
				response: {
					200: {
						type: "object",
						properties: {
							id: { type: "string" },
							name: { type: "string" },
							createdAt: { type: "string" },
							updatedAt: { type: "string" },
							userId: { type: "string" },
							items: {
								type: "array",
								items: {
									type: "object",
									properties: {
										id: { type: "string" },
										itemId: { type: "string" },
										description: { type: "string" },
										itemAddedAt: { type: "string" },
										googleMapsId: { type: "string" },
										name: { type: "string" },
										imageUrl: { type: "string" },
										type: { type: "string" },
										types: { type: "array", items: { type: "string" } },
									},
								},
							},
						},
					},
				},
			},
		},
		async (request, reply) => {
			const { id } = request.params as { id: string };
			const list = await db
				.select()
				.from(List)
				.where(eq(List.id, id))
				.then(takeUniqueOrThrow);

			if (!list) {
				return reply.status(404).send("List could not be found");
			}

			const items = await getListPlaces(id);

			return { ...list, items, userId: list.userId };
		},
	);
};

export const deleteListItemRoute = async (server: FastifyInstance) => {
	server.delete(
		"/lists/:listId/items/:itemId",
		{
			preValidation: verifySession,
			schema: {
				params: {
					type: "object",
					properties: {
						listId: { type: "string" },
						itemId: { type: "string" },
					},
					required: ["listId", "itemId"],
				},
			},
		},
		async (request, reply) => {
			const { listId, itemId } = request.params as {
				itemId: string;
				listId: string;
			};

			await db
				.delete(Item)
				.where(and(eq(Item.listId, listId), eq(Item.itemId, itemId)));

			return reply.status(204).send();
		},
	);
};
