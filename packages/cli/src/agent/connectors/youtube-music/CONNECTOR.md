# YouTube Music (custom.youtube-music)

Unofficial integration via [ytmusicapi](https://github.com/sigma67/ytmusicapi),
wrapping YouTube Music's internal web API. Chosen by Chase 2026-10-21
because it offers the full edit surface Spotify's connector lacks:
create/edit/delete playlists, add AND remove items, reorder, privacy
control, library reads.

## Architecture (FINAL, 2026-11-22): Mac-local toolkit + logged wrapper

Chase's ruling (2026-10-22): YouTube Music work runs PROGRAMMATICALLY
on his Mac — never UI clicking, never a bespoke daemon. The toolkit is
Mac-local at `~/ytm-tools` (installed 2026-11-22 from the archive's
mac-toolkit masters):

- `ytm.py` — self-contained CLI (status / playlists / playlist /
  search / create / add / add-playlist / remove / edit / delete /
  reauth), run with the toolkit venv (`~/ytm-tools/.venv`,
  ytmusicapi 1.12.3 + browser_cookie3). Auth: harvests session
  cookies from the Mac's Chrome profile at runtime into
  `~/ytm-tools/auth.json` (chmod 600) and re-harvests automatically
  on auth failure. Cookies never leave the Mac. First authenticated
  run may need Chase's one-time Keychain "Always Allow" click for
  Chrome Safe Storage.
- `~/ytm-tools/ytm` — shim executable (venv python + ytm.py), named
  by `YTM_CLI` in `~/.hominem/env` (law 4: the repo resolves it from
  env, no machine paths).

Hominem's surface is `hominem ytm <cmd...>`: a transparent, logged
passthrough (`connectors/youtube-music/ytm.ts`) — stdout, stderr and
exit code pass through unchanged, and every invocation records ONE
audit row in `~/.hominem/agent.db` (events, connector
"youtube-music"). The wrapper owns one policy: `delete` — the
irreversible command — refuses without an explicit `--yes`
(exit 3, named, no external call, nothing logged because nothing
happened).

ALWAYS require the agent's report to include playlistId, verified
final count, and full track list; spot-check against the report, and
treat unreported pieces as not done. Verify every mutation by
reading the playlist back before reporting it done.

## Status

Toolkit installed and wrapper ported 2026-11-22, live-verified the
same evening: `reauth` harvested 26 cookies and `status` read 39
library playlists (hiphop.drill at 48, the ponti.hotel line, thames —
lambs x wolves) through the logged wrapper, one events row per call.
Original trial built
and VERIFIED 2026-10-21: authenticated via browser headers; library
read (32 playlists), search, add, remove, reorder, create, edit
(title + privacy) and delete all exercised live the same evening
(proof: 20 US-drill tracks added to his existing YTM `hiphop.drill`,
28 → 48; a remove/re-add/reorder cycle on one track; a throwaway
playlist created, renamed, deleted with no residue).

## Auth

**Working auth: cookie harvest at runtime** (the toolkit's route
since the mac-toolkit build). `ytm.py` reads the signed-in Chrome
profile's cookies through browser_cookie3 itself — no DevTools paste,
no manual steps. The one-time Keychain "Always Allow" click for
Chrome Safe Storage happens on the first authenticated run. When
calls start failing with auth errors, `ytm reauth` forces a fresh
harvest; this is expected maintenance on an unofficial route, not a
bug. `~/ytm-tools/auth.json` is a session credential: chmod 600,
never echo it, never log its contents, never copy it into memory
files, docs, or chat.

**OAuth attempt (2026-10-22) — minted but rejected by the internal
API.** Chase created his own Google Cloud project + "TVs and Limited
Input devices" OAuth client; the device flow completed and oauth.json
(+ oauth_client.json, both chmod 600) held a valid token with the full
youtube scope. But every library call under the WEB_REMIX context
returns 400 badRequest: Google accepts third-party-project tokens
only for TV-shaped responses (TVHTML5 context returns 200 with
unparseable output) and the official Data API — not the web-music
context this library's parsers need. Conclusion: for the unofficial
surface, OAuth via a personal Cloud project is a dead end. The Cloud
project itself remains useful if we ever build the official Data API
route (durable, but channel-playlists only + quota).

**ytmusicapi 1.12.3 classification gotcha (found live, 2026-11-22).**
`determine_auth_type` classifies auth purely on the `authorization`
header: `SAPISIDHASH …` → browser, `Bearer …` → OAuth, anything
else → the OAuth path, which dies asking for oauth_credentials. The
old DevTools-paste route carried that header along in the paste; the
cookie-harvest route had to synthesize it — ytm.py now writes
`authorization: SAPISIDHASH <ts>_<sha1(ts + ' ' + sapisid + ' ' + origin)>`
built from the harvested `__Secure-3PAPISID` at harvest time (the
library recomputes a fresh hash per request from the same cookie, so
shape is what matters). Without it, every call fails with "oauth JSON
provided via auth argument, but oauth_credentials not provided" —
exactly what the first live run hit. The live copy at ~/ytm-tools
carries this fix; the archive master predates it.

**Setup gotcha (manual route history, 2026-10-21).** `ytmusicapi
browser` mis-parses HTTP/2 pseudo-headers in a pasted DevTools block
(`:authority`, `:method`, `:path`, `:scheme`) into junk header
entries in browser.json; requests carrying them are silently dropped
by the egress proxy. After any manual browser.json setup: sanitize to
the real headers, chmod 600, test with `status`. The paste must come
from a `youtubei/v1/browse` request — the plain page-load request
lacks `x-goog-authuser` and setup rejects it. The cookie-harvest
route made this obsolete for routine work; it stays here because a
manual auth.json rebuild may still need it.

Hosts contacted: `music.youtube.com` (internal youtubei API) —
requests are made by the library itself, so no registered-host
credential swap is involved; the credential never leaves this
machine except inside those API calls.

## Helper

`hominem ytm <cmd...>` (through the logged wrapper; all output is one
JSON object/array per call; never print the auth file):

- `status` — auth check: count + list of library playlists.
- `playlists` — list library playlists (title, playlistId, count).
- `playlist <playlistId>` — a playlist's tracks (title, artists,
  videoId, setVideoId, duration).
- `search <query...>` — song search, top 10 (title, artists, videoId).
- `create <title> [PRIVATE|PUBLIC|UNLISTED]` — returns playlistId.
- `add <playlistId> <videoId...>` — add songs (duplicates off).
- `add-playlist <playlistId> <sourcePlaylistId>` — append another
  playlist's items.
- `remove <playlistId> <videoId...>` — resolves setVideoIds from the
  playlist itself, then removes. The operation Spotify cannot do.
- `edit <playlistId> --title T --description D --privacy P` — any
  subset.
- `delete <playlistId> --yes` — irreversible; --yes is required.
- `reauth` — force the cookie re-harvest.

## Retired record

The Mac bridge (built Oct 22, v1 died silently on the Mac, v2
superseded before activation — Chase killed the approach; its
`bridge_client.ts` port was removed from this repo 2026-11-22) and
the VM-side `bmcp` transport are the retired direct/bridge-mode
record — do not use them for new work. `migrate.py` /
`second_pass.py` are the Oct 21 migration record.

## Limits and failure behaviour

- Unofficial API: Google can break it at any time. On unexplained
  400s, first suspect an upstream change or a dead session, in that
  order.
- Respect ordinary-use rates; batch adds in one call where possible.
- A failed or empty result is a result: report it, never invent
  content.
