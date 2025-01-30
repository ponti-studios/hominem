import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

// Status/health endpoint
const statusPlugin: FastifyPluginAsync = async (server) => {
	server.get("/status", async (request) => {
		console.log("session", request.session);
		const session = request.session.get("data");
		return { up: true, isAuth: session && !!session.userId };
	});
};

export default fp(statusPlugin);
