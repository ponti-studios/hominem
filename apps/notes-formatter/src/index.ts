import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'node:fs';
import {OpenAI} from 'openai/index.mjs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChunksByHeading {
  [heading: string]: string[];
}

const INSTRUCTIONS = `
Please do the following with the provided text.

* Condense: Summarize the main points of the notes, removing unnecessary details or redundancies.
* Format: Improve readability with clear headings, bullet points, or numbered lists where appropriate.
* Rewrite: Ensure the text is clear, concise, and easy to understand.
* Correct: Fix any grammatical or spelling errors.
* Add: Include any missing information that would make the text more comprehensive.
* Remove: Omit irrelevant, duplicate or unnecessary information.
`;

function* chatGenerator() {
  // Process the notes
  processMarkdownNotes(markdownFilePath);
}
async function processMarkdownNotes(markdownFilePath: string) {
  fs.readFile(markdownFilePath, 'utf8', async (err, markdownData) => {
    if (err) {
      console.error(err);
      return;
    }

    // Group notes by H2 headings
    const chunkedNotes: ChunksByHeading = groupNotesByH2(markdownData);

    // Process each chunk with ChatGPT (modify as needed)
    for (const [heading, notes] of Object.entries(chunkedNotes)) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `
                ${INSTRUCTIONS}

                **Heading:** ${heading}

                **Text:**
                ${notes.join('\n')}
              `,
            },
          ],
          temperature: 0.5,
        });

        const processedNotes = response.choices[0].message.content;

        // Save the processed notes to a file
        fs.appendFile(
          'processed_notes.md',
          `## ${heading}\n${processedNotes}\n\n`,
          err => {
            if (err) {
              console.error(
                `Error saving processed notes for heading: ${heading}`,
                err
              );
            }
          }
        );
      } catch (error) {
        console.error(`Error processing chunk with heading: ${heading}`, {
          message: (error as any)?.response?.data?.error?.message,
        });
      }
    }
  });
}

function groupNotesByH2(markdownData: string): ChunksByHeading {
  const lines = markdownData.split('\n');
  const chunkedNotes: ChunksByHeading = {};
  let currentHeading: string | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentHeading = line.slice(3).trim();
      chunkedNotes[currentHeading] = [];
    } else if (currentHeading) {
      chunkedNotes[currentHeading].push(line);
    }
  }

  return chunkedNotes;
}

// Capture the markdown file path from the command line arguments
const markdownFilePath = process.argv[2];
if (!markdownFilePath) {
  console.error('Please provide a path to the markdown file.');
  process.exit(1);
}

// Process the notes
processMarkdownNotes(markdownFilePath);
