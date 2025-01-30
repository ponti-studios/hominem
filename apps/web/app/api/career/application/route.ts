import { ApplicationService } from "@ponti/utils/career";

export async function POST(req: Request) {
	const applicationService = new ApplicationService();
	const data = await req.json();

	const application = await applicationService.create({
		...data,
		company: data.company,
		position: data.position,
		status: "pending",
	});

	return Response.json(application, { status: 201 });
}

// export async function PUT(req: Request) {
// 	const applicationService = new ApplicationService();
// 	const { id, ...data } = await req.json();

// 	const updated = await applicationService.update(id, data);
// 	if (!updated) {
// 		return Response.json({ error: "Application not found" }, { status: 404 });
// 	}

// 	return Response.json(updated, { status: 200 });
// }

// export async function GET(req: Request) {
// 	const applicationService = new ApplicationService();
// 	const { searchParams } = new URL(req.url);
// 	const id = searchParams.get("id");

// 	if (id) {
// 		const application = await applicationService.findById(id);
// 		if (!application) {
// 			return Response.json({ error: "Application not found" }, { status: 404 });
// 		}
// 		return Response.json(application);
// 	}

// 	const applications = await applicationService.findMany();
// 	return Response.json(applications);
// }

// export async function DELETE(req: Request) {
// 	const applicationService = new ApplicationService();
// 	const { searchParams } = new URL(req.url);
// 	const id = searchParams.get("id");

// 	if (!id) {
// 		return Response.json({ error: "ID is required" }, { status: 400 });
// 	}

// 	const deleted = await applicationService.delete(id);
// 	if (!deleted) {
// 		return Response.json({ error: "Application not found" }, { status: 404 });
// 	}

// 	return new Response(null, { status: 204 });
// }
