# MarketingMind AI — End-to-End User Manual

**Document version:** 2.2  
**Last updated:** 2026-06-18

---

## Table of Contents

1. [Overview](#1-overview)
2. [Who This Manual Is For](#2-who-this-manual-is-for)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Prerequisites](#5-prerequisites)
6. [First-Time Setup](#6-first-time-setup)
7. [Run the Application](#7-run-the-application)
8. [Frontend Navigation](#8-frontend-navigation)
9. [Authentication and RBAC](#9-authentication-and-rbac)
10. [Module Usage](#10-module-usage)
11. [Backend API Reference](#11-backend-api-reference)
12. [Swagger API Usage](#12-swagger-api-usage)
13. [Test Data Operations](#13-test-data-operations)
14. [PostgreSQL Database Schema](#14-postgresql-database-schema)
15. [Configuration Reference](#15-configuration-reference)
16. [Build and Validation](#16-build-and-validation)
17. [Troubleshooting](#17-troubleshooting)
18. [Known Limitations](#18-known-limitations)
19. [Operational Recommendations](#19-operational-recommendations)
20. [Quick Start Checklist](#20-quick-start-checklist)

---

## 1. Overview

MarketingMind AI is a full-stack recruiter operations workspace for IT staffing teams. It unifies campaign email operations, job search automation, LinkedIn recruiter outreach, daily activity reporting, and submission analytics in one React console backed by a FastAPI API.

**What you can do:**

- Run mass email campaigns to vendor and buyer contacts
- Automate job search, fit analysis, and application tracking for consultants
- Discover LinkedIn recruiters, enrich profiles, and generate outreach messages
- Review recruiter day reports and month-over-month submission trends
- Explore the live API catalog and test endpoints in Swagger
- Manage your user profile, settings, and notifications

**How data works today:**

- API routes read/write **JSON seed data** (`backend/app/data/test_data.json`) for live UI operations
- **PostgreSQL** schema (29 tables) is created locally via `scripts/init_postgres_schema.py` and is ready for repository integration
- SQL tables are auto-created on backend startup when `DATABASE_URL` is set
- MongoDB is scaffolded but optional (`USE_MONGODB=false` by default)
- Auth uses **in-memory demo accounts** — suitable for development, not production

This guide covers setup, daily usage, roles and permissions, API reference, and troubleshooting.

---

## 2. Who This Manual Is For

| Audience | Use this manual to… |
|----------|---------------------|
| **Recruiters / bench sales** | Run campaigns, search jobs, track submissions, use LinkedIn outreach |
| **Team leads** | Review day reports, monitor submission trends, check operational metrics |
| **Admins** | Configure SMTP, API keys, launch campaigns, manage job automation |
| **Developers** | Set up locally, use API Explorer/Swagger, extend seed data |
| **Super admins** | Reset or append test datasets for demos and QA |

---

## 3. Tech Stack

### Frontend (`frontend/`)

| Layer | Technology |
|-------|------------|
| Framework | React 19 |
| Build tool | Vite 8 |
| Routing | React Router DOM 7 |
| HTTP client | Axios |
| Charts | Recharts |
| Icons | Lucide React |
| Excel import | xlsx (job portal/carrier batch upload) |

### Backend (`backend/`)

| Layer | Technology |
|-------|------------|
| API | FastAPI 0.116 |
| Server | Uvicorn |
| Validation | Pydantic / pydantic-settings |
| SQL ORM | SQLAlchemy 2 + PostgreSQL (psycopg 3) |
| Document DB | MongoDB (pymongo — optional scaffold) |
| Resume AI | LangChain, langchain-openai, scikit-learn, pypdf, python-docx |
| DB driver | `psycopg[binary]` |

---

## 4. Project Structure

```
MarktingMindAI/
├── frontend/              # React + Vite web app
│   └── src/
│       ├── App.jsx        # Auth gate, routing, workspace loader
│       ├── api/client.js  # All API calls
│       ├── components/    # AppShell, AuthPanel
│       └── pages/         # One page per module
├── backend/               # FastAPI API service
│   └── app/
│       ├── api/routes.py  # REST endpoints
│       ├── core/          # Config and auth
│       ├── data/          # Seed datasets
│       ├── db/            # SQLAlchemy models (29 tables)
│       └── services/      # seed_data, resume_ai, test_data_store
├── backend/database/      # SCHEMA.md — PostgreSQL table reference
├── backend/scripts/       # init_postgres_schema.py
└── usermanual.md          # This document
```

**Key data files:**

| File | Purpose |
|------|---------|
| `backend/app/data/test_data.default.json` | Baseline immutable dataset |
| `backend/app/data/test_data.json` | Runtime mutable dataset (reset target) |

**Legacy HTML prototypes** (reference only): `campaigns_tab_mass_email.html`, `day_to_day_report_dashboard.html`, `job_automation_platform.html`, `submission_progress_dashboard_mom_yoy_calendar.html`

---

## 5. Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.9+ |
| pip | Latest |

**Required for local PostgreSQL schema:**

- PostgreSQL 14+ running on `localhost:5432`

**Optional:**

- MongoDB (local or Atlas) — `pip install -r requirements-mongodb.txt`
- `pymongo` — install separately if MongoDB health check is needed (`pip install pymongo`)
- OpenAI API key (resume AI and LLM insights)
- Third-party keys: Apollo, Hunter, RocketReach, Lusha, LinkedIn

---

## 6. First-Time Setup

### 6.1 Frontend Setup

**macOS / Linux:**

```bash
cd frontend
cp .env.example .env
npm install
```

**Windows (PowerShell):**

```powershell
cd frontend
copy .env.example .env
npm install
```

Default frontend env:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 6.2 Backend Setup

**macOS / Linux:**

```bash
cd backend
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install pymongo
```

**Windows (PowerShell):**

```powershell
cd backend
copy .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install pymongo
```

**Initialize PostgreSQL schema (after PostgreSQL is running):**

```bash
cd backend
python scripts/init_postgres_schema.py
```

**Optional MongoDB driver:**

```bash
pip install -r requirements-mongodb.txt
```

### 6.3 Environment Variables

Copy `backend/.env.example` → `backend/.env` and adjust as needed.

| Variable | Default / Example | Purpose |
|----------|-------------------|---------|
| `DATABASE_URL` | `postgresql+psycopg://postgres:admin@localhost:5432/postgres` | PostgreSQL connection |
| `USE_SEED_DATA` | `true` | API reads/writes JSON test datasets |
| `USE_MONGODB` | `false` | Enable MongoDB connection on startup |
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection (if enabled) |
| `MONGODB_DB_NAME` | `marketingmind_ai` | MongoDB database name |
| `OPENAI_API_KEY` | (empty) | Optional OpenAI fallback when Ollama is unavailable |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model name |
| `USE_LOCAL_LLM` | `true` | Prefer Ollama/Mistral for reasoning (skill extraction, gap analysis, ranking explanations) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `mistral` | Local model for LLM reasoning layer |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Open-source embeddings for CV ↔ job similarity (primary scorer) |
| `EMBEDDING_BACKEND` | `auto` | `auto` (try MiniLM, fallback TF-IDF), `sentence_transformers`, or `sklearn_tfidf` |
| `ALLOWED_ORIGINS` | `["http://localhost:5173","http://127.0.0.1:5173"]` | CORS — **must be JSON array** |
| `JWT_SECRET` | (change in production) | Token signing secret (scaffolded) |
| `APOLLO_API_KEY` | (empty) | Apollo.io enrichment |
| `HUNTER_API_KEY` | (empty) | Hunter.io email finder |
| `LINKEDIN_API_KEY` | (empty) | LinkedIn API access |

**Feature flags** in `.env.example`:

```env
ENABLE_CAMPAIGN_MODULE=true
ENABLE_JOB_AUTOMATION=true
ENABLE_LINKEDIN_RECRUITER=true
ENABLE_REPORTING=true
```

---

## 7. Run the Application

Run backend and frontend in **separate terminals**.

### 7.1 Start Backend (port 8000)

**macOS / Linux:**

```bash
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Windows (PowerShell):**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

On startup the backend initializes SQL tables (`create_all`) and attempts MongoDB only if `USE_MONGODB=true`. Run `init_postgres_schema.py` once to seed PostgreSQL with demo data.

### 7.2 Start Frontend (port 5173)

```bash
cd frontend
npm run dev -- --port 5173 --strictPort
```

`--strictPort` prevents Vite from silently switching to another port.

### 7.3 Access URLs

| Resource | URL |
|----------|-----|
| Web app | http://localhost:5173 |
| Swagger docs | http://127.0.0.1:8000/docs |
| ReDoc | http://127.0.0.1:8000/redoc |
| OpenAPI spec | http://127.0.0.1:8000/openapi.json |

> **Note:** `GET /health` requires a valid bearer token (any logged-in role).

**Health response fields:**

| Field | Description |
|-------|-------------|
| `status` | Overall API status (`ok` or `error`) |
| `database` | SQL connection status and message |
| `mongodb` | MongoDB connection status and message |
| `modules` | List of active module identifiers |

---

## 8. Frontend Navigation

Use the **left sidebar** to move between modules.

- Click **Refresh data** to reload workspace data (overview, campaigns, job automation, day report, submissions, health).
- **LinkedIn Recruiter** loads its workspace independently when you open that page.
- Your name and role appear at the bottom of the sidebar; click to open **My Profile**.
- The **API status** badge shows backend health (`ok`, `error`, etc.).

| # | Route | Module | Purpose |
|---|-------|--------|---------|
| 1 | `/` | Command Center | Overview metrics, module cards, activity feed |
| 2 | `/campaigns` | Campaign Studio | Email campaigns and contact lists |
| 3 | `/job-automation` | Job Automation | Profile, search, portals, CV analyzer, tracker |
| 4 | `/linkedin` | LinkedIn Recruiter | Discovery, enrichment, outreach, sequences |
| 5 | `/day-report` | Day Report | Recruiter daily KPI charts |
| 6 | `/submissions` | Submissions | MoM/YoY submission trends |
| 7 | `/api-explorer` | API Explorer | Live endpoint catalog + Swagger links |
| 8 | `/profile` | My Profile | Profile, settings, notifications, password |

---

## 9. Authentication and RBAC

Login is required for all API-backed screens. The auth panel appears when you are not signed in.

### 9.1 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@marketingmind.ai` | `Super@123` |
| Admin | `admin@marketingmind.ai` | `Admin@123` |
| User (read-focused) | `user@marketingmind.ai` | `User@123` |

On the login screen, click any **Demo Users** card to auto-fill credentials.

### 9.2 Login / Register / Logout

1. Open http://localhost:5173
2. **Login** with a demo account, or switch to **Register** to create a new account
3. Registration requires name, email, password (6+ chars), and role selection
4. The app stores a bearer token in `localStorage` and loads workspace data
5. Click **Logout** in the sidebar to end the session

> **Demo security note:** Registration allows selecting any role including `super_admin`. This is intentional for local demos only — restrict registration in production.

### 9.3 Role Permissions

| Capability | user | admin | super_admin |
|------------|:----:|:-----:|:-----------:|
| View dashboards and workspaces | Yes | Yes | Yes |
| Campaign preview, job analyze, save job | Yes | Yes | Yes |
| LinkedIn discover, enrich, generate message | Yes | Yes | Yes |
| Launch campaigns, test-send, campaign settings | No | Yes | Yes |
| Job search, apply, profile update, portals, search config save | No | Yes | Yes |
| LinkedIn outreach queue | No | Yes | Yes |
| LinkedIn API key / settings update | No | Yes | Yes |
| View test data dump (`/api/meta/test-data`) | No | Yes | Yes |
| Append test data | No | No | Yes |
| Reset test data to baseline | No | No | Yes |

The UI also hides or disables privileged actions for the `user` role (for example, campaign launch and test-send).

---

## 10. Module Usage

### 10.1 Command Center

**Route:** `/`

Use this page to:

- Review high-level metrics (campaign throughput, automation queue, database health)
- Open workspace modules from the cards (campaigns, job automation, day report, submissions)
- Read the recent activity feed
- Confirm SQL and MongoDB connection posture

### 10.2 Campaign Studio

**Route:** `/campaigns`

**Tabs:** Compose · Contacts · Campaigns · Templates · Settings

#### Compose tab

1. Write email **subject** and **body**
2. Use **merge tags** for personalization
3. Pick an **AI prompt template** to pre-fill content
4. Select **contact lists** and recipients
5. Click **Preview** to render HTML
6. **Test send** (admin/super_admin) or open the **scheduler** to launch

**Scheduler options:**

| Option | Description |
|--------|-------------|
| Send date / time | Schedule future delivery |
| Send now | Ignore schedule and send immediately |
| Open tracking | Track email opens |
| Auto follow-up | Queue a follow-up sequence |

#### Contacts tab

- Browse and filter campaign contacts
- View status (Queued, Sent, Opened, Bounced)
- Create new contact lists (admin/super_admin)

#### Campaigns tab

- View campaign history with status (Sent, Scheduled, Draft)
- Filter by status
- Track progress bars per campaign

#### Templates tab

- Browse saved email templates
- Preview template HTML
- Use templates as starting points for new campaigns

#### Settings tab

- **SMTP:** host, port, username, password, from address
- **Compliance:** unsubscribe footer, CAN-SPAM toggles
- **Warmup:** sender reputation settings
- **Test connection** (simulated in demo mode)

**Merge tags:**

| Tag | Replaced with |
|-----|---------------|
| `{{candidate_name}}` | Consultant name |
| `{{recruiter_name}}` | Sender name |
| `{{company_name}}` | Your company |
| `{{skills}}` | Skill list |
| `{{location}}` | Location |
| `{{rate}}` | Bill rate |

**AI prompt templates:** Hotlist blast, Candidate intro, Follow-up, Urgent placement, Bench sales, Re-introduction

### 10.3 Job Automation

**Route:** `/job-automation`

The React Job Automation module matches (and extends) the legacy HTML prototype (`backupfolder/job_automation_platform.html`). A **● LIVE** badge, 4-metric hero row (applied today, new matches, interviews, avg match), bottom-right toast notifications, and tab count badges are shown in the UI.

**Tabs:** My Profile · Job Search · Portals · Results · CV Analyzer · LinkedIn · Tracker

> **Role note:** Search run, apply, portal edits, profile save, and search-config save require **admin** or **super_admin**. The `user` role has view-only access for privileged actions.

#### 10.3.1 My Profile

| Feature | Description |
|---------|-------------|
| Personal fields | Name, email, phone, location, LinkedIn, expected rate |
| Dropdowns | Experience (1–2 through 12+ years), employment type (C2C, W2, Full Time, C2H, Both), visa, work mode |
| 4-stat row | Applied today, new matches, interviews, avg match score |
| Resume upload | `.pdf`, `.docx`, `.txt` via file picker |
| **Parse with AI** | Calls `POST /api/job-automation/resume/parse`; updates profile + search config on server |
| Parse results panel | Role-fit %, matched/missing skills, AI insights, text preview |
| Auto-apply | Toggle with match threshold **slider** (50–95%), max applications/day, schedule time/timezone |
| Save profile | Persists profile and automation settings via API |

**Parse with AI workflow:**

1. Upload a resume file
2. Click **Parse with AI**
3. Review extracted name, skills, job titles, and match score in the results panel
4. Parsed data is saved to `job_profiles` / `search_configs` (PostgreSQL) and JSON seed data (API)
5. Job titles and skills are merged into the Job Search tab automatically

#### 10.3.2 Job Search

| Feature | Description |
|---------|-------------|
| Job title tags | Add/remove titles with **Add** button or Enter — persists via `PUT /api/job-automation/search` |
| Required skills (AND) | Must-have skills tag editor |
| Optional skills (OR) | Nice-to-have skills tag editor |
| Add preset titles | Inserts Java, Python, Data Engineer, Full Stack Developer |
| Location & radius | Location text + radius preset dropdown (25/50/100 miles, Nationwide) |
| Job posted within | Last 24h through 30 days |
| Experience level | Any, Mid-Level, Senior, Lead/Principal |
| Rate range | Min/max hourly rate filters |
| Employment type | Full profile employment options |
| Match score | Slider for minimum match % |
| Repeat every | Once daily, every 6h, 3h, or 1h |
| Exclude keywords | Comma-separated exclusion list |
| **Save search config** | Persists all search fields to backend |
| **Run search now** | Saves config, scrapes portals, ranks matches with CV profile (ML always; LLM when `OPENAI_API_KEY` is set), shows progress bar, navigates to Results |
| **Run auto apply now** | Scrapes configured portals, ranks CV ↔ job matches, applies to top roles above threshold, navigates to Results |

**Sales Automation job-board pipeline** (search and auto apply):

1. Scrape jobs from configured portals (simulated per portal URL + search titles/skills)
2. Parse CV profile from saved resume data (`job_profile` / parsed skills & summary)
3. Filter by search config (titles, skills, location, exclusions, min match)
4. **Primary match** — open-source embeddings (`all-MiniLM-L6-v2`) compute cosine similarity between resume text and each job description
5. **Reasoning layer** — local Ollama (`USE_LOCAL_LLM=true`, default) or OpenAI (`OPENAI_API_KEY`) adds role classification, ranking explanation, and skill gap analysis for top results
6. Rank and return results to the **Results** tab with `matchSource` (`embeddings`, `embeddings+llm`, or `ml` fallback) and `matchInsight` per card

Embeddings run locally without any API key. LLM is optional — if Ollama and OpenAI are both unavailable, embedding scores still rank results.

#### 10.3.3 Portals

| Feature | Description |
|---------|-------------|
| Portal list | Avatar initials, name, URL, Active/Paused toggle |
| Excel/CSV/XLSX upload | True `.xlsx` parsing via `xlsx` library; preview then **Confirm import** |
| Add portal | Manual name + URL entry |
| Delete portal | Remove with trash icon |
| Carrier pages | Career site URLs with **Monitoring** status badge |
| Carrier import | Batch upload via Excel/CSV/XLSX |

#### 10.3.4 Results

| Feature | Description |
|---------|-------------|
| Pipeline banner | Shows scrape → embeddings → LLM reasoning steps; embeddings-only vs embeddings+AI |
| Job cards | Checkbox selection, match %, match source (Embeddings / Embeddings+AI), match insight, skill gaps, skills, hot badge, portal name, rate |
| Filters | Search text, job type, posted within, sort, min match slider, exclude keywords |
| Bulk apply | Select all filtered → **Apply selected** (admin+) |
| Per-card actions | Quick apply, Analyze (opens CV Analyzer), Save to favorites |
| Progress bar | Visual match score on each card |

#### 10.3.5 CV Analyzer

| Feature | Description |
|---------|-------------|
| Job reference | Optional dropdown from saved search results |
| Job description | Paste full JD text (20+ chars) for manual analysis |
| Analyze CV match | Runs `POST /api/job-automation/analyze` |
| Empty state | Placeholder until first analyze in session |
| Summary tiles | Matched vs missing keyword counts |
| Conic score circle | Visual match % display |
| Recommendations | Per-suggestion **Apply** + **Apply all suggestions** |
| Tailor resume | `POST /api/job-automation/resume/tailor` when auto-tailor enabled |
| Preview / save / download | Preview tailored CV, save to backend, download as `.txt` |

#### 10.3.6 LinkedIn (within Job Automation)

| Feature | Description |
|---------|-------------|
| LinkedIn header | Blue panel with **Connected** badge |
| Filters | Query, company, experience level, employment type, date posted |
| Toggles | Under 10 applicants, Easy Apply only |
| Sort | Relevance, Most Recent, Most Applicants |
| Job cards | Company initials avatar, match %, mini match progress bar |
| Actions | Easy Apply / Apply on LinkedIn, open posting, save |

#### 10.3.7 Tracker

| Feature | Description |
|---------|-------------|
| Summary stats | Total applied, under review, interviews, action needed |
| Sub-tabs | All · Interviews · Action Needed · Stats |
| Interview / Action tabs | Summary cards (count, response rate, avg response time) |
| Application cards | Portal source, application date, match %, status (including Rejected) |
| Actions | **Follow up** (schedules reminder), **View posting** (opens URL when available) |
| Stats tab | Response rate, avg match, avg response time, best platform |

#### 10.3.8 Feature parity summary (HTML vs React)

| Area | React status |
|------|--------------|
| Profile fields + dropdowns | Yes |
| Resume upload + **Parse with AI** (backend) | Yes |
| Auto-apply + threshold slider | Yes |
| Job title / skill tag editors with **Add** + API persist | Yes |
| Search filters (posted within, experience, rate, repeat) | Yes |
| Portal XLSX import + preview | Yes |
| Results checkboxes + bulk apply | Yes |
| CV analyzer (conic score, apply all, tailor/save) | Yes |
| LinkedIn search/apply + sort + match bar | Yes |
| Tracker extended stats + portal/date on cards | Yes |
| LIVE badge + toast notifications + tab badges | Yes |

### 10.4 LinkedIn Recruiter

**Route:** `/linkedin`

**Tabs:** Discover · Paste Profiles · API Sources · AI Outreach · Sequence Tracker · Settings

| Tab | Actions |
|-----|---------|
| Discover | Filter by company, technology, seniority, location, connections; run searches |
| Paste Profiles | Paste LinkedIn URLs for enrichment |
| API Sources | View Apollo, Hunter, RocketReach, Lusha connection status |
| AI Outreach | Generate and queue outreach messages |
| Sequence Tracker | Monitor queued/sent outreach steps |
| Settings | API keys, daily connection/InMail limits (admin+) |

**LinkedIn message types:**

| Type | Use case |
|------|----------|
| `connect` | Connection request note |
| `inmail` | LinkedIn InMail introduction |
| `cold_outreach` | Cold recruiter outreach |
| `followup` | Follow-up on prior message |
| `hotlist` | Bench hotlist share |
| `thankyou` | Post-connection thank you |
| `resume` | Resume share follow-up |

Outreach queue actions require **admin** or **super_admin**.

### 10.5 Day Report

**Route:** `/day-report`

**KPI definitions:**

| Metric | Description |
|--------|-------------|
| LinkedIn | LinkedIn activity count (messages, connections, profile views) |
| Calls | Phone calls made |
| Sourced | Profiles sourced for open roles |
| Marketing | Marketing outreach actions |

**Charts and tables:**

- Daily trend (area chart)
- Totals by recruiter (bar chart)
- Breakdown by technology
- Filterable detail table by date range and recruiter

### 10.6 Submissions

**Route:** `/submissions`

- Filter by **start month** and **end month** (calendar inputs)
- MoM bar chart and YoY line chart
- Summary: total submissions and monthly average
- Positive/negative trend indicators per month

### 10.7 API Explorer

**Route:** `/api-explorer`

- Fetches live endpoint catalog from `/api/meta/endpoints`
- Shows method, path, summary, request example, and response example per endpoint
- Direct links to Swagger docs and OpenAPI JSON

### 10.8 My Profile

**Route:** `/profile`

**Tabs:** Profile · Settings · Notifications · Password

| Tab | Fields / toggles |
|-----|------------------|
| Profile | Name, phone, company, title, department, location, timezone, bio |
| Settings | Language, date format, theme |
| Notifications | Email, campaign alerts, job alerts, daily report, weekly digest |
| Password | Current, new, confirm (demo stub) |

---

## 11. Backend API Reference

All protected endpoints require:

```
Authorization: Bearer <token>
```

Obtain a token via `POST /api/auth/login`.

### 11.1 Authentication

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/auth/options` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/logout` | Authenticated |
| GET | `/api/auth/me` | Authenticated |

### 11.2 User Profile

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/user/profile` | Authenticated |
| PUT | `/api/user/profile` | Authenticated |
| PUT | `/api/user/password` | Authenticated |
| GET | `/api/user/settings` | Authenticated |
| PUT | `/api/user/settings` | Authenticated |

### 11.3 Health and Overview

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/health` | user, admin, super_admin |
| GET | `/api/overview` | user, admin, super_admin |

### 11.4 Campaigns

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/campaigns/workspace` | All roles |
| POST | `/api/campaigns/preview` | All roles |
| POST | `/api/campaigns/test-send` | admin, super_admin |
| POST | `/api/campaigns/launch` | admin, super_admin |
| PUT | `/api/campaigns/settings` | admin, super_admin |
| POST | `/api/campaigns/lists` | admin, super_admin |

### 11.5 Job Automation

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/job-automation/workspace` | All roles |
| PUT | `/api/job-automation/profile` | admin, super_admin |
| PUT | `/api/job-automation/automation` | admin, super_admin |
| PUT | `/api/job-automation/search` | admin, super_admin |
| POST | `/api/job-automation/search/run` | admin, super_admin |
| POST | `/api/job-automation/portals` | admin, super_admin |
| DELETE | `/api/job-automation/portals` | admin, super_admin |
| POST | `/api/job-automation/portals/import` | admin, super_admin |
| POST | `/api/job-automation/carriers` | admin, super_admin |
| DELETE | `/api/job-automation/carriers` | admin, super_admin |
| POST | `/api/job-automation/carriers/import` | admin, super_admin |
| POST | `/api/job-automation/apply` | admin, super_admin |
| POST | `/api/job-automation/auto-apply` | admin, super_admin |
| POST | `/api/job-automation/analyze` | All roles |
| POST | `/api/job-automation/save` | All roles |
| POST | `/api/job-automation/resume/parse` | All roles (multipart) |
| POST | `/api/job-automation/resume/tailor` | All roles |
| POST | `/api/job-automation/resume/save-tailored` | All roles |
| GET | `/api/job-automation/resume/tailored/{job_id}` | All roles |
| POST | `/api/job-automation/linkedin/search` | All roles |
| POST | `/api/job-automation/linkedin/apply` | admin, super_admin |

**Resume parse form fields:**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `file` | Yes | — | Resume file (.txt, .pdf, .docx) |
| `targetRole` | No | `Software Engineer` | Role used for match scoring |
| `requiredSkills` | No | `Python, FastAPI, SQL` | Comma-separated skills |

**Resume parse response** includes `parsedProfile`, `mlAssessment`, `llmAssessment`, `agentTrace`, plus updated `profile` and `search` objects when persistence succeeds.

**Search save body** (`PUT /api/job-automation/search`): `titles`, `requiredSkills`, `optionalSkills`, `location`, `radius`, `filters`, `excludeKeywords`, `employmentType`, `minMatchScore`, `postedWithin`, `experienceLevel`, `rateMin`, `rateMax`, `repeatEvery`.

### 11.6 LinkedIn Recruiter

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/linkedin/workspace` | All roles |
| POST | `/api/linkedin/discover` | All roles |
| POST | `/api/linkedin/enrich` | All roles |
| POST | `/api/linkedin/outreach` | admin, super_admin |
| POST | `/api/linkedin/outreach/generate` | All roles |
| PUT | `/api/linkedin/settings` | admin, super_admin |
| PUT | `/api/linkedin/api-keys` | admin, super_admin |

### 11.7 Day Report

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/day-report/dashboard` | All roles |
| POST | `/api/day-report/filter` | All roles |

### 11.8 Submissions

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/submissions/dashboard` | All roles |
| POST | `/api/submissions/filter` | All roles |

### 11.9 Meta / Test Data

| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/meta/endpoints` | All roles |
| GET | `/api/meta/test-data` | admin, super_admin |
| POST | `/api/meta/test-data/append` | super_admin only |
| POST | `/api/meta/test-data/reset` | super_admin only |

---

## 12. Swagger API Usage

1. Open http://127.0.0.1:8000/docs
2. Click **Authorize** and enter: `Bearer <your-token>`
3. Expand any endpoint → **Try it out** → fill parameters → **Execute**
4. Inspect the status code and response body

To get a token quickly, log in via the web app and copy from browser dev tools, or call `POST /api/auth/login` in Swagger.

---

## 13. Test Data Operations

Super admins can mutate seed data for demos and testing. These operations are available via **curl**, **Swagger**, or **API Explorer** — there is no dedicated UI button yet.

### 13.1 Appendable Datasets

| Dataset key | Contents |
|-------------|----------|
| `campaign_contacts` | Email campaign contacts |
| `campaign_templates` | Email templates |
| `campaign_lists` | Contact list definitions |
| `campaign_items` | Campaign run records |
| `portal_items` | Job portal URLs |
| `carrier_items` | Carrier site entries |
| `day_report_rows` | Daily recruiter activity rows |
| `job_results` | Job search results |
| `search_configs` | Job search title/skill/filter configuration |
| `job_profiles` | Candidate profile rows |
| `linkedin_jobs` | LinkedIn job listings |
| `applications` | Job application tracker rows |
| `submission_months` | Monthly submission totals |

### 13.2 Export Current Runtime Dataset

```bash
curl -s http://127.0.0.1:8000/api/meta/test-data \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 13.3 Append Rows to a Dataset

```bash
curl -s -X POST http://127.0.0.1:8000/api/meta/test-data/append \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "campaign_contacts",
    "entries": [
      {
        "name": "Priya N",
        "email": "priya@example.com",
        "company": "Acme",
        "status": "Queued",
        "list": "Priority Accounts"
      }
    ]
  }'
```

### 13.4 Reset Runtime Dataset to Baseline

```bash
curl -s -X POST http://127.0.0.1:8000/api/meta/test-data/reset \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 14. PostgreSQL Database Schema

MarketingMind AI includes a full **PostgreSQL** schema (29 tables) defined in `backend/app/db/models.py`. The schema mirrors all major modules: auth, campaigns, job automation, LinkedIn recruiter, and reporting.

### 14.1 Local connection

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `5432` |
| Database | `postgres` |
| Username | `postgres` |
| Password | `admin` |
| SQLAlchemy URL | `postgresql+psycopg://postgres:admin@localhost:5432/postgres` |

Set in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:admin@localhost:5432/postgres
USE_MONGODB=false
USE_SEED_DATA=true
```

### 14.2 Initialize schema and seed data

From `backend/` with PostgreSQL running:

**macOS / Linux:**

```bash
python scripts/init_postgres_schema.py
```

**Windows (PowerShell):**

```powershell
python scripts/init_postgres_schema.py
```

This script:

1. Creates all 29 tables via SQLAlchemy `create_all`
2. Seeds demo users, campaigns, job automation, LinkedIn, and reporting data from `app/data/test_data.json`
3. Prints a summary of tables created

Re-run the script to reset PostgreSQL to the baseline seed (drops and recreates tables).

### 14.3 Table groups (29 tables)

| Group | Tables |
|-------|--------|
| **Auth & users** | `users`, `user_settings`, `auth_sessions` |
| **Campaigns** | `campaign_settings`, `contact_lists`, `campaign_contacts`, `campaign_templates`, `campaign_items` |
| **Job automation** | `job_profiles`, `job_automation_settings`, `search_configs`, `portals`, `carriers`, `job_results`, `saved_jobs`, `job_applications`, `tailored_resumes`, `linkedin_jobs`, `job_analyses` |
| **LinkedIn recruiter** | `linkedin_recruiters`, `linkedin_sequences`, `linkedin_sequence_steps`, `linkedin_followups`, `linkedin_message_templates`, `linkedin_settings`, `linkedin_api_sources`, `linkedin_api_keys` |
| **Reporting** | `day_report_rows`, `submission_months` |

Full column-level documentation: `backend/database/SCHEMA.md`

### 14.4 Runtime data path

| Layer | Status |
|-------|--------|
| API routes (`USE_SEED_DATA=true`) | Read/write JSON in `backend/app/data/test_data.json` |
| PostgreSQL | Schema + seed ready; repository wiring is a future step |
| Backend startup | Also runs `create_all` on SQLAlchemy models when `DATABASE_URL` is set |

Job Automation **Parse with AI** persists parsed profile and search config to both JSON seed data (immediate API/UI) and PostgreSQL tables (`job_profiles`, `search_configs`) when the init script has been run.

### 14.5 Verify PostgreSQL

```powershell
# List tables (psql)
psql -U postgres -h localhost -d postgres -c "\dt"

# Or check health endpoint after login
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Headers @{ Authorization = "Bearer YOUR_TOKEN" }
```

Health `database` field reports `available`, `not_configured`, or `error`.

---

## 15. Configuration Reference

### 15.1 PostgreSQL

```env
DATABASE_URL=postgresql+psycopg://postgres:admin@localhost:5432/postgres
```

PostgreSQL is the default database driver. Run `scripts/init_postgres_schema.py` once after setup. Health endpoint reports `available`, `not_configured`, or `error`.

### 15.2 MongoDB (Optional)

```env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=marketingmind_ai
```

If connection fails, the backend logs a warning and continues with seed data.

### 15.3 OpenAI / Resume AI (Optional)

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

Without a key, resume parsing still returns rule-based extraction and ML scoring.

### 15.4 Third-Party API Keys (Optional)

Configure in `backend/.env` or via LinkedIn Recruiter **Settings** tab:

```env
APOLLO_API_KEY=
HUNTER_API_KEY=
LINKEDIN_API_KEY=
```

### 15.5 Frontend API URL (Deployment)

```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

Rebuild the frontend (`npm run build`) after changing this value.

---

## 16. Build and Validation

### 16.1 Frontend Production Build

```bash
cd frontend
npm run build
npm run preview    # serve dist/ locally for smoke testing
```

Output is written to `frontend/dist/`.

### 16.2 Lint Frontend

```bash
cd frontend
npm run lint
```

### 16.3 Backend Health Smoke Check

**macOS / Linux:**

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@marketingmind.ai","password":"Admin@123"}' | jq -r '.token')

curl -s http://127.0.0.1:8000/health -H "Authorization: Bearer $TOKEN"
```

**Windows (PowerShell):**

```powershell
$login = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"admin@marketingmind.ai","password":"Admin@123"}'

Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" `
  -Headers @{ Authorization = "Bearer $($login.token)" }
```

### 16.4 Resume Parse API Smoke Check

Create `resume_sample.txt`, then:

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@marketingmind.ai","password":"Admin@123"}' | jq -r '.token')

curl -s -X POST http://127.0.0.1:8000/api/job-automation/resume/parse \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@resume_sample.txt;type=text/plain" \
  -F "targetRole=Backend Engineer" \
  -F "requiredSkills=Python,FastAPI,SQL,AWS,Docker"
```

---

## 17. Troubleshooting

### 17.1 `uvicorn: command not found`

Activate the venv and use `python -m uvicorn` (see Section 7.1).

### 17.2 Virtual environment not found

Run setup from `backend/` and confirm `.venv` exists before activating.

### 17.3 `Address already in use` (port 8000 or 5173)

**macOS / Linux:**

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -tiTCP:8000 -sTCP:LISTEN | xargs kill -9
```

**Windows (PowerShell):**

```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

Repeat for port `5173` if the frontend fails to bind.

### 17.4 Session expired / 401 errors

Log out and log in again. Backend restart clears in-memory tokens.

### 17.5 Swagger returns 401

Use **Authorize** with `Bearer <token>` from a successful login.

### 17.6 `pip install` timeout

```bash
cd backend
python -m pip install --default-timeout=180 -r requirements.txt
```

### 17.7 Frontend cannot reach API

1. Backend running on http://127.0.0.1:8000
2. `VITE_API_BASE_URL` matches backend URL
3. `ALLOWED_ORIGINS` is a **JSON array** including your frontend origin, e.g. `["http://localhost:5173","http://127.0.0.1:5173"]`

### 17.8 `SettingsError` for `allowed_origins`

`ALLOWED_ORIGINS` must be valid JSON array syntax in `.env`, not a plain comma-separated string:

```env
# Correct
ALLOWED_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]

# Wrong
ALLOWED_ORIGINS=http://localhost:5173
```

### 17.9 `ModuleNotFoundError: No module named 'pymongo'`

```bash
pip install pymongo
```

Or install optional MongoDB requirements: `pip install -r requirements-mongodb.txt`. MongoDB is optional when `USE_MONGODB=false`.

### 17.10 PostgreSQL connection errors

1. Confirm PostgreSQL is running on `localhost:5432`
2. Verify credentials match `DATABASE_URL` (`postgres` / `admin`)
3. Run `python scripts/init_postgres_schema.py` from `backend/`
4. Check health endpoint `database` field after login

### 17.11 MongoDB or SQL warnings on startup

Expected when databases are not running. With `USE_MONGODB=false`, MongoDB warnings are harmless. The app continues in JSON seed-data mode.

### 17.12 LinkedIn page shows empty data

Click into **LinkedIn Recruiter** from the sidebar — it loads `/api/linkedin/workspace` on page mount, separate from the main workspace refresh.

---

## 18. Known Limitations

| Area | Current behavior |
|------|------------------|
| Data persistence | Most UI actions read/write JSON seed data (`test_data.json`), not live email or job board APIs |
| PostgreSQL | Schema and seed are ready; API routes do not yet use PostgreSQL repositories for all operations |
| Test data UI | Append/reset available via API only (no admin UI panel) |
| Auth | In-memory accounts with plaintext passwords — not production-ready |
| Registration | Any role can be selected at signup (demo only) |
| Password change | Stub endpoint; no real hash verification |
| MongoDB repositories | Scaffolded but optional (`USE_MONGODB=false` by default) |
| SMTP / outreach | Simulated in demo mode; no real email or LinkedIn delivery |
| LinkedIn / job boards | Portal scrape is simulated; CV ↔ job ranking uses local embeddings; optional Ollama/OpenAI for explanations |

---

## 19. Operational Recommendations

1. Keep backend and frontend in separate terminals for clean logs.
2. Use fixed ports (`8000`, `5173`) for stable local routing.
3. Use `--strictPort` on the frontend to avoid silent port changes.
4. Run `init_postgres_schema.py` once after PostgreSQL is installed.
5. Use **API Explorer** to keep UI actions aligned with the backend contract.
6. Use **Swagger** to validate requests before wiring new UI features.
7. Reset test data after experiments for deterministic demo behavior.
8. Log in as **super_admin** only when you need to append or reset seed data.
9. Run `ollama run mistral` (or set `OPENAI_API_KEY`) before demoing LLM ranking explanations; embeddings work without any API key.
10. Log in as **admin** or **super_admin** to test Job Automation search save, run search, and apply flows.

---

## 20. Quick Start Checklist

- [ ] Install PostgreSQL 14+ and confirm it runs on `localhost:5432`
- [ ] Create backend venv and `pip install -r requirements.txt`
- [ ] `pip install pymongo` (avoids startup import errors)
- [ ] Copy `backend/.env.example` → `backend/.env` (set `DATABASE_URL`, JSON `ALLOWED_ORIGINS`)
- [ ] Run `python scripts/init_postgres_schema.py` from `backend/`
- [ ] `npm install` in `frontend/` and copy `frontend/.env.example` → `frontend/.env`
- [ ] Start backend on `127.0.0.1:8000`
- [ ] Start frontend on `localhost:5173` with `--strictPort`
- [ ] Log in with a demo account (or click a Demo User card)
- [ ] Verify Command Center loads with metrics
- [ ] Open Job Automation → upload resume → **Parse with AI** (admin account)
- [ ] Job Search → add title tags → **Save search config** → **Run search now**
- [ ] Open LinkedIn Recruiter and confirm workspace loads
- [ ] Open API Explorer and confirm endpoint catalog loads
- [ ] Open Swagger and test one authenticated endpoint

---

*MarketingMind AI — Recruiting operations surface*
