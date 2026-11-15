# ASTROCARE AI

**Astronaut Health Intelligence and Monitoring System**

Team **Astrovibes** — NASA Space Apps Challenge 2026, Multan, Pakistan

Challenge: [Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/)

> **Live demo:** https://astrocare-ai.ai.studio
> **Status:** built and tested — see [Getting Started](#getting-started).

---

## What it is

ASTROCARE AI is a full-stack space health command center for **flight surgeons and mission teams**. An astronaut's vitals are monitored continuously, an explainable risk engine flags drift from the astronaut's own baseline, and a reading-grounded AI assistant helps the crew medic and flight surgeon understand what changed and what to do next.

It answers the challenge's core question: **how do you know an astronaut is getting sick before they do — when Earth is up to 44 minutes away by radio?** The answer here is on-board, explainable triage: the app decides locally and never waits for ground.

> **Transparency notice:** all astronaut profiles, vital readings and demonstration thresholds in this application are **simulated** for hackathon demonstration and testing. ASTROCARE AI is not medically validated flight software and does not diagnose medical conditions.

---

## Key features

1. **Mission Dashboard** — crew profile for fictional astronaut **Alex Morgan** (`ORBIT-04`, Mission Specialist · Biomedical Payload Lead), **Day 47 of 180** on a simulated LEO endurance mission (Node 3 Habitation Module), 6 vital KPI cards (Heart Rate, SpO2, Blood Pressure, Body Temperature, Sleep Duration, Activity Level), overall monitoring status and a 24-hour trend chart.
2. **Live Health Monitoring** — periodic simulated telemetry generator (6-second interval toggle or single tick), manual vital-sign entry form with validation and quick test presets (`Normal`, `Moderate Watch`, `High Alert`), interactive historical Chart.js inspector and a chronological readings log.
3. **Explainable AI Health Risk Engine** — evaluates every reading against configurable demonstration thresholds **and** recent rolling baseline shifts (`LOW`, `MODERATE`, `HIGH`), showing the exact triggering measurements and non-diagnostic next-step guidance. Nothing is a black box: every alert names its cause.
4. **Smart Alert Center** — filterable monitoring warnings (`All`, `Unacknowledged`, `HIGH`, `MODERATE`) with timestamps, reasons, next-step guidance and persistent `Acknowledge` actions.
5. **AI Health Assistant** — conversational assistant grounded strictly in stored SQLite telemetry. Uses server-side Google Gemini (`@google/genai`) when `GEMINI_API_KEY` is configured, with a deterministic reading-grounded fallback so it always works reliably without inventing measurements.
6. **Health Analytics** — 24-hour vital trends, 7-day health history, sleep duration analytics, alert history chart and downloadable CSV report (`/api/analytics/export.csv`).
7. **NASA Research & Sources** — direct links to NASA's Open Science Data Repository, Life Sciences Portal and Human Research Program, paired with spaceflight physiology background.

---

## How it works

```
Simulated telemetry / manual entry
        → Express API (validation)
        → SQLite (persistent, local-first)
        → Risk Engine (thresholds + rolling baseline)
        → Risk level LOW / MODERATE / HIGH
        → Alerts + Dashboard + AI Assistant (grounded in stored readings only)
```

- **Personal baseline, not population averages.** The demo astronaut's resting baseline is ~68 bpm HR, 98% SpO2, 118/76 mmHg, 7.3 hrs sleep. Drift from *that* baseline is what raises an alert.
- **Missing data is reported as missing, never guessed.** If a reading is absent, the app says so.
- **On-board first.** Triage runs on the server where the data lives — no round-trip to Earth required.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS v4, Chart.js, Lucide icons, Motion |
| Backend | Node.js + Express (TypeScript, run with `tsx`) |
| Database | SQLite via `better-sqlite3` (WAL mode, auto-seeded demo data) |
| AI | Google Gemini via `@google/genai` (optional; deterministic fallback included) |
| Tests | `tsx --test` (risk engine + API) |

---

## NASA data used

At least one NASA resource is required for a Global Award — this project uses three:

1. **NASA Open Science Data Repository (OSDR)** — https://osdr.nasa.gov — GeneLab omics and ALSDA physiology data; the reference model for how real spaceflight health data is structured and shared.
2. **NASA Life Sciences Portal (NLSP)** — https://nlsp.nasa.gov — life-sciences data and tools for human spaceflight research.
3. **NASA Human Research Program — 5 Hazards of Human Spaceflight** — https://www.nasa.gov/hrp/hazards/ — the risk framing behind the app's monitoring priorities (radiation, isolation, distance from Earth, gravity fields, hostile environments).

No downloadable NASA dataset with per-astronaut numeric thresholds is published on these pages, so all vital readings in the app are clearly labelled **simulated** demo data. No NASA findings or dataset IDs are invented.

---

## Getting started

### Prerequisites

- Node.js 20+ and npm

### Run locally

```bash
# 1. Install dependencies
npm install

# 2. (Optional) enable the Gemini-backed assistant:
#    copy .env.example to .env and set GEMINI_API_KEY.
#    Without it, the deterministic grounded analyzer runs automatically.

# 3. Run unit tests for the Risk Engine and API
npm test

# 4. Start the development server (port 3000)
npm run dev
```

### Run in production

```bash
npm run build
NODE_ENV=production npm start
```

In production the Express server serves the built frontend from `dist/` and the API on the same port (`PORT` env var, default `3000`). The SQLite database is created automatically at `./data/astrocare.db` (or `DATABASE_PATH`) and seeded with deterministic demo data on first run.

---

## API endpoints

| Method & path | Description |
|---|---|
| `GET /api/health/current` | Latest reading, astronaut profile, risk analysis, unacknowledged alert count |
| `GET /api/health/history` | Stored reading history (`?limit=&hours=`) |
| `POST /api/health/readings` | Validate, persist and evaluate a manual reading |
| `POST /api/health/simulate` | Generate and persist one simulated telemetry reading |
| `GET /api/alerts` | List monitoring alerts (`?severity=&status=`) |
| `POST /api/alerts/:id/acknowledge` | Acknowledge an alert |
| `GET /api/thresholds` · `PUT /api/thresholds` · `POST /api/thresholds/reset` | Manage demonstration thresholds |
| `GET /api/analytics` | 24h trends, 7-day daily summaries, sleep stats, alert timeline |
| `GET /api/analytics/export.csv` | Download stored telemetry as CSV |
| `GET /api/assistant/history` · `POST /api/assistant/chat` | Reading-grounded AI Health Assistant |

---

## Project structure

```
├── index.html            # App shell (6 views: Dashboard, Live Monitor,
│                         #   Risk & Alerts, AI Assistant, Analytics, Research)
├── server.ts             # Express server (Vite dev middleware in dev,
│                         #   static dist/ in production)
├── server/
│   ├── app.ts            # API routes
│   ├── db.ts             # SQLite schema + deterministic demo seed
│   ├── riskEngine.ts     # Explainable risk analysis + thresholds
│   ├── assistant.ts      # Gemini-backed / fallback health assistant
│   ├── types.ts          # Shared types
│   └── *.test.ts         # Risk engine + API tests
├── src/                  # React frontend (assets, js, styles)
├── data/                 # SQLite database file (created on first run)
└── vite.config.ts        # Vite + Tailwind config
```

---

## Team

**Astrovibes** — NASA Space Apps Challenge 2026, Multan, Pakistan.

## License

MIT — see [LICENSE](LICENSE).
