import quotes from "./steve-jobs.json";

export async function GET(req: Request) {
	return Response.json({
		data: quotes[Math.floor(Math.random() * quotes.length)],
	});
}
