# SortedPlan (AI Day Planner)

A modern, cross-platform day planner with AI-powered features, built with Next.js, TypeScript, and PostgreSQL.

Deployed on **[Render](https://render.com)**; ships as native **iOS** and **Android** apps via **Capacitor**.

## Features

- 🎨 **Beautiful Modern UI** — Clean, intuitive interface with smooth animations
- 🌓 **Light & Dark Modes** — Seamless theme switching
- 📱 **Cross-Platform** — Web, iOS, Android (one codebase)
- ✅ **Plans + Checklists + Tasks** — Plan trips, packing checklists, daily tasks
- 🤖 **AI assistance** — SAP AI Core or Google Gemini, credentials stored encrypted per-user
- 🔗 **Share links** — View/edit links with revocation
- 🔐 **Auth** — Google OAuth (web) + native Google Sign-In (iOS/Android)

## Tech Stack

- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4
- **Backend:** Next.js API Routes · Prisma 7 · PostgreSQL
- **Auth:** NextAuth v5 (JWT) + native Google Sign-In via @capgo/capacitor-social-login
- **Mobile:** Capacitor 7 (remote-server pattern)
- **Deploy:** Render Blueprint (`render.yaml`) — auto-deploy on push to `main`
- **Tests:** Vitest + v8 coverage
- **CI:** GitHub Actions (lint, type-check, tests, npm audit, CodeQL, gitleaks)

## Getting Started

### Prerequisites

- Node.js 20.x
- PostgreSQL 16 (local Docker is easiest: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16`)
- For iOS: macOS + Xcode + CocoaPods
- For Android: Android Studio + JDK 17

### Local development

```bash
git clone https://github.com/BotleApps/ai-day-planner.git
cd ai-day-planner

npm install
cp .env.example .env.local      # then fill in the values (see .env.example)
node migrate-runner.js           # apply DB migrations
npm run dev                      # http://localhost:3000
```

### Run the native shells locally

```bash
npm run mobile:ios       # iOS Simulator → http://localhost:3000
npm run mobile:android   # Android Emulator → http://10.0.2.2:3000
```

## Deployment

**Production:** Render Blueprint at [render.yaml](render.yaml). See
[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for the one-time setup steps.

**Native apps:** see [MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md) and the
per-platform OAuth setup at [MOBILE_OAUTH_SETUP.md](MOBILE_OAUTH_SETUP.md).

## Project Structure

```
app/                    Next.js App Router (pages + API routes)
  api/                  Backend API routes (plans, checklists, tasks, ai, …)
components/             React components
lib/                    Server + client utilities (crypto, rate-limit, auth helpers, AI dispatch)
prisma/                 Schema + migrations
ios/                    Capacitor iOS native shell
android/                Capacitor Android native shell (scaffold on first `npm run cap:add:android`)
mobile/www/             Fallback page shown when CAP_SERVER_URL is unset
tests/                  Vitest unit tests
.github/workflows/      CI + deploy + iOS/Android build pipelines
legacy/sap-cf/          Archived SAP BTP CF deployment (no longer used)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Standalone production build |
| `npm test` | Vitest unit tests |
| `npm run test:coverage` | Vitest with v8 coverage report |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run type-check` | TypeScript no-emit check |
| `node migrate-runner.js` | Apply Prisma SQL migrations (transactional) |
| `npm run mobile:ios` / `mobile:android` | One-command local sim/emulator run |
| `npm run cap:ios` / `cap:android` | Sync native + open Xcode/Android Studio |

## Contributing

Open a PR against `main`. CI runs lint, type-check, tests, build, npm audit,
CodeQL, and gitleaks. All must pass before merge.

## License

MIT — see [LICENSE](LICENSE).
