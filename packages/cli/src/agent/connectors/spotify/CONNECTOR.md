# Spotify (custom.spotify → official Web API)

The durable route: the official Spotify Web API with a registered
app. No mirror hacks, no daemons, no browser scraping.

## Architecture (2026-11-22)

`connectors/spotify/spotify.ts` — a standalone CLI over the official
REST API, OAuth PKCE. Every external HTTP call lands ONE events row
in `~/.hominem/agent.db` (connector "spotify"), the token refresh
included. Token values NEVER reach events rows: the token row's
params are `{grant_type}` only, and its response is
`{token_refreshed: true}` / `{token_stored: true}`.

Surface (through the launcher, all JSON out):

- `hominem spotify me` — current user.
- `hominem spotify playlists` — library playlists (first page, 50).
- `hominem spotify playlist <playlistId>` — a playlist's tracks.
- `hominem spotify search <query...>` — song search, top 10.
- `hominem spotify create <title> [--public]` — PRIVATE by default
  (the old connector's stuck-public lesson, below).
- `hominem spotify add <playlistId> <trackUri...>` / `hominem spotify
  remove <playlistId> <trackUri...>` — the edit surface the old
  route never had.
- `hominem spotify auth` — the one-time PKCE flow.

## Auth

`hominem spotify auth` runs the full PKCE flow: authorize URL →
localhost listener (`http://127.0.0.1:8943/callback`, 5-minute
timeout) → code exchange → the refresh token stored as an
`export SPOTIFY_REFRESH_TOKEN=...` line in `~/.hominem/env`
(`SPOTIFY_ENV_FILE` overrides; re-auth replaces the line, never
duplicates — law 3). Manual fallback: `auth --url-only` prints the
URL + verifier; `auth --code <code> --verifier <v>` completes it.

App credentials: the salvage-era app (registered by the old
workspace) turned up in this Mac's ambient agent env on 2026-11-22 —
`SPOTIFY_CLIENT_ID` (32-hex) and `SPOTIFY_CLIENT_SECRET`, moved into
`~/.hominem/env` the same day. If the app's registered redirect URIs
don't include `http://127.0.0.1:8943/callback`, the authorize step
will say so; the fix is a dashboard edit (developer.spotify.com →
the app → Settings → Redirect URIs), and `SPOTIFY_REDIRECT_URI` can
pin a different one.

Env: `SPOTIFY_CLIENT_ID`, `SPOTIFY_REFRESH_TOKEN` (required for API
calls), `SPOTIFY_CLIENT_SECRET` (optional; confidential apps send it
with the token requests — never logged), `SPOTIFY_API_URL`
(https://api.spotify.com/v1), `SPOTIFY_ACCOUNTS_URL`
(https://accounts.spotify.com), `SPOTIFY_REDIRECT_URI`
(http://127.0.0.1:8943/callback), `SPOTIFY_SCOPES`
(user-read-email user-read-private playlist-read-private
playlist-modify-public playlist-modify-private), `SPOTIFY_ENV_FILE`
(~/.hominem/env).

## History

The old custom.spotify connector FAILED at playlist mirroring:
created playlists got stuck public and edit-locked, with no remove
or reorder. Chase chose YouTube Music for the full edit surface
(2026-10-21). Spotify is now rebuilt the durable way — official Web
API — with add/remove in v1; reorder stays v1.1 (the official PUT
endpoint exists when it's needed).

Hosts contacted: `api.spotify.com`, `accounts.spotify.com`.

## Limits and failure behaviour

- Official API: playlists cap at 10k tracks; reads page at 50 —
  larger libraries page in v1.1.
- A failed or empty result is a result: report it, never invent
  content.
