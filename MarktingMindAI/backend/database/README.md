-- MarketingMind AI — PostgreSQL schema reference
-- Generated from SQLAlchemy models in app/db/models.py
-- Run: python scripts/init_postgres_schema.py

-- Auth & users
-- users, user_settings, auth_sessions

-- Campaigns
-- campaign_settings, contact_lists, campaign_contacts, campaign_templates, campaign_items

-- Job automation
-- job_profiles, job_automation_settings, search_configs, portals, carriers,
-- job_results, saved_jobs, job_applications, tailored_resumes, linkedin_jobs, job_analyses

-- LinkedIn recruiter
-- linkedin_recruiters, linkedin_sequences, linkedin_sequence_steps,
-- linkedin_followups, linkedin_message_templates, linkedin_settings,
-- linkedin_api_sources, linkedin_api_keys

-- Reporting
-- day_report_rows, submission_months

-- Connection:
--   postgresql://postgres:admin@localhost:5432/postgres
