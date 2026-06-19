# MarketingMind AI — PostgreSQL Schema

**Connection (local):**
```
Host:     localhost
Port:     5432
Database: postgres
Username: postgres
Password: admin
URL:      postgresql+psycopg://postgres:admin@localhost:5432/postgres
```

## Initialize

From `backend/`:

```powershell
python scripts/init_postgres_schema.py
```

This creates **29 tables** and seeds demo data from `app/data/test_data.json`.

## Tables (29)

### Auth & users
| Table | Description |
|-------|-------------|
| `users` | Accounts (demo: superadmin, admin, user) |
| `user_settings` | Notification & UI preferences per user |
| `auth_sessions` | Bearer tokens / sessions |

### Campaigns
| Table | Description |
|-------|-------------|
| `campaign_settings` | SMTP, tracking, AI assist flags |
| `contact_lists` | Named recipient lists |
| `campaign_contacts` | Individual campaign recipients |
| `campaign_templates` | Reusable email templates |
| `campaign_items` | Sent/scheduled campaigns |

### Job automation
| Table | Description |
|-------|-------------|
| `job_profiles` | Candidate profile (resume, visa, rate, etc.) |
| `job_automation_settings` | Auto-apply, threshold, schedule |
| `search_configs` | Titles, skills, location, filters |
| `portals` | Job board URLs (Dice, Monster, …) |
| `carriers` | Company career pages |
| `job_results` | Matched job listings |
| `saved_jobs` | User ↔ job favorites (junction) |
| `job_applications` | Application tracker rows |
| `tailored_resumes` | Per-job tailored CV content |
| `linkedin_jobs` | LinkedIn search result cache |
| `job_analyses` | CV vs job analysis results |

### LinkedIn recruiter
| Table | Description |
|-------|-------------|
| `linkedin_recruiters` | Discovered recruiter profiles |
| `linkedin_sequences` | Outreach sequences |
| `linkedin_sequence_steps` | Steps within a sequence |
| `linkedin_followups` | Due follow-up reminders |
| `linkedin_message_templates` | Message templates |
| `linkedin_settings` | Automation limits & flags |
| `linkedin_api_sources` | Apollo, Hunter, etc. |
| `linkedin_api_keys` | API keys per user/provider |

### Reporting
| Table | Description |
|-------|-------------|
| `day_report_rows` | Daily recruiter activity |
| `submission_months` | Monthly submission totals |

## SQLAlchemy models

All models live in `app/db/models.py`.

## Notes

- API routes still use JSON seed data (`use_seed_data=true`). PostgreSQL is ready for a future repository layer.
- JSON/array fields use PostgreSQL `JSONB` (skills, job titles, filters, etc.).
- Demo users seeded with passwords matching `app/core/auth.py`.
