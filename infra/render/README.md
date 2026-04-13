# Render

`render.yaml` in the repo root is the deployment source of truth for Render.

It provisions:

- `hominem-api-preview`
- `hominem-worker-preview`
- `hominem-web-preview`
- `hominem-db-preview`
- `hominem-kv-preview`
- `hominem-api-production`
- `hominem-worker-production`
- `hominem-web-production`
- `hominem-db-production`
- `hominem-kv-production`

GitHub deploy workflow expectations:

- GitHub environment `render-preview`
- GitHub environment `render-production`

Each GitHub environment must define:

- `RENDER_API_DEPLOY_HOOK_URL`
- `RENDER_WORKER_DEPLOY_HOOK_URL`
- `RENDER_WEB_DEPLOY_HOOK_URL`

Domain targets:

- preview web: `app.preview.ponti.io`
- preview api: `api.preview.ponti.io`
- production web: `app.ponti.io`
- production api: `api.ponti.io`

Mobile release wiring:

- EAS `preview` builds target `https://api.preview.ponti.io`
- EAS `production` builds target `https://api.ponti.io`
