// Prints a 50,000-character note to stdout, for pasting into the note editor on a device or simulator:
//
//   node apps/omiro/scripts/print-long-note.ts | pbcopy
import { longNote } from './long-note.ts';

process.stdout.write(longNote(Number(process.argv[2] ?? 50_000)));
