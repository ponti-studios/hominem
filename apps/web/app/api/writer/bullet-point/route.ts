import { enhanceBulletPoint } from "@ponti/utils";

export async function POST(req: Request) {
	const { content } = await req.json();
	const noteDetails = await enhanceBulletPoint(content);

	return Response.json(noteDetails, { status: 201 });
}
