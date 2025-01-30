import { z } from "zod";
import { generateObject } from "ai";
import { createOllama } from "ollama-ai-provider";

import type { BulletPoint, EnhancedBulletPoint } from "../types";

export const ollama = createOllama({
	// baseURL: "http://127.0.0.1:11434/v1",
});

const BulletPointSchema = z.object({
	improvedText: z.string(),
	categories: z.array(z.string()),
});

export async function enhanceBulletPoint(
	text: string,
): Promise<z.infer<typeof BulletPointSchema>> {
	const prompt = `
    Please improve the following text for clarity and conciseness, and provide up to 3 relevant categories:
  
    Original text: "${text}"
  `;

	const response = await generateObject({
		model: ollama("phi4"),
		prompt,
		schema: BulletPointSchema,
	});

	return response.object;
}

export async function enhanceBulletPoints(
	bullets: BulletPoint[],
	onProgress?: (current: number, total: number) => void,
): Promise<EnhancedBulletPoint[]> {
	const enhanced: EnhancedBulletPoint[] = [];

	for (let i = 0; i < bullets.length; i++) {
		const bullet = bullets[i];
		try {
			const { improvedText, categories } = await enhanceBulletPoint(
				bullet.text,
			);
			enhanced.push({
				...bullet,
				improvedText,
				categories,
			});

			if (onProgress) {
				onProgress(i + 1, bullets.length);
			}
		} catch (error) {
			console.error(`Error processing bullet: ${bullet.text}`, error);
			// Keep original text if enhancement fails
			enhanced.push({
				...bullet,
				improvedText: bullet.text,
				categories: [],
			});
		}

		// Add delay to avoid rate limiting
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	return enhanced;
}
