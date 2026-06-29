# SAP BTP Cloud Foundry deployment — ARCHIVED

This directory contains the previous SAP BTP Cloud Foundry deployment artifacts.
The project has migrated to **Render**. See [RENDER_DEPLOYMENT.md](../../RENDER_DEPLOYMENT.md)
for current deployment instructions.

These files are kept for reference only — they are not part of the active
deployment path and should not be edited without intent.

## What's here

| File | Purpose |
|---|---|
| `manifest.yml` | CF app manifest (memory, buildpack, instances) |
| `mta.yml`, `*.mtaext` | Multi-Target Application descriptors per env |
| `Procfile` | Heroku/CF process spec |
| `deploy.sh` | Idempotent deploy + migrate script (CF CLI v8) |
| `cf-environments.conf` | Per-env CF org/space/URL mapping |
| `run-local.sh` | Local launcher mirroring the CF runtime |
| `console.sh` | Helper for `cf ssh` into a running app |

## Restoring CF deployment (if needed)

1. Move all files back to the repo root: `mv ../legacy/sap-cf/* .`
2. Restore the old `deploy-web.yml` GitHub Actions workflow from git history:
   `git show HEAD~N:.github/workflows/deploy-web.yml > .github/workflows/deploy-web.yml`
3. Re-add the CF-related env vars to `.env.example`.
4. Remove `render.yaml`, `.github/workflows/deploy-render.yml`, and
   `RENDER_DEPLOYMENT.md` so they don't conflict.

But really, just use Render.
