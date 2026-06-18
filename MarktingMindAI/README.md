# MarketingMind AI

Production-oriented recruiter operations workspace rebuilt from the legacy HTML prototypes.

## Structure

- `frontend/`: React 19 + Vite application with routed pages for campaigns, dashboards, job automation, and submissions.
- `backend/`: FastAPI service exposing seeded module APIs and PostgreSQL-ready configuration.
- Root HTML files: original reference prototypes preserved for comparison.

## Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Backend

```bash
cd backend
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Run Both Services (Verified)

Use these exact commands in separate terminals:

```bash
# terminal 1
cd backend
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# terminal 2
cd frontend
npm run dev
```

## Troubleshooting

- `zsh: no such file or directory: .venv/bin/python`:
	- Run from `backend/`, not repo root.
	- Correct path from repo root is `backend/.venv/bin/python`.
- `uvicorn: command not found` (exit code `127`):
	- Use `.venv/bin/python -m uvicorn ...` so the venv interpreter is always used.
- `ERROR: [Errno 48] Address already in use`:
	- Another server is already running on the same port.
	- Find listeners: `lsof -nP -iTCP:8000 -sTCP:LISTEN`.
	- Either stop old processes or choose another port (for example `--port 8001`).
- `npm run dev.` fails:
	- The trailing `.` makes it an invalid npm script command.
	- Use `npm run dev`.

## PostgreSQL

Set `DATABASE_URL` in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/marketingmind
```

If `DATABASE_URL` is omitted, the API still serves seed data and reports database status as `not_configured`.

## Backend Test Data JSON

Production-ready test data is stored as JSON files in the backend:

- `backend/app/data/test_data.default.json`: baseline immutable seed source.
- `backend/app/data/test_data.json`: runtime mutable test data used by APIs.

New meta endpoints:

- `GET /api/meta/test-data`: export the full test dataset and record counts.
- `POST /api/meta/test-data/append`: append records to list-based datasets.
- `POST /api/meta/test-data/reset`: reset runtime test data from baseline.

Append request example:

```json
{
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
}
```
