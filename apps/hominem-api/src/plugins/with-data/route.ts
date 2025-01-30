import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import {
	StreamingTextResponse,
	createStreamDataTransformer,
	type Message as VercelChatMessage,
} from "ai";
import type { FastifyPluginAsync } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { formatDocumentsAsString } from "langchain/util/document";
import { openaiModel } from "../../lib/openai";

const loader = new JSONLoader("@/data/states.json", [
	"/state",
	"/code",
	"/nickname",
	"/website",
	"/admission_date",
	"/admission_number",
	"/capital_city",
	"/capital_url",
	"/population",
	"/population_rank",
	"/constitution_url",
	"/twitter_url",
]);

export const dynamic = "force-dynamic";

/**
 * Basic memory formatter that stringifies and passes
 * message history directly into the model.
 */
const formatMessage = (message: VercelChatMessage) => {
	return `${message.role}: ${message.content}`;
};

const TEMPLATE = `Answer the user's questions based only on the following context. If the answer is not in the context, reply politely that you do not have that information available.:
==============================
Context: {context}
==============================
Current conversation: {chat_history}

user: {question}
assistant:`;

const withDataPlugin: FastifyPluginAsync = async (server) => {
	server.post("/with-data", async (request, reply) => {
		try {
			// 👇 Extract the `messages` from the body of the request
			const { messages } = request.body as { messages: VercelChatMessage[] };
			// 👇 Format the previous messages
			const formattedPreviousMessages = messages
				.slice(0, -1)
				.map(formatMessage);
			// 👇 Extract the current message content
			const currentMessageContent = messages[messages.length - 1].content;
			// 👇 Load the documents
			const docs = await loader.load();

			const prompt = PromptTemplate.fromTemplate(TEMPLATE);

			/**
			 * Chat models stream message chunks rather than bytes, so this
			 * output parser handles serialization and encoding.
			 */
			const parser = new HttpResponseOutputParser();

			const chain = RunnableSequence.from([
				{
					question: (input) => input.question,
					chat_history: (input) => input.chat_history,
					context: () => formatDocumentsAsString(docs),
				},
				prompt,
				openaiModel,
				parser,
			]);

			// Convert the response into a friendly text-stream
			const stream = await chain.stream({
				chat_history: formattedPreviousMessages.join("\n"),
				question: currentMessageContent,
			});

			// Respond with the stream
			return new StreamingTextResponse(
				stream.pipeThrough(createStreamDataTransformer()),
			);

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (e: any) {
			return reply.status(500).send({ error: e.message });
		}
	});
};

export default fastifyPlugin(withDataPlugin);
