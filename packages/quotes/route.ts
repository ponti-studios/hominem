import type {NextApiRequest} from 'next';
import {NextResponse} from 'next/server';

import quotes from './steve-jobs.json';

export async function GET(req: NextApiRequest) {
  return NextResponse.json({
    data: quotes[Math.floor(Math.random() * quotes.length)],
  });
}
