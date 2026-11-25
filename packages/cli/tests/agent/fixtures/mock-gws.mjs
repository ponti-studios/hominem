#!/usr/bin/env node
// Mock Google Workspace CLI: echoes argv and returns a canned Calendar list.
console.log(
  JSON.stringify({
    kind: 'calendar#events',
    mock: true,
    argv: process.argv.slice(2),
    items: [
      { id: 'evt1', summary: 'Hominem e2e proof', start: { dateTime: '2026-11-22T10:00:00Z' } },
    ],
  }),
);
