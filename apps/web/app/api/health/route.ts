import { NextApiRequest } from "next";
import { NextResponse } from "next/server";
import { getFlexBudget } from "utils";


export async function GET(req: NextApiRequest) {
    return NextResponse.json({ message: 'OK' });
}