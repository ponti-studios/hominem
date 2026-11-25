# Instagram (custom.instagram)

Unofficial, read-only integration. There is no official personal API,
and Instagram's session cookie (`sessionid`) is HttpOnly — a
YTM-style cookie harvest can never authenticate against it. Reads
therefore run IN-PAGE, inside the signed-in Chrome, driven through
the Browser MCP daemon.

## Architecture (FINAL, 2026-11-22): Mac-local toolkit + logged wrapper

- `~/ig-tools/ig` — Mac-local toolkit (Node, no deps). Each
  invocation: spawn its own MCP stdio client against the Browser MCP
  daemon (port 9010 — the same daemon behind the `browsermcp` MCP
  server, driving Charles's real Chrome), `goto` the automation tab,
  run one eval, close the tab — success or failure. 60s total
  timeout; failure payloads carry diagnostics (title, href, link
  count) so a broken page state explains itself in the audit trail.
- **Read surface: the SSR SEO meta description.** Every profile page
  server-renders `<meta name="description">` in a shape that has
  held for a decade:

  `9 Followers, 31 Following, 38 Posts - Full Name (@handle) on Instagram: "Full Name\nbio lines"`

  Counts stay strings ("1,024", "1.2M") — rendering is the caller's
  business. Evals do nothing but extract raw text (single quotes
  only — the eval arg is double-quoted); ALL parsing happens
  Node-side (`parseMeta`), including the quoted-bio block and the
  display-name-first-line dedupe. A meta that exists but does not
  parse fails honestly — that page was not a profile.

- Hominem's surface is `hominem instagram <cmd...>`: a transparent,
  logged passthrough (`connectors/instagram/instagram.ts`) — stdout,
  stderr and exit code pass through unchanged, and every invocation
  records ONE audit row in `~/.hominem/agent.db` (events, connector
  "instagram"). An in-band `{ok:false}` payload from the toolkit
  marks the row as an error even at exit 0 — browser-transport
  failures report themselves in-band. The CLI resolves from the
  IG_CLI environment variable (law 4: no machine paths); the daemon
  binary from IG_BROWSER_BIN or PATH. No credential is ever read,
  stored, or printed: the browser owns the session.

## Status

Built and live-verified 2026-11-22: `hominem instagram profile
thecharlieponti` and `hominem instagram me` both returned the full
parsed profile through the logged wrapper — events rows 159/160,
ok, no credential material anywhere in the rows.

## Route history (why the meta description — all verified live 2026-11-22)

- `/api/v1/users/web_profile_info/` — the classic REST endpoint is
  DEAD: 404 with the server-rendered not-logged-in HTML in every
  header variant (plain, `x-ig-app-id`, +`x-csrftoken`). Do not
  port anything that calls it.
- `/api/graphql` — the only data source the web app uses now (8
  calls per profile load), with opaque rotating doc ids. Not a
  durable contract; not built against.
- Monkey-patch capture — dead end: profile links do full page
  loads, and a reload wipes the patch before it records anything.
- The retired extension route (archived
  `custom.playwright-chrome`) died with its Chrome extension; the
  revival server ran but no connect page ever appeared. The daemon
  transport replaced it entirely.

## Auth

None to manage. The browser owns the session — the toolkit never
touches cookies. If `me` starts failing with no viewer handle
found, the Chrome session probably expired: sign into
instagram.com in Chrome, then re-run. The toolkit's failure payload
carries the diagnostics to confirm.

## Helper

`hominem instagram <cmd...>` (through the logged wrapper; one JSON
object per call):

- `profile <handle>` — one profile: handle (cross-checked against
  the request — a mismatch fails loudly instead of returning
  someone else's profile), full name, followers/following/posts as
  formatted strings, bio.
- `me` — discover the viewer's handle on the homepage (nav avatar
  alt text `handle's profile picture` → nav links → document links
  minus known routes), then read that profile the same way.

## Limits and failure behaviour

- Read-only v1 (profile / me). Mutations would need the graphql
  contract — not built, don't fake it.
- `me`'s handle discovery is heuristic. On failure the payload
  carries diagnostics — read them, don't retry blind.
- Private profiles parse the same meta; `is_private` is not exposed
  v1. A not-found page reports honestly: the meta either misses or
  does not parse, and the payload says which.
- One automation tab through the daemon: never run concurrent
  browser-transport commands (two instagram runs, or an instagram
  run while browsermcp drives the same tab).
- A failed or empty result is a result: report it, never invent
  content.
