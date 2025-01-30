import { add } from "date-fns";
import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../../db";
import { createServer } from "../../../server";

vi.mock("../../../db", async () => {
	const actual = await vi.importActual("../../../db");
	return {
		...actual,
		db: {
			selectDistinct: vi.fn(),
			transaction: vi.fn(),
		},
	};
});

vi.mock("../../../analytics", () => ({
	APP_USER_ID: "app_user_id",
	EVENTS: {
		USER_EVENTS: {
			EMAIL_TOKEN_VALIDATED_FAILURE: "email_token_validated_failure",
			LOGIN_SUCCESS: "login_success",
		},
	},
	track: vi.fn(),
}));

describe("authenticatePlugin", () => {
	let server: FastifyInstance;

	beforeEach(async () => {
		const testServer = await createServer({ logger: false });
		if (!testServer) {
			throw new Error("Server is null");
		}
		server = testServer;
		await server.ready();
	});

	it("should authenticate a user with valid token", async () => {
		const mockUser = {
			id: "user_id",
			email: "test@example.com",
			isAdmin: false,
		};
		const mockToken = {
			id: "token_id",
			emailToken: "valid_token",
			valid: true,
			expiration: add(new Date(), { hours: 1 }).toISOString(),
		};

		vi.mocked(db.selectDistinct).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					leftJoin: vi.fn().mockReturnValue(
						Promise.resolve([
							{
								Token: mockToken,
								User: mockUser,
							},
						]),
					),
				}),
			}),
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} as any);

		vi.mocked(db.transaction).mockImplementation(async (callback) => {
			return callback({
				select: vi.fn().mockReturnValue({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							execute: vi.fn().mockResolvedValue([mockUser]),
						}),
					}),
				}),
				update: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue({}),
					}),
				}),
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			} as any);
		});

		const response = await server.inject({
			method: "POST",
			url: "/authenticate",
			payload: {
				email: "test@example.com",
				emailToken: "valid_token",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.payload)).toEqual({
			user: {
				isAdmin: false,
				roles: ["user"],
				userId: "user_id",
			},
		});
		expect(response.headers).toHaveProperty("set-cookie");
	});

	it("should return 400 for non-existent token", async () => {
		vi.mocked(db.selectDistinct).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					leftJoin: vi.fn().mockReturnValue(Promise.resolve(null)),
				}),
			}),
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} as any);

		const response = await server.inject({
			method: "POST",
			url: "/authenticate",
			payload: {
				email: "test@example.com",
				emailToken: "invalid_token",
			},
		});

		expect(response.statusCode).toBe(400);
		expect(response.payload).toBe("Invalid token");
	});

	it("should return 401 for invalid token", async () => {
		vi.mocked(db.selectDistinct).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					leftJoin: vi.fn().mockReturnValue(
						Promise.resolve([
							{
								Token: { valid: false },
								User: { email: "test@example.com" },
							},
						]),
					),
				}),
			}),
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} as any);

		const response = await server.inject({
			method: "POST",
			url: "/authenticate",
			payload: {
				email: "test@example.com",
				emailToken: "invalid_token",
			},
		});

		expect(response.statusCode).toBe(401);
		expect(db.selectDistinct).toHaveBeenCalled();
	});

	it("should return 401 for expired token", async () => {
		vi.mocked(db.selectDistinct).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					leftJoin: vi.fn().mockReturnValue(
						Promise.resolve([
							{
								Token: {
									valid: true,
									expiration: add(new Date(), { hours: -1 }).toISOString(),
								},
								User: { email: "test@example.com" },
							},
						]),
					),
				}),
			}),
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} as any);

		const response = await server.inject({
			method: "POST",
			url: "/authenticate",
			payload: {
				email: "test@example.com",
				emailToken: "expired_token",
			},
		});

		expect(response.statusCode).toBe(401);
		expect(response.payload).toBe("Token expired");
	});

	it("should return 401 for email mismatch", async () => {
		vi.mocked(db.selectDistinct).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					leftJoin: vi.fn().mockReturnValue(
						Promise.resolve([
							{
								Token: {
									valid: true,
									expiration: add(new Date(), { hours: 1 }).toISOString(),
								},
								User: { email: "different@example.com" },
							},
						]),
					),
				}),
			}),
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} as any);

		const response = await server.inject({
			method: "POST",
			url: "/authenticate",
			payload: {
				email: "test@example.com",
				emailToken: "valid_token",
			},
		});

		expect(response.statusCode).toBe(401);
	});
});
