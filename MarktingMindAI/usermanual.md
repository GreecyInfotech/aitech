# MarketingMind AI - End-to-End User Manual

## 1. Overview

MarketingMind AI is a full-stack recruiter operations workspace with:

- Frontend web app for campaign operations, job automation, day report analytics, submissions, and API Explorer
- Backend API service exposing operational and test-data endpoints
- Swagger API docs for interactive testing
- JSON-backed test datasets with append and reset controls
- Resume upload and AI parsing (ML + LangChain/OpenAI fallback)

This guide covers complete setup, run, usage, API testing, and troubleshooting.

## 2. Project Structure

- `frontend/` - UI application (Vite + React)
- `backend/` - API application (FastAPI)
- `backend/app/data/test_data.default.json` - baseline immutable dataset
- `backend/app/data/test_data.json` - runtime mutable dataset
- `campaigns_tab_mass_email.html` - source prototype reference
- `day_to_day_report_dashboard.html` - source prototype reference
- `job_automation_platform.html` - source prototype reference
- `submission_progress_dashboard_mom_yoy_calendar.html` - source prototype reference

## 3. Prerequisites

Install the following tools:

- Node.js 18+
- npm 9+
- Python 3.9+
- pip

Optional:

- PostgreSQL 14+ (only required when running with real DB instead of seed data)

## 4. First-Time Setup

### 4.1 Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
```

### 4.2 Backend Setup

```bash
cd backend
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 5. Run the Application

Run backend and frontend in separate terminals.

### 5.1 Start Backend (fixed port)

```bash
/Users/VenkataRamana.Rasannagari/cacode/MarktingMindAI/backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir /Users/VenkataRamana.Rasannagari/cacode/MarktingMindAI/backend --env-file /Users/VenkataRamana.Rasannagari/cacode/MarktingMindAI/backend/.env
```

Note:

- This absolute-path launch command is the most reliable when terminal working directory changes.
- `GET /health` requires Authorization (user/admin/super-admin token).

### 5.2 Start Frontend (fixed preferred port)

```bash
cd frontend
npm run dev -- --port 5173 --strictPort
```

### 5.3 Access URLs

- Frontend app: `http://localhost:5173`
- Swagger docs: `http://127.0.0.1:8000/docs`
- OpenAPI spec: `http://127.0.0.1:8000/openapi.json`

## 6. Frontend Navigation Guide

Use left sidebar navigation:

1. Command Center (`/`)
2. Campaign Studio (`/campaigns`)
3. Job Automation (`/job-automation`)
4. Day Report (`/day-report`)
5. Submissions (`/submissions`)
6. API Explorer (`/api-explorer`)

Use `Refresh data` button in sidebar to reload all workspace data from backend.

## 7. Authentication and RBAC

The application now requires login for API-backed screens.

### 7.1 Demo Accounts (Hard-Coded in Backend)

- Super Admin: `superadmin@marketingmind.ai` / `Super@123`
- Admin: `admin@marketingmind.ai` / `Admin@123`
- User: `user@marketingmind.ai` / `User@123`

### 7.2 Role Access Model

- Super Admin:
  - Full access to all endpoints
  - Can run test-data append/reset endpoints
- Admin:
  - Next-level operational access (campaign/job management endpoints)
  - Cannot run super-admin-only reset/append control endpoints
- User:
  - View-focused access
  - Can access read/dashboard endpoints
  - Restricted from privileged mutation endpoints such as campaign launch

### 7.3 Login/Registration/Logout Flow

1. Open app and use Dashboard auth panel
2. Login with demo account OR register a new account
3. Role and session come from backend auth endpoints
4. Logout from sidebar (`Logout`) to end current session

## 8. Module Usage

### 7.1 Command Center

Use this page to:

- Review high-level metrics and module summaries
- Check operational feed and production posture notes

### 7.2 Campaign Studio

Use this page to:

- Compose campaign content
- Manage contact lists
- Preview campaign payload
- Send test campaign
- Launch campaign
- Save campaign settings

### 7.3 Job Automation

Use this page to:

- Update profile
- Run job search with filters
- Add portals and carriers
- Apply to jobs
- Analyze job fit
- Upload resume and parse with AI-assisted extraction/scoring

Resume parsing behavior:

- Accepts `.txt`, `.pdf`, and `.docx` uploads
- Extracts profile fields (name/email/phone/location/skills/experience)
- Runs ML-based skill match scoring (keyword overlap + TF-IDF cosine when available)
- Runs LangChain/OpenAI insights when API key is configured
- Falls back to non-LLM parsing when no key is configured

### 7.4 Day Report

Use this page to:

- Filter recruiter activity by date and recruiter
- Review totals and trend charts
- Inspect table rows for daily activity details

### 7.5 Submissions

Use this page to:

- Analyze monthly submissions
- Apply month range filters
- Review MoM/YoY trend values

### 7.6 API Explorer

Use this page to:

- Fetch live endpoint catalog from backend code
- View request example and response example per endpoint
- Open Swagger docs directly from UI

## 9. Backend API Reference

### 8.1 Health

- `GET /health`

### 8.2 Overview

- `GET /api/overview`

### 8.3 Campaigns

- `GET /api/campaigns/workspace`
- `POST /api/campaigns/preview`
- `POST /api/campaigns/test-send`
- `POST /api/campaigns/launch`
- `PUT /api/campaigns/settings`
- `POST /api/campaigns/lists`

### 8.4 Job Automation

- `GET /api/job-automation/workspace`
- `PUT /api/job-automation/profile`
- `POST /api/job-automation/search/run`
- `POST /api/job-automation/portals`
- `POST /api/job-automation/carriers`
- `POST /api/job-automation/apply`
- `POST /api/job-automation/analyze`
- `POST /api/job-automation/resume/parse` (multipart form-data)

Resume parse form fields:

- `file` (required)
- `targetRole` (optional, defaults to `Software Engineer`)
- `requiredSkills` (optional, comma-separated)

### 8.5 Day Report

- `GET /api/day-report/dashboard`
- `POST /api/day-report/filter`

### 8.6 Submissions

- `GET /api/submissions/dashboard`
- `POST /api/submissions/filter`

### 8.7 Meta

- `GET /api/meta/endpoints`
- `GET /api/meta/test-data`
- `POST /api/meta/test-data/append`
- `POST /api/meta/test-data/reset`

## 10. Swagger API Usage

### 9.1 Open Swagger

Navigate to:

`http://127.0.0.1:8000/docs`

### 9.2 Test Endpoint in Swagger

1. Expand endpoint
2. Click `Try it out`
3. Enter request body (if required)
4. Click `Execute`
5. Inspect status code and response payload

## 11. Test Data Operations

### 10.1 Export Current Runtime Dataset

```bash
curl -s http://127.0.0.1:8000/api/meta/test-data
```

### 10.2 Append Rows to a Dataset

```bash
curl -s -X POST http://127.0.0.1:8000/api/meta/test-data/append \
  -H 'Content-Type: application/json' \
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

### 10.3 Reset Runtime Dataset to Baseline

```bash
curl -s -X POST http://127.0.0.1:8000/api/meta/test-data/reset
```

## 12. PostgreSQL Configuration (Optional)

Set `DATABASE_URL` in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/marketingmind
```

If not configured, API runs with JSON seed data and returns database status `not_configured`.

Current local default setup uses SQLite in `backend/.env`:

```env
DATABASE_URL=sqlite+pysqlite:///./marketingmind.db
```

This returns database status `available` when the backend can connect.

### 12.1 Enable Real LLM Analysis (Optional)

Set the following in `backend/.env`:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

If `OPENAI_API_KEY` is empty, resume parser returns fallback LLM status and still provides rule-based + ML outputs.

### 12.2 Install Latest Backend Dependencies

```bash
cd backend
.venv/bin/python -m pip install -r requirements.txt
```

Newly used packages include:

- `langchain`
- `langchain-openai`
- `scikit-learn`
- `pypdf`
- `python-docx`

## 13. Build and Validation

### 12.1 Frontend Production Build

```bash
cd frontend
npm run build
```

### 12.2 Backend Endpoint Smoke Check

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@marketingmind.ai","password":"Admin@123"}' | jq -r '.token')
curl -s http://127.0.0.1:8000/health -H "Authorization: Bearer $TOKEN"
```

### 12.3 Resume Parse API Smoke Check

```bash
cat > /tmp/resume_sample.txt <<'EOF'
John Doe
john@example.com
+1 555-222-3333
Austin, TX
8 years of experience in Python, FastAPI, SQL, AWS and Docker.
Built APIs and ML-assisted workflows.
EOF

TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@marketingmind.ai","password":"Admin@123"}' | jq -r '.token')

curl -s -X POST http://127.0.0.1:8000/api/job-automation/resume/parse \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/resume_sample.txt;type=text/plain" \
  -F "targetRole=Backend Engineer" \
  -F "requiredSkills=Python,FastAPI,SQL,AWS,Docker"
```

## 14. Troubleshooting

### 13.1 `uvicorn: command not found` (exit 127)

Cause:

- Running global `uvicorn` without backend venv

Fix:

```bash
/Users/VenkataRamana.Rasannagari/cacode/MarktingMindAI/backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir /Users/VenkataRamana.Rasannagari/cacode/MarktingMindAI/backend --env-file /Users/VenkataRamana.Rasannagari/cacode/MarktingMindAI/backend/.env
```

### 13.2 `.venv/bin/python: no such file or directory`

Cause:

- Running command from wrong folder

Fix:

- Run from `backend/`, or use full path `backend/.venv/bin/python`
- Preferred: use the absolute backend interpreter path shown above.

### 13.3 `Address already in use`

Cause:

- Port already occupied

Fix:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -tiTCP:8000 -sTCP:LISTEN | xargs -r kill -9
```

For frontend ports:

```bash
for p in 5173 5174 5175 5176; do lsof -tiTCP:$p -sTCP:LISTEN | xargs -r kill -9; done
```

### 13.4 `npm run dev.` fails

Cause:

- Invalid command typo (trailing dot)

Fix:

```bash
npm run dev
```

### 13.5 Swagger not opening

Checks:

1. Verify backend is running on `127.0.0.1:8000`
2. Verify status code:

```bash
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/docs
```

Expected result: `200`

### 13.6 `pip install -r requirements.txt` timeout/network reset

Cause:

- Transient network timeout while downloading packages

Fix:

```bash
cd backend
.venv/bin/python -m pip install --default-timeout=180 -r requirements.txt
```

## 15. Operational Recommendations

1. Keep backend and frontend in separate terminals for clean logs.
2. Use fixed ports (`8000`, `5173`) for stable local routing.
3. Use `--strictPort` for frontend to avoid silent port changes.
4. Use API Explorer to keep frontend requests aligned with backend contract.
5. Use Swagger for request validation before wiring UI actions.
6. Reset test data after experiments for deterministic behavior.

## 16. Quick Start Checklist

1. Create venv and install backend dependencies.
2. Install frontend dependencies.
3. Start backend on `127.0.0.1:8000`.
4. Start frontend on `localhost:5173`.
5. Open app and verify pages load.
6. Open Swagger and test one endpoint.
7. Open API Explorer and confirm endpoint catalog loads.

---

Document version: 1.1
Generated date: 2026-05-28
