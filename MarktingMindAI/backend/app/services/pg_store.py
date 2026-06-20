from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import session_scope
from app.db.models import (
    CampaignContact,
    CampaignItem,
    CampaignSettings,
    CampaignTemplate,
    Carrier,
    ContactList,
    DayReportRow,
    JobAnalysis,
    JobApplication,
    JobAutomationSettings,
    JobProfile,
    JobResult,
    LinkedInApiKey,
    LinkedInApiSource,
    LinkedInFollowup,
    LinkedInJob,
    LinkedInMessageTemplate,
    LinkedInRecruiter,
    LinkedInSequence,
    LinkedInSequenceStep,
    LinkedInSettings,
    Portal,
    SavedJob,
    SearchConfig,
    SubmissionMonth,
    TailoredResume,
    User,
)
from app.services import seed_data as seed_logic
from app.services.job_match_ai import enrich_and_rank_jobs
from app.services.portal_scraper import scrape_all_portal_jobs

WORKSPACE_EMAIL = "admin@marketingmind.ai"


def _workspace_user(session: Session) -> User:
    user = session.query(User).filter(User.email == WORKSPACE_EMAIL).first()
    if not user:
        user = session.query(User).order_by(User.id).first()
    if not user:
        raise RuntimeError("Database has no users. Run: python scripts/init_postgres_schema.py")
    return user


def _job_result_dict(row: JobResult) -> dict:
    return {
        "id": row.id,
        "role": row.role,
        "company": row.company,
        "location": row.location,
        "type": row.type,
        "posted": row.posted,
        "rate": row.rate,
        "match": row.match,
        "hot": row.hot,
        "skills": row.skills or [],
        "portalName": row.portal_name,
        "portalUrl": row.portal_url,
        "sourceUrl": row.source_url,
        "description": row.description,
    }


def _application_dict(row: JobApplication) -> dict:
    app_date = row.application_date.isoformat() if row.application_date else row.updated_label
    return {
        "role": row.role,
        "company": row.company,
        "status": row.status,
        "stage": row.stage,
        "updated": row.updated_label,
        "action": row.action_label,
        "portal": row.portal,
        "date": app_date,
        "match": row.match,
        "postingUrl": row.posting_url,
    }


def _profile_dict(row: JobProfile) -> dict:
    return {
        "name": row.name,
        "email": row.email,
        "phone": row.phone,
        "location": row.location,
        "linkedin": row.linkedin,
        "experience": row.experience,
        "employmentType": row.employment_type,
        "rate": row.rate,
        "visa": row.visa,
        "workMode": row.work_mode,
        "jobTitles": row.job_titles or [],
        "resumeFileName": row.resume_file_name,
        "resumeSummary": row.resume_summary,
        "resumeSkills": row.resume_skills or [],
    }


def _search_dict(row: SearchConfig) -> dict:
    return {
        "titles": row.titles or [],
        "requiredSkills": row.required_skills or [],
        "optionalSkills": row.optional_skills or [],
        "location": row.location,
        "radius": row.radius,
        "filters": row.filters or [],
        "excludeKeywords": row.exclude_keywords or [],
        "employmentType": row.employment_type,
        "minMatchScore": row.min_match_score,
        "postedWithin": row.posted_within,
        "experienceLevel": row.experience_level,
        "rateMin": row.rate_min,
        "rateMax": row.rate_max,
        "repeatEvery": row.repeat_every,
    }


def _automation_dict(row: JobAutomationSettings) -> dict:
    return {
        "autoApply": row.auto_apply,
        "matchThreshold": row.match_threshold,
        "maxApplications": row.max_applications,
        "alerts": row.alerts,
        "tailorCv": row.tailor_cv,
        "scheduleEnabled": row.schedule_enabled,
        "scheduleLabel": row.schedule_label,
        "scheduleTimezone": row.schedule_timezone,
        "scheduleTime": row.schedule_time,
    }


def _campaign_metrics(session: Session, user_id: int) -> dict:
    items = session.query(CampaignItem).filter(CampaignItem.user_id == user_id).all()
    total_sent = sum(item.sent_count for item in items)
    total_opened = sum(item.opened_count for item in items)
    total_replied = sum(item.replied_count for item in items)
    open_rate = 0 if total_sent == 0 else round(total_opened / total_sent * 100)
    reply_rate = 0 if total_sent == 0 else round(total_replied / total_sent * 100)
    return {"emailsSent": total_sent, "openRate": open_rate, "replyRate": reply_rate, "bounceRate": 2}


def get_overview_payload() -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        metrics = _campaign_metrics(session, user.id)
        job_count = session.query(JobResult).filter(JobResult.user_id == user.id).count()
        latest_submission = (
            session.query(SubmissionMonth).order_by(SubmissionMonth.month.desc()).first()
        )
        return {
            "headline": "MarketingMind AI operating system for staffing campaigns, recruiter dashboards, and job automation.",
            "modules": [
                {
                    "slug": "campaigns",
                    "label": "Campaign Studio",
                    "description": "Mass email drafting, templates, contact lists, scheduling, and compliance.",
                    "metric": f"{metrics['emailsSent']:,} sends",
                },
                {
                    "slug": "job-automation",
                    "label": "Job Automation",
                    "description": "Profile setup, search automation, portal management, CV analysis, LinkedIn, and tracker.",
                    "metric": f"{job_count} high-match roles",
                },
                {
                    "slug": "day-report",
                    "label": "Day-to-Day Dashboard",
                    "description": "Recruiter performance trends across outreach, calls, sourcing, and marketing.",
                    "metric": "10 days tracked",
                },
                {
                    "slug": "submissions",
                    "label": "Submission Progress",
                    "description": "Month-over-month and year-over-year submission visibility with trend analysis.",
                    "metric": f"{latest_submission.submissions if latest_submission else 0} this month",
                },
            ],
            "activity": [
                {"title": "Campaign queue ready", "detail": "Data/AI Bench Update is scheduled for 08:45 with smart throttling enabled."},
                {"title": "Recruiter output rising", "detail": "Komal leads sourced volume this week with 18 qualified profiles."},
                {"title": "Action required", "detail": "One AI/ML application needs a tailored resume before submission."},
            ],
        }


def get_campaign_workspace() -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        templates = session.query(CampaignTemplate).filter(CampaignTemplate.user_id == user.id).all()
        settings = session.query(CampaignSettings).filter(CampaignSettings.user_id == user.id).first()
        return {
            "metrics": _campaign_metrics(session, user.id),
            "composer": {
                "campaignName": "May Talent Pulse - Southwest",
                "fromName": "Sarah Mitchell",
                "fromEmail": "sarah@marketingmind.ai",
                "replyTo": "recruiter@marketingmind.ai",
                "subject": "Available consultants | {{candidate_name}} | {{location}} | C2C",
                "body": templates[0].body if templates else "",
                "mergeTags": [
                    "{{recruiter_name}}",
                    "{{candidate_name}}",
                    "{{skills}}",
                    "{{location}}",
                    "{{rate}}",
                    "{{availability}}",
                    "{{visa_status}}",
                    "{{company_name}}",
                ],
                "aiPrompts": [
                    "Hotlist blast",
                    "Candidate intro",
                    "Follow-up",
                    "Urgent placement",
                    "Bench sales",
                    "Re-introduction",
                ],
            },
            "contacts": [
                {
                    "name": row.name,
                    "email": row.email,
                    "company": row.company,
                    "status": row.status,
                    "list": row.list_name,
                }
                for row in session.query(CampaignContact).filter(CampaignContact.user_id == user.id).all()
            ],
            "lists": [
                {
                    "name": row.name,
                    "contacts": row.contacts_count,
                    "openRate": row.open_rate,
                    "replyRate": row.reply_rate,
                }
                for row in session.query(ContactList).filter(ContactList.user_id == user.id).all()
            ],
            "campaigns": [
                {
                    "name": row.name,
                    "status": row.status,
                    "scheduledFor": row.scheduled_for,
                    "sent": row.sent_count,
                    "opened": row.opened_count,
                    "replied": row.replied_count,
                    "subject": row.subject,
                    "body": row.body,
                }
                for row in session.query(CampaignItem).filter(CampaignItem.user_id == user.id).all()
            ],
            "templates": [
                {
                    "name": row.name,
                    "category": row.category,
                    "description": row.description or row.category,
                    "subject": row.subject,
                    "body": row.body,
                }
                for row in templates
            ],
            "settings": _serialize_campaign_settings(settings),
        }


def _serialize_campaign_settings(settings: CampaignSettings | None) -> dict:
    if not settings:
        return {
            "smtpHost": "smtp.gmail.com",
            "smtpPort": 587,
            "smtpUsername": "",
            "smtpPassword": "",
            "senderLimit": 500,
            "emailDelaySeconds": 3,
            "smartWarmup": True,
            "unsubscribeFooter": True,
            "spamGuard": True,
            "gmailSync": False,
            "outlookSync": False,
            "openTracking": True,
            "aiSubjectAssist": True,
        }
    options = settings.options_json or {}
    return {
        "smtpHost": settings.smtp_host,
        "smtpPort": settings.smtp_port,
        "smtpUsername": settings.smtp_username or "",
        "smtpPassword": settings.smtp_password or "",
        "senderLimit": settings.sender_limit,
        "emailDelaySeconds": settings.email_delay_seconds,
        "smartWarmup": settings.smart_warmup,
        "unsubscribeFooter": settings.unsubscribe_footer,
        "spamGuard": settings.spam_guard,
        "gmailSync": settings.gmail_sync,
        "outlookSync": settings.outlook_sync,
        "openTracking": settings.open_tracking,
        "aiSubjectAssist": settings.ai_subject_assist,
        **options,
    }


def _load_campaign_settings(session: Session, user_id: int) -> dict:
    settings = session.query(CampaignSettings).filter(CampaignSettings.user_id == user_id).first()
    return _serialize_campaign_settings(settings)


def _load_campaign_contacts(session: Session, user_id: int) -> List[dict]:
    return [
        {
            "name": row.name,
            "email": row.email,
            "company": row.company,
            "status": row.status,
            "list": row.list_name,
        }
        for row in session.query(CampaignContact).filter(CampaignContact.user_id == user_id).all()
    ]


def get_job_automation_workspace() -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        profile = session.query(JobProfile).filter(JobProfile.user_id == user.id).first()
        automation = session.query(JobAutomationSettings).filter(JobAutomationSettings.user_id == user.id).first()
        search = session.query(SearchConfig).filter(SearchConfig.user_id == user.id).first()
        job_results = [_job_result_dict(row) for row in session.query(JobResult).filter(JobResult.user_id == user.id).all()]
        applications = [
            _application_dict(row)
            for row in session.query(JobApplication).filter(JobApplication.user_id == user.id).all()
        ]
        interviews = [item for item in applications if item["status"] == "Interview"]
        action_needed = [item for item in applications if item["status"] == "Action Needed"]
        app_stats = seed_logic._compute_application_stats(applications, job_results)
        analysis = session.query(JobAnalysis).filter(JobAnalysis.user_id == user.id).order_by(JobAnalysis.id.desc()).first()
        saved_jobs = [
            row.job_result_id
            for row in session.query(SavedJob).filter(SavedJob.user_id == user.id).all()
        ]
        linkedin_jobs = session.query(LinkedInJob).filter(LinkedInJob.user_id == user.id).all()
        return {
            "stats": {
                "appliedToday": 6,
                "newMatches": len(job_results),
                "interviews": len(interviews),
                "avgMatchScore": round(sum(job["match"] for job in job_results) / len(job_results)) if job_results else 0,
            },
            "profile": _profile_dict(profile) if profile else {},
            "automation": _automation_dict(automation) if automation else {},
            "search": _search_dict(search) if search else {},
            "portals": [
                {"name": row.name, "url": row.url, "status": row.status}
                for row in session.query(Portal).filter(Portal.user_id == user.id).all()
            ],
            "carriers": [
                {"name": row.name, "url": row.url, "status": row.status}
                for row in session.query(Carrier).filter(Carrier.user_id == user.id).all()
            ],
            "results": job_results,
            "savedJobs": saved_jobs,
            "analysis": {
                "selectedJobId": analysis.job_result_id if analysis else 1,
                "score": analysis.score if analysis else 0,
                "summary": analysis.summary if analysis else "",
                "hits": analysis.hits if analysis else [],
                "misses": analysis.misses if analysis else [],
                "suggestions": analysis.suggestions if analysis else [],
            },
            "linkedin": [
                {
                    "role": row.role,
                    "company": row.company,
                    "location": row.location,
                    "type": row.type,
                    "posted": row.posted,
                    "match": row.match,
                    "easyApply": row.easy_apply,
                    "applicants": row.applicants,
                    "insight": row.insight,
                    "linkedinUrl": row.linkedin_url,
                    "experienceLevel": row.experience_level,
                    "datePosted": row.date_posted,
                }
                for row in linkedin_jobs
            ],
            "applications": {
                "all": applications,
                "interviews": interviews,
                "actionNeeded": action_needed,
                "stats": app_stats,
            },
        }


def _get_or_create_job_profile(session: Session, user: User) -> JobProfile:
    profile = session.query(JobProfile).filter(JobProfile.user_id == user.id).first()
    if profile:
        return profile
    profile = JobProfile(
        user_id=user.id,
        name="New Candidate",
        email="candidate@email.com",
        phone="",
        location="",
        linkedin="",
        experience="3-5 Years",
        employment_type="Both",
        rate="",
        visa="",
        work_mode="Remote",
        job_titles=[],
        resume_skills=[],
    )
    session.add(profile)
    session.flush()
    return profile


def _get_or_create_search(session: Session, user: User) -> SearchConfig:
    search = session.query(SearchConfig).filter(SearchConfig.user_id == user.id).first()
    if search:
        return search
    search = SearchConfig(user_id=user.id)
    session.add(search)
    session.flush()
    return search


def _get_or_create_automation(session: Session, user: User) -> JobAutomationSettings:
    automation = session.query(JobAutomationSettings).filter(JobAutomationSettings.user_id == user.id).first()
    if automation:
        return automation
    automation = JobAutomationSettings(user_id=user.id)
    session.add(automation)
    session.flush()
    return automation


def save_job_profile(payload: dict) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        profile = _get_or_create_job_profile(session, user)
        field_map = {
            "name": "name",
            "email": "email",
            "phone": "phone",
            "location": "location",
            "linkedin": "linkedin",
            "experience": "experience",
            "employmentType": "employment_type",
            "rate": "rate",
            "visa": "visa",
            "workMode": "work_mode",
            "resumeFileName": "resume_file_name",
            "resumeSummary": "resume_summary",
        }
        for key, attr in field_map.items():
            if key in payload and payload[key] is not None:
                setattr(profile, attr, payload[key])
        if payload.get("resumeSkills"):
            profile.resume_skills = payload["resumeSkills"]
        if payload.get("jobTitles"):
            profile.job_titles = payload["jobTitles"]
            search = _get_or_create_search(session, user)
            search.titles = list(dict.fromkeys(payload["jobTitles"] + (search.titles or [])))
        session.flush()
        search = _get_or_create_search(session, user)
        return {
            "success": True,
            "message": "Job profile updated.",
            "profile": _profile_dict(profile),
            "search": _search_dict(search),
        }


def save_automation_settings(payload: dict) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        automation = _get_or_create_automation(session, user)
        field_map = {
            "autoApply": "auto_apply",
            "matchThreshold": "match_threshold",
            "maxApplications": "max_applications",
            "alerts": "alerts",
            "tailorCv": "tailor_cv",
            "scheduleEnabled": "schedule_enabled",
            "scheduleLabel": "schedule_label",
            "scheduleTimezone": "schedule_timezone",
            "scheduleTime": "schedule_time",
        }
        for key, attr in field_map.items():
            if key in payload and payload[key] is not None:
                setattr(automation, attr, payload[key])
        session.flush()
        return {
            "success": True,
            "message": "Automation settings saved.",
            "automation": _automation_dict(automation),
        }


def save_search_config(payload: dict) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        search = _get_or_create_search(session, user)
        field_map = {
            "titles": "titles",
            "requiredSkills": "required_skills",
            "optionalSkills": "optional_skills",
            "location": "location",
            "radius": "radius",
            "filters": "filters",
            "excludeKeywords": "exclude_keywords",
            "employmentType": "employment_type",
            "minMatchScore": "min_match_score",
            "postedWithin": "posted_within",
            "experienceLevel": "experience_level",
            "rateMin": "rate_min",
            "rateMax": "rate_max",
            "repeatEvery": "repeat_every",
        }
        for key, attr in field_map.items():
            if key in payload and payload[key] is not None:
                setattr(search, attr, payload[key])
        session.flush()
        return {
            "success": True,
            "message": "Search configuration saved.",
            "search": _search_dict(search),
        }


def apply_parsed_resume(parsed: dict, filename: str) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        profile = _get_or_create_job_profile(session, user)
        search = _get_or_create_search(session, user)
        if parsed.get("fullName"):
            profile.name = parsed["fullName"]
        if parsed.get("email"):
            profile.email = parsed["email"]
        if parsed.get("phone"):
            profile.phone = parsed["phone"]
        if parsed.get("location"):
            profile.location = parsed["location"]
        experience_label = seed_logic._years_to_experience_label(parsed.get("yearsExperience"))
        if experience_label:
            profile.experience = experience_label
        skills = parsed.get("skills") or []
        titles = parsed.get("jobTitles") or []
        if skills:
            profile.resume_skills = list(dict.fromkeys(skills + (profile.resume_skills or [])))
            search.required_skills = list(dict.fromkeys(skills + (search.required_skills or [])))
        if titles:
            profile.job_titles = list(dict.fromkeys(titles + (profile.job_titles or [])))
            search.titles = list(dict.fromkeys(titles + (search.titles or [])))
        profile.resume_file_name = filename
        profile.resume_summary = parsed.get("summary") or profile.resume_summary or ""
        session.flush()
        return {"profile": _profile_dict(profile), "search": _search_dict(search)}


def _next_job_result_id(session: Session) -> int:
    current_max = session.query(func.max(JobResult.id)).scalar()
    return int(current_max or 0) + 1


def _scrape_configured_portals(session: Session, user: User) -> dict:
    search = _get_or_create_search(session, user)
    profile = _get_or_create_job_profile(session, user)
    portals = [
        {"name": row.name, "url": row.url, "status": row.status}
        for row in session.query(Portal).filter(Portal.user_id == user.id).all()
    ]
    if not portals:
        return {"scraped": 0, "portalCount": 0}

    existing_jobs = [
        _job_result_dict(row)
        for row in session.query(JobResult).filter(JobResult.user_id == user.id).all()
    ]
    titles = search.titles or profile.job_titles or ["Software Engineer"]
    skills = profile.resume_skills or []
    required_skills = search.required_skills or skills
    location = search.location or profile.location or "Remote"
    next_id = _next_job_result_id(session)
    scraped_jobs, _ = scrape_all_portal_jobs(
        portals,
        titles=titles,
        skills=skills,
        required_skills=required_skills,
        location=location,
        existing_jobs=existing_jobs,
        next_job_id=next_id,
    )

    for job in scraped_jobs:
        session.add(
            JobResult(
                id=job["id"],
                user_id=user.id,
                role=job["role"],
                company=job["company"],
                location=job["location"],
                type=job["type"],
                posted=str(job["posted"]),
                rate=job.get("rate"),
                match=job.get("match", 0),
                hot=job.get("hot", False),
                skills=job.get("skills", []),
                portal_name=job.get("portalName"),
                portal_url=job.get("portalUrl"),
                source_url=job.get("sourceUrl"),
                description=job.get("description"),
            )
        )

    session.flush()
    active_count = len([portal for portal in portals if (portal.get("status") or "Active") == "Active"]) or len(portals)
    return {"scraped": len(scraped_jobs), "portalCount": active_count}


def _job_text_blob(job: dict) -> str:
    return " ".join(
        [
            job.get("role", ""),
            job.get("company", ""),
            job.get("location", ""),
            job.get("description", ""),
            " ".join(job.get("skills", [])),
        ]
    ).lower()


def _filter_job_results(
    jobs: List[dict],
    *,
    titles: List[str],
    required_skills: List[str],
    optional_skills: List[str],
    employment_type: str,
    exclude_keywords: List[str],
    posted_within: int,
    experience_level: str,
    rate_min: Optional[float],
    rate_max: Optional[float],
    portals: List[dict],
    min_score: Optional[int] = None,
) -> List[dict]:
    filtered = []
    for job in jobs:
        role_text = job["role"].lower()
        if titles and not any(title.lower() in role_text for title in titles):
            continue
        if min_score is not None and job.get("match", 0) < min_score:
            continue
        if not seed_logic._employment_matches(job.get("type", ""), employment_type):
            continue
        if seed_logic._posted_within_days(job.get("posted", "999")) > posted_within:
            continue
        if not seed_logic._experience_matches(job, experience_level):
            continue
        job_rate = seed_logic._parse_rate_value(job.get("rate", ""))
        if rate_min is not None and job_rate is not None and job_rate < rate_min:
            continue
        if rate_max is not None and job_rate is not None and job_rate > rate_max:
            continue
        job_blob = _job_text_blob(job)
        if exclude_keywords and any(keyword in job_blob for keyword in exclude_keywords if keyword):
            continue
        if required_skills and not any(skill in job_blob for skill in required_skills):
            continue
        if optional_skills and not any(skill in job_blob for skill in optional_skills):
            if not required_skills:
                continue
        enriched = dict(job)
        if not enriched.get("portalName") and portals:
            portal = portals[job["id"] % len(portals)]
            enriched["portalName"] = portal["name"]
            enriched["portalUrl"] = portal["url"]
            enriched["sourceUrl"] = enriched.get("sourceUrl") or f"{portal['url']}/jobs/{job['id']}"
        filtered.append(enriched)
    return filtered


def _rank_jobs_with_cv(session: Session, user: User, jobs: List[dict]) -> tuple[List[dict], dict]:
    profile = _get_or_create_job_profile(session, user)
    search = _get_or_create_search(session, user)
    return enrich_and_rank_jobs(jobs, _profile_dict(profile), _search_dict(search))


def run_job_search(payload: dict) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        search = _get_or_create_search(session, user)
        for key, attr in {
            "titles": "titles",
            "requiredSkills": "required_skills",
            "optionalSkills": "optional_skills",
            "location": "location",
            "radius": "radius",
            "excludeKeywords": "exclude_keywords",
            "employmentType": "employment_type",
            "minMatchScore": "min_match_score",
            "postedWithin": "posted_within",
            "experienceLevel": "experience_level",
            "rateMin": "rate_min",
            "rateMax": "rate_max",
            "repeatEvery": "repeat_every",
        }.items():
            if key in payload and payload[key] is not None:
                setattr(search, attr, payload[key])
        session.flush()

        scrape_meta = _scrape_configured_portals(session, user)

        titles = payload.get("titles") or search.titles or []
        required_skills = [skill.lower() for skill in (payload.get("requiredSkills") or search.required_skills or [])]
        optional_skills = [skill.lower() for skill in (payload.get("optionalSkills") or search.optional_skills or [])]
        min_score = int(payload.get("minMatchScore", search.min_match_score or 70))
        employment_type = payload.get("employmentType", search.employment_type or "Both")
        exclude_keywords = [keyword.lower() for keyword in (payload.get("excludeKeywords") or search.exclude_keywords or [])]
        posted_within = int(payload.get("postedWithin") or search.posted_within or 30)
        experience_level = payload.get("experienceLevel") or search.experience_level or "Any"
        rate_min = seed_logic._parse_rate_value(payload.get("rateMin") or search.rate_min or "")
        rate_max = seed_logic._parse_rate_value(payload.get("rateMax") or search.rate_max or "")
        portals = [
            {"name": row.name, "url": row.url}
            for row in session.query(Portal).filter(Portal.user_id == user.id).all()
        ]
        jobs = [_job_result_dict(row) for row in session.query(JobResult).filter(JobResult.user_id == user.id).all()]
        prefiltered = _filter_job_results(
            jobs,
            titles=titles,
            required_skills=required_skills,
            optional_skills=optional_skills,
            employment_type=employment_type,
            exclude_keywords=exclude_keywords,
            posted_within=posted_within,
            experience_level=experience_level,
            rate_min=rate_min,
            rate_max=rate_max,
            portals=portals,
        )
        if not prefiltered and jobs:
            prefiltered = _filter_job_results(
                jobs,
                titles=[],
                required_skills=[],
                optional_skills=[],
                employment_type=employment_type,
                exclude_keywords=exclude_keywords,
                posted_within=posted_within,
                experience_level=experience_level,
                rate_min=rate_min,
                rate_max=rate_max,
                portals=portals,
            )
        ranked, matching_pipeline = _rank_jobs_with_cv(session, user, prefiltered)
        filtered = [job for job in ranked if job.get("match", 0) >= min_score]
        if not filtered and ranked:
            filtered = ranked[: min(len(ranked), 20)]
            matching_pipeline = {
                **matching_pipeline,
                "message": (
                    f"{matching_pipeline.get('message', '')} "
                    f"No jobs met {min_score}% threshold; showing top {len(filtered)} embedding-ranked matches."
                ).strip(),
            }
        ranked = filtered
        portal_names = ", ".join({portal["name"] for portal in portals}) if portals else "configured sources"
        scrape_note = (
            f" Scraped {scrape_meta['scraped']} new posting(s) across {scrape_meta['portalCount']} portal(s)."
            if scrape_meta["portalCount"]
            else ""
        )
        return {
            "success": True,
            "message": f"Search completed across {portal_names} with {len(ranked)} matching jobs (min {min_score}%).{scrape_note} {matching_pipeline['message']}",
            "results": ranked,
            "scrapedCount": scrape_meta["scraped"],
            "portalsScraped": scrape_meta["portalCount"],
            "matchingPipeline": matching_pipeline,
        }


def save_job(job_id: int) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        existing = (
            session.query(SavedJob)
            .filter(SavedJob.user_id == user.id, SavedJob.job_result_id == job_id)
            .first()
        )
        if existing:
            session.delete(existing)
            return {"success": True, "message": "Job removed from saved list.", "saved": False}
        session.add(SavedJob(user_id=user.id, job_result_id=job_id))
        return {"success": True, "message": "Job saved to favorites.", "saved": True}


def add_portal(name: str, url: str) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        portal = Portal(user_id=user.id, name=name, url=url, status="Active")
        session.add(portal)
        session.flush()
        return {"success": True, "message": f"Portal '{name}' added.", "portal": {"name": name, "url": url, "status": "Active"}}


def add_carrier(name: str, url: str) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        carrier = Carrier(user_id=user.id, name=name, url=url, status="Monitoring")
        session.add(carrier)
        session.flush()
        return {"success": True, "message": f"Carrier '{name}' added.", "carrier": {"name": name, "url": url, "status": "Monitoring"}}


def delete_portal(name: str, url: str) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        row = (
            session.query(Portal)
            .filter(Portal.user_id == user.id, Portal.name == name, Portal.url == url)
            .first()
        )
        if not row:
            raise ValueError(f"Portal '{name}' not found.")
        session.delete(row)
        return {"success": True, "message": f"Portal '{name}' removed."}


def delete_carrier(name: str, url: str) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        row = (
            session.query(Carrier)
            .filter(Carrier.user_id == user.id, Carrier.name == name, Carrier.url == url)
            .first()
        )
        if not row:
            raise ValueError(f"Carrier '{name}' not found.")
        session.delete(row)
        return {"success": True, "message": f"Carrier '{name}' removed."}


def import_portals(portals: List[dict]) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        existing_urls = {
            row.url
            for row in session.query(Portal).filter(Portal.user_id == user.id).all()
        }
        added = 0
        for item in portals:
            if item["url"] not in existing_urls:
                session.add(Portal(user_id=user.id, name=item["name"], url=item["url"], status="Active"))
                existing_urls.add(item["url"])
                added += 1
        session.flush()
        all_portals = [
            {"name": row.name, "url": row.url, "status": row.status}
            for row in session.query(Portal).filter(Portal.user_id == user.id).all()
        ]
        return {"success": True, "message": f"Imported {added} portal(s).", "portals": all_portals}


def import_carriers(carriers: List[dict]) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        existing_urls = {
            row.url
            for row in session.query(Carrier).filter(Carrier.user_id == user.id).all()
        }
        added = 0
        for item in carriers:
            if item["url"] not in existing_urls:
                session.add(
                    Carrier(
                        user_id=user.id,
                        name=item["name"],
                        url=item["url"],
                        status=item.get("status") or "Monitoring",
                    )
                )
                existing_urls.add(item["url"])
                added += 1
        session.flush()
        all_carriers = [
            {"name": row.name, "url": row.url, "status": row.status}
            for row in session.query(Carrier).filter(Carrier.user_id == user.id).all()
        ]
        return {"success": True, "message": f"Imported {added} carrier page(s).", "carriers": all_carriers}


def apply_jobs(job_ids: List[int]) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        selected_jobs = [
            _job_result_dict(row)
            for row in session.query(JobResult)
            .filter(JobResult.user_id == user.id, JobResult.id.in_(job_ids))
            .all()
        ]
        today = date.today().isoformat()
        for job in selected_jobs:
            session.add(
                JobApplication(
                    user_id=user.id,
                    job_result_id=job["id"],
                    role=job["role"],
                    company=job["company"],
                    status="Applied",
                    stage="Application submitted from test endpoint",
                    updated_label=today,
                    action_label="Await recruiter response",
                    portal=job.get("portalName") or "Direct",
                    application_date=date.today(),
                    match=job.get("match"),
                    posting_url=job.get("sourceUrl") or job.get("portalUrl") or "",
                )
            )
        return {
            "success": True,
            "message": f"Applied to {len(selected_jobs)} job(s).",
            "applied": len(selected_jobs),
        }


def analyze_job(job_id: Optional[int] = None, job_description: Optional[str] = None) -> dict:
    workspace = get_job_automation_workspace()
    jobs = workspace["results"]
    profile = workspace["profile"]
    selected = next((job for job in jobs if job["id"] == job_id), jobs[0] if jobs else None) if job_id else None
    cv_skills = profile.get("resumeSkills") or [
        "Java",
        "Spring Boot",
        "Python",
        "React",
        "AWS",
        "Docker",
        "Maven",
        "Git",
        "Agile",
        "REST APIs",
        "TypeScript",
    ]
    description = (job_description or "").strip() or (selected.get("description") if selected else "") or ""
    if not description and selected:
        description = (
            f"{selected['role']} at {selected['company']} in {selected['location']}. "
            f"Required skills: {', '.join(selected.get('skills', []))}. "
            f"Employment type: {selected.get('type', 'Contract')}."
        )
    if not description:
        description = job_description or "General software engineering role requiring cloud and API experience."

    job_skills = list(selected.get("skills", [])) if selected else []
    desc_lower = description.lower()
    for skill in cv_skills:
        if skill.lower() in desc_lower and skill not in job_skills:
            job_skills.append(skill)

    hits = [s for s in job_skills if s.lower() in desc_lower or any(s.lower() in cv.lower() for cv in cv_skills)]
    misses = [s for s in job_skills if s not in hits]
    extra_misses = [s for s in seed_logic.re_find_skills(description) if s not in hits and s not in misses]
    misses = list(dict.fromkeys(misses + extra_misses))[:8]
    score = max(55, min(98, round((len(hits) / max(len(job_skills), 1)) * 100))) if job_skills else 72
    if selected:
        score = max(score, selected.get("match", score) - 5)

    skill_gaps = misses[:5]
    recommendations = [
        f"Add '{miss}' to your skills section or project bullets." for miss in skill_gaps[:3]
    ] or ["Highlight recent project outcomes with measurable metrics."]
    role_label = selected["role"] if selected else "target role"
    company_label = selected["company"] if selected else "the employer"
    result = {
        "selectedJobId": selected["id"] if selected else None,
        "score": score,
        "summary": f"Analysis for {role_label} at {company_label}. Match score {score}% based on skills and description overlap.",
        "hits": hits if hits else job_skills[:3],
        "misses": misses if misses else ["Leadership metrics", "Portfolio link"],
        "suggestions": recommendations,
        "skillGaps": skill_gaps,
        "recommendations": recommendations,
        "experienceMatch": f"Your experience aligns with the requirements for {role_label}.",
        "titleMatch": f"'{role_label}' aligns with your profile job titles.",
        "jobDescription": description,
        "tailoredScore": None,
    }
    with session_scope() as session:
        user = _workspace_user(session)
        session.add(
            JobAnalysis(
                user_id=user.id,
                job_result_id=job_id,
                score=result.get("score", 0),
                summary=result.get("summary", ""),
                hits=result.get("hits", []),
                misses=result.get("misses", []),
                suggestions=result.get("suggestions", []),
                skill_gaps=result.get("skillGaps", []),
                recommendations=result.get("recommendations", []),
                experience_match=result.get("experienceMatch"),
                title_match=result.get("titleMatch"),
                job_description=job_description,
            )
        )
    return result


def tailor_resume_for_job(job_id: int, job_description: Optional[str] = None) -> dict:
    analysis = analyze_job(job_id=job_id, job_description=job_description)
    workspace = get_job_automation_workspace()
    selected = next((job for job in workspace["results"] if job["id"] == job_id), None)
    profile = workspace["profile"]
    boosted_score = min(98, analysis["score"] + 8 + len(analysis["hits"]))
    tailored_content = (
        f"{profile.get('name', 'Candidate')}\n"
        f"{profile.get('email', '')} | {profile.get('phone', '')} | {profile.get('location', '')}\n\n"
        f"PROFESSIONAL SUMMARY\n"
        f"Tailored for {selected['role'] if selected else 'target role'} — emphasizing {', '.join(analysis['hits'][:5])}.\n\n"
        f"KEY SKILLS\n{', '.join(analysis['hits'])}\n\n"
        f"TARGET ALIGNMENT\n{analysis['summary']}\n\n"
        f"RECOMMENDATIONS APPLIED\n- " + "\n- ".join(analysis["suggestions"][:4])
    )
    return {
        "success": True,
        "jobId": job_id,
        "tailoredScore": boosted_score,
        "content": tailored_content,
        "message": "Resume tailored for the selected job.",
    }


def save_tailored_resume(job_id: int, content: str) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        row = (
            session.query(TailoredResume)
            .filter(TailoredResume.user_id == user.id, TailoredResume.job_result_id == job_id)
            .first()
        )
        if row:
            row.content = content
        else:
            session.add(TailoredResume(user_id=user.id, job_result_id=job_id, content=content))
        return {"success": True, "message": "Tailored resume saved.", "jobId": job_id}


def get_tailored_resume(job_id: int) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        row = (
            session.query(TailoredResume)
            .filter(TailoredResume.user_id == user.id, TailoredResume.job_result_id == job_id)
            .first()
        )
        if not row:
            return {"jobId": job_id, "content": "", "found": False}
        return {"jobId": job_id, "content": row.content, "found": True}


def run_auto_apply(match_threshold: Optional[int] = None) -> dict:
    ranked: List[dict] = []
    matching_pipeline: dict = {}
    eligible_ids: List[int] = []
    scrape_meta = {"scraped": 0, "portalCount": 0}
    portals: List[dict] = []
    threshold = match_threshold if match_threshold is not None else 70

    with session_scope() as session:
        user = _workspace_user(session)
        automation = _get_or_create_automation(session, user)
        search = _get_or_create_search(session, user)
        threshold = match_threshold if match_threshold is not None else automation.match_threshold
        portals = [
            {"name": row.name, "url": row.url}
            for row in session.query(Portal).filter(Portal.user_id == user.id).all()
        ]

        if not portals:
            return {
                "success": False,
                "message": "No portals configured. Add portals before running auto apply.",
                "results": [],
                "applied": 0,
                "jobIds": [],
                "scrapedCount": 0,
                "portalsScraped": 0,
                "matchingPipeline": {
                    "steps": ["scrape_portals"],
                    "llmUsed": False,
                    "matchSource": "none",
                    "message": "Configure portals to start the Sales Automation job-board flow.",
                },
            }

        scrape_meta = _scrape_configured_portals(session, user)
        titles = search.titles or []
        required_skills = [skill.lower() for skill in (search.required_skills or [])]
        optional_skills = [skill.lower() for skill in (search.optional_skills or [])]
        employment_type = search.employment_type or "Both"
        exclude_keywords = [keyword.lower() for keyword in (search.exclude_keywords or [])]
        posted_within = int(search.posted_within or 30)
        experience_level = search.experience_level or "Any"
        rate_min = seed_logic._parse_rate_value(search.rate_min or "")
        rate_max = seed_logic._parse_rate_value(search.rate_max or "")
        jobs = [_job_result_dict(row) for row in session.query(JobResult).filter(JobResult.user_id == user.id).all()]
        prefiltered = _filter_job_results(
            jobs,
            titles=titles,
            required_skills=required_skills,
            optional_skills=optional_skills,
            employment_type=employment_type,
            exclude_keywords=exclude_keywords,
            posted_within=posted_within,
            experience_level=experience_level,
            rate_min=rate_min,
            rate_max=rate_max,
            portals=portals,
        )
        if not prefiltered and jobs:
            prefiltered = jobs[:50]
        all_ranked, matching_pipeline = _rank_jobs_with_cv(session, user, prefiltered)
        ranked = [job for job in all_ranked if job.get("match", 0) >= threshold]
        if not ranked and all_ranked:
            ranked = all_ranked[: min(10, len(all_ranked))]
            matching_pipeline = {
                **matching_pipeline,
                "message": (
                    f"{matching_pipeline.get('message', '')} "
                    f"No jobs met {threshold}% threshold; showing top embedding-ranked matches."
                ).strip(),
            }
        eligible_ids = [job["id"] for job in ranked[: automation.max_applications]]

    if eligible_ids:
        apply_result = apply_jobs(eligible_ids)
        apply_message = apply_result.get("message", f"Applied to {len(eligible_ids)} job(s).")
    else:
        apply_message = f"No jobs met the {threshold}% threshold."

    portal_names = ", ".join({portal["name"] for portal in portals})
    return {
        "success": True,
        "message": (
            f"Scraped {scrape_meta['scraped']} posting(s) across {scrape_meta['portalCount']} portal(s) "
            f"({portal_names}). Found {len(ranked)} matches. {matching_pipeline.get('message', '')} {apply_message}"
        ),
        "results": ranked,
        "applied": len(eligible_ids),
        "jobIds": eligible_ids,
        "scrapedCount": scrape_meta["scraped"],
        "portalsScraped": scrape_meta["portalCount"],
        "matchingPipeline": matching_pipeline,
    }


def search_linkedin_jobs(payload: dict) -> dict:
    workspace = get_job_automation_workspace()
    jobs = workspace.get("linkedin", [])
    query = (payload.get("query") or "").lower()
    company = (payload.get("company") or "").lower()
    if query:
        jobs = [job for job in jobs if query in job["role"].lower() or query in job.get("company", "").lower()]
    if company:
        jobs = [job for job in jobs if company in job.get("company", "").lower()]
    return {"success": True, "jobs": jobs, "count": len(jobs)}


def apply_linkedin_job(role: str, company: str, easy_apply: bool) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        session.add(
            JobApplication(
                user_id=user.id,
                role=role,
                company=company,
                status="Applied",
                stage="LinkedIn Easy Apply" if easy_apply else "LinkedIn application",
                updated_label=date.today().isoformat(),
                action_label="Await recruiter response",
                portal="LinkedIn",
                application_date=date.today(),
                match=None,
                posting_url="",
            )
        )
    return {
        "success": True,
        "message": f"Applied to {role} at {company} via LinkedIn.",
    }


def get_day_report_dashboard() -> dict:
    from app.services.reporting_helpers import day_report_bounds_and_defaults

    with session_scope() as session:
        rows = session.query(DayReportRow).order_by(DayReportRow.report_date).all()
        payload_rows = [
            {
                "date": row.report_date.isoformat(),
                "recruiter": row.recruiter,
                "technology": row.technology,
                "linkedin": row.linkedin,
                "calls": row.calls,
                "sourced": row.sourced,
                "marketing": row.marketing,
                "notes": row.notes,
            }
            for row in rows
        ]
        totals = {
            "linkedin": sum(row["linkedin"] for row in payload_rows),
            "calls": sum(row["calls"] for row in payload_rows),
            "sourced": sum(row["sourced"] for row in payload_rows),
            "marketing": sum(row["marketing"] for row in payload_rows),
        }
        meta = day_report_bounds_and_defaults([row["date"] for row in payload_rows])
        return {
            "range": {"start": payload_rows[0]["date"], "end": payload_rows[-1]["date"]} if payload_rows else {},
            **meta,
            "recruiters": sorted({row["recruiter"] for row in payload_rows}),
            "totals": totals,
            "rows": payload_rows,
        }


def filter_day_report(start: Optional[str] = None, end: Optional[str] = None, recruiter: Optional[str] = None) -> dict:
    dashboard = get_day_report_dashboard()
    rows = dashboard["rows"]
    if start:
        rows = [row for row in rows if row["date"] >= start]
    if end:
        rows = [row for row in rows if row["date"] <= end]
    if recruiter:
        rows = [row for row in rows if row["recruiter"] == recruiter]
    totals = {
        "linkedin": sum(row["linkedin"] for row in rows),
        "calls": sum(row["calls"] for row in rows),
        "sourced": sum(row["sourced"] for row in rows),
        "marketing": sum(row["marketing"] for row in rows),
    }
    return {
        "range": {
            "start": rows[0]["date"] if rows else start,
            "end": rows[-1]["date"] if rows else end,
        },
        "recruiters": dashboard["recruiters"],
        "totals": totals,
        "rows": rows,
    }


def get_submission_dashboard() -> dict:
    from app.services.reporting_helpers import submission_summary

    with session_scope() as session:
        months_rows = session.query(SubmissionMonth).order_by(SubmissionMonth.month).all()
        months = [{"month": row.month, "submissions": row.submissions} for row in months_rows]
    lookup = {row["month"]: row["submissions"] for row in months}
    enriched = []
    for idx, row in enumerate(months):
        year, month = row["month"].split("-")
        previous_month = months[idx - 1]["submissions"] if idx > 0 else None
        prior_year_key = f"{int(year) - 1}-{month}"
        yoy_base = lookup.get(prior_year_key)
        mom = None if previous_month in (None, 0) else round((row["submissions"] - previous_month) / previous_month * 100, 1)
        yoy = None if yoy_base in (None, 0) else round((row["submissions"] - yoy_base) / yoy_base * 100, 1)
        enriched.append({**row, "mom": mom, "yoy": yoy})
    return {
        "range": {"start": months[0]["month"], "end": months[-1]["month"]} if months else {},
        "summary": submission_summary(enriched),
        "months": enriched,
    }


def filter_submissions(start_month: Optional[str] = None, end_month: Optional[str] = None) -> dict:
    from app.services.reporting_helpers import submission_summary

    dashboard = get_submission_dashboard()
    months = dashboard["months"]
    if start_month:
        months = [row for row in months if row["month"] >= start_month]
    if end_month:
        months = [row for row in months if row["month"] <= end_month]
    return {
        "range": {
            "start": months[0]["month"] if months else start_month,
            "end": months[-1]["month"] if months else end_month,
        },
        "summary": submission_summary(months),
        "months": months,
    }


def preview_campaign(subject: str, body: str, recipients: List[str]) -> dict:
    from app.services.campaign_email import build_preview

    with session_scope() as session:
        user = _workspace_user(session)
        settings = _load_campaign_settings(session, user.id)
        contacts = _load_campaign_contacts(session, user.id)
        composer = {
            "fromName": "Sarah Mitchell",
            "fromEmail": "sarah@marketingmind.ai",
            "replyTo": "recruiter@marketingmind.ai",
        }
        return build_preview(subject, body, recipients, contacts=contacts, composer=composer, settings=settings)


def preview_template(subject: str, body: str, composer: Optional[dict] = None) -> dict:
    from app.services.campaign_email import build_preview

    with session_scope() as session:
        user = _workspace_user(session)
        settings = _load_campaign_settings(session, user.id)
        contacts = _load_campaign_contacts(session, user.id)
        merged_composer = {
            "fromName": (composer or {}).get("fromName") or "Sarah Mitchell",
            "fromEmail": (composer or {}).get("fromEmail") or "sarah@marketingmind.ai",
            "replyTo": (composer or {}).get("replyTo") or "recruiter@marketingmind.ai",
        }
        recipients = [contacts[0]["email"]] if contacts else []
        return build_preview(subject, body, recipients, contacts=contacts, composer=merged_composer, settings=settings)


def send_test_campaign(email: str, subject: str, body: str, composer: Optional[dict] = None) -> dict:
    from app.services.campaign_email import send_test_email

    with session_scope() as session:
        user = _workspace_user(session)
        settings = _load_campaign_settings(session, user.id)
        merged_composer = {
            "fromName": (composer or {}).get("fromName") or "Sarah Mitchell",
            "fromEmail": (composer or {}).get("fromEmail") or "sarah@marketingmind.ai",
            "replyTo": (composer or {}).get("replyTo") or "recruiter@marketingmind.ai",
        }
        return send_test_email(email, subject, body, settings=settings, composer=merged_composer)


def launch_campaign(payload: dict) -> dict:
    from app.services.campaign_email import CampaignEmailError, launch_campaign_batch

    with session_scope() as session:
        user = _workspace_user(session)
        settings = _load_campaign_settings(session, user.id)
        settings["emailDelaySeconds"] = payload.get("emailDelaySeconds", settings.get("emailDelaySeconds", 3))
        if payload.get("openTracking") is not None:
            settings["openTracking"] = payload["openTracking"]
        contacts = _load_campaign_contacts(session, user.id)

        try:
            result = launch_campaign_batch(payload, settings=settings, contacts=contacts)
        except CampaignEmailError as exc:
            return {"success": False, "message": str(exc), "mode": "demo", "campaign": None, "sentCount": 0, "failedCount": 0}

        campaign = result.get("campaign") or {}
        row = CampaignItem(
            user_id=user.id,
            name=campaign.get("name") or payload.get("campaignName") or "New Campaign",
            from_name=payload.get("fromName"),
            from_email=payload.get("fromEmail"),
            reply_to=payload.get("replyTo"),
            subject=campaign.get("subject") or payload.get("subject", ""),
            body=campaign.get("body") or payload.get("body", ""),
            status=campaign.get("status") or ("Sent" if payload.get("sendNow") else "Scheduled"),
            scheduled_for=campaign.get("scheduledFor") or payload.get("scheduledFor"),
            sent_count=campaign.get("sent", 0),
            opened_count=campaign.get("opened", 0),
            replied_count=campaign.get("replied", 0),
        )
        session.add(row)
        session.flush()

        campaign["id"] = str(row.id)
        return {
            "success": result["success"],
            "message": result["message"],
            "mode": result.get("mode", "demo"),
            "campaign": {
                "name": row.name,
                "sent": row.sent_count,
                "opened": row.opened_count,
                "replied": row.replied_count,
                "status": row.status,
                "scheduledFor": row.scheduled_for,
                "subject": row.subject,
                "body": row.body,
            },
            "sentCount": row.sent_count,
            "failedCount": len(campaign.get("failures") or []),
        }


def save_campaign_draft(payload: dict) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        existing = (
            session.query(CampaignItem)
            .filter(CampaignItem.user_id == user.id, CampaignItem.name == payload["campaignName"], CampaignItem.status == "Draft")
            .first()
        )
        if existing:
            existing.subject = payload.get("subject", "")
            existing.body = payload.get("body", "")
            existing.from_name = payload.get("fromName")
            existing.from_email = payload.get("fromEmail")
            existing.reply_to = payload.get("replyTo")
            row = existing
        else:
            row = CampaignItem(
                user_id=user.id,
                name=payload["campaignName"],
                from_name=payload.get("fromName"),
                from_email=payload.get("fromEmail"),
                reply_to=payload.get("replyTo"),
                subject=payload.get("subject", ""),
                body=payload.get("body", ""),
                status="Draft",
                scheduled_for="—",
            )
            session.add(row)
            session.flush()

        draft = {
            "name": row.name,
            "sent": 0,
            "opened": 0,
            "replied": 0,
            "status": "Draft",
            "scheduledFor": "—",
            "subject": row.subject,
            "body": row.body,
        }
        return {"success": True, "message": f"Draft '{row.name}' saved.", "campaign": draft}


def import_campaign_contacts(payload: dict) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        list_name = payload.get("listName") or "Imported"
        incoming = payload.get("contacts") or []
        existing = session.query(CampaignContact).filter(CampaignContact.user_id == user.id).all()
        seen = {row.email.lower() for row in existing}
        imported_rows = []
        skipped = 0

        for row in incoming:
            email = str(row.get("email", "")).strip().lower()
            if not email or email in seen:
                skipped += 1
                continue
            seen.add(email)
            contact = CampaignContact(
                user_id=user.id,
                name=row.get("name") or email.split("@")[0],
                email=row.get("email"),
                company=row.get("company") or email.split("@")[1],
                status=row.get("status") or "Queued",
                list_name=row.get("list") or list_name,
            )
            session.add(contact)
            imported_rows.append(
                {
                    "name": contact.name,
                    "email": contact.email,
                    "company": contact.company,
                    "status": contact.status,
                    "list": contact.list_name,
                }
            )

        list_row = session.query(ContactList).filter(ContactList.user_id == user.id, ContactList.name == list_name).first()
        if list_row:
            list_row.contacts_count += len(imported_rows)
        elif imported_rows:
            session.add(ContactList(user_id=user.id, name=list_name, contacts_count=len(imported_rows), open_rate=0, reply_rate=0))

        return {"imported": len(imported_rows), "skipped": skipped, "contacts": imported_rows}


def test_campaign_smtp(settings: Optional[dict] = None) -> dict:
    from app.services.campaign_email import test_smtp_connection

    with session_scope() as session:
        user = _workspace_user(session)
        merged = _load_campaign_settings(session, user.id)
        if settings:
            merged.update({key: value for key, value in settings.items() if value is not None})
        return test_smtp_connection(merged)


def save_campaign_settings(payload: dict) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        settings = session.query(CampaignSettings).filter(CampaignSettings.user_id == user.id).first()
        if not settings:
            settings = CampaignSettings(user_id=user.id)
            session.add(settings)
            session.flush()
        field_map = {
            "smtpHost": "smtp_host",
            "smtpPort": "smtp_port",
            "smtpUsername": "smtp_username",
            "smtpPassword": "smtp_password",
            "senderLimit": "sender_limit",
            "emailDelaySeconds": "email_delay_seconds",
            "smartWarmup": "smart_warmup",
            "unsubscribeFooter": "unsubscribe_footer",
            "spamGuard": "spam_guard",
            "gmailSync": "gmail_sync",
            "outlookSync": "outlook_sync",
            "openTracking": "open_tracking",
            "aiSubjectAssist": "ai_subject_assist",
        }
        option_keys = {
            "honorUnsubscribes",
            "bounceManagement",
            "sendgridSync",
            "aiProvider",
            "aiDefaultTone",
            "aiPersonalization",
        }
        options = dict(settings.options_json or {})
        for key, attr in field_map.items():
            if key in payload and payload[key] is not None:
                setattr(settings, attr, payload[key])
        for key in option_keys:
            if key in payload and payload[key] is not None:
                options[key] = payload[key]
        settings.options_json = options
    return {"success": True, "message": "Campaign settings saved."}


def create_contact_list(name: str) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        row = ContactList(user_id=user.id, name=name, contacts_count=0, open_rate=0, reply_rate=0)
        session.add(row)
        session.flush()
        return {"name": name, "contacts": 0, "openRate": 0, "replyRate": 0}


def get_linkedin_workspace() -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        recruiters = session.query(LinkedInRecruiter).filter(LinkedInRecruiter.user_id == user.id).all()
        recruiter_dicts = [
            {
                "id": row.external_id or row.id,
                "name": row.name,
                "title": row.title,
                "company": row.company,
                "location": row.location,
                "techs": row.techs or [],
                "conn": row.connection_degree,
                "avatar": row.avatar,
                "match": row.match_score,
                "source": row.source,
                "email": row.email,
                "note": row.note,
                "status": row.status,
            }
            for row in recruiters
        ]
        sequences = []
        for seq in session.query(LinkedInSequence).filter(LinkedInSequence.user_id == user.id).all():
            sequences.append(
                {
                    "id": seq.external_id or seq.id,
                    "name": seq.name,
                    "steps": [
                        {
                            "label": step.label,
                            "status": step.status,
                            "date": step.step_date,
                        }
                        for step in sorted(seq.steps, key=lambda item: item.step_order)
                    ],
                }
            )
        followups = [
            {
                "name": row.name,
                "company": row.company,
                "due": row.due,
                "type": row.followup_type,
            }
            for row in session.query(LinkedInFollowup).filter(LinkedInFollowup.user_id == user.id).all()
        ]
        templates = [
            {"name": row.name, "body": row.body}
            for row in session.query(LinkedInMessageTemplate).filter(LinkedInMessageTemplate.user_id == user.id).all()
        ]
        api_sources = [
            {
                "id": row.external_id,
                "name": row.name,
                "shortCode": row.short_code,
                "description": row.description,
                "status": row.status,
                "color": row.color,
            }
            for row in session.query(LinkedInApiSource).all()
        ]
        settings = session.query(LinkedInSettings).filter(LinkedInSettings.user_id == user.id).first()
        contacted = sum(1 for row in recruiter_dicts if row["status"] in ("contacted", "replied"))
        replied = sum(1 for row in recruiter_dicts if row["status"] == "replied")
        companies = sorted({row["company"] for row in recruiter_dicts})
        all_techs = set()
        for row in recruiter_dicts:
            all_techs.update(row.get("techs", []))
        return {
            "stats": {
                "recruitersFound": len(recruiter_dicts),
                "contacted": contacted,
                "replied": replied,
                "followupsDue": len(followups),
            },
            "recruiters": recruiter_dicts,
            "sequences": sequences,
            "followups": followups,
            "templates": templates,
            "apiSources": api_sources,
            "companies": companies,
            "technologies": sorted(all_techs),
            "apiConnected": any(source["status"] == "connected" for source in api_sources),
            "pasteProfilesEnabled": True,
            "outreachEnabled": True,
            "apiUsage": deepcopy(seed_logic._LINKEDIN_API_USAGE),
            "settings": {
                "autoRunDaily": settings.auto_run_daily if settings else True,
                "autoEnrich": settings.auto_enrich if settings else True,
                "skipContacted": settings.skip_contacted if settings else True,
                "autoFollowup": settings.auto_followup if settings else True,
                "aiPersonalize": settings.ai_personalize if settings else True,
                "maxPerDay": settings.max_per_day if settings else 25,
                "delaySeconds": settings.delay_seconds if settings else 45,
                "accountEmail": settings.account_email if settings else "",
                "dailyConnections": settings.daily_connections if settings else 20,
                "dailyInmails": settings.daily_inmails if settings else 10,
                "isPremium": settings.is_premium if settings else False,
                "respectDnc": settings.respect_dnc if settings else True,
                "honorUnsubscribes": settings.honor_unsubscribes if settings else True,
                "usePermittedSources": settings.use_permitted_sources if settings else True,
            },
        }


def run_linkedin_discovery(companies: list, technologies: list, seniority: str, location: str, connections: str, results_per_company: int) -> dict:
    workspace = get_linkedin_workspace()
    recruiters = workspace["recruiters"]
    filtered = [
        r
        for r in recruiters
        if (not companies or r["company"] in companies)
        and (not technologies or any(t in r["techs"] for t in technologies))
    ]
    if not filtered:
        filtered = recruiters
    return {
        "recruiters": deepcopy(filtered),
        "totalFound": len(filtered),
        "count": len(filtered),
        "message": f"Found {len(filtered)} recruiters matching your criteria across {len({r['company'] for r in filtered})} companies.",
    }


def enrich_linkedin_profiles(urls: list, tech_context: str) -> dict:
    return seed_logic.enrich_linkedin_profiles(urls, tech_context)


def send_linkedin_outreach(recruiter_ids: list, subject: str, body: str, channel: str, schedule_at: Optional[str]) -> dict:
    workspace = get_linkedin_workspace()
    names = [r["name"] for r in workspace["recruiters"] if r["id"] in recruiter_ids]
    return {
        "success": True,
        "count": len(recruiter_ids),
        "message": f"Outreach queued for {len(recruiter_ids)} recruiter(s) via {channel}: {', '.join(names[:3])}{'...' if len(names) > 3 else ''}.",
    }


def generate_linkedin_message(prompt: str, message_type: str, tone: str, channel: str) -> dict:
    return seed_logic.generate_linkedin_message(prompt, message_type, tone, channel)


def save_linkedin_settings(settings: dict) -> dict:
    with session_scope() as session:
        user = _workspace_user(session)
        row = session.query(LinkedInSettings).filter(LinkedInSettings.user_id == user.id).first()
        if not row:
            row = LinkedInSettings(user_id=user.id)
            session.add(row)
            session.flush()
        field_map = {
            "autoRunDaily": "auto_run_daily",
            "autoEnrich": "auto_enrich",
            "skipContacted": "skip_contacted",
            "autoFollowup": "auto_followup",
            "aiPersonalize": "ai_personalize",
            "maxPerDay": "max_per_day",
            "delaySeconds": "delay_seconds",
            "accountEmail": "account_email",
            "dailyConnections": "daily_connections",
            "dailyInmails": "daily_inmails",
            "isPremium": "is_premium",
            "respectDnc": "respect_dnc",
            "honorUnsubscribes": "honor_unsubscribes",
            "usePermittedSources": "use_permitted_sources",
        }
        for key, attr in field_map.items():
            if key in settings and settings[key] is not None:
                setattr(row, attr, settings[key])
    return {"success": True, "message": "LinkedIn settings saved successfully."}


def save_linkedin_api_keys(keys: dict) -> dict:
    connected: List[str] = []
    with session_scope() as session:
        user = _workspace_user(session)
        for provider, value in keys.items():
            if value is None:
                continue
            trimmed = str(value).strip()
            if not trimmed:
                continue
            existing = (
                session.query(LinkedInApiKey)
                .filter(LinkedInApiKey.user_id == user.id, LinkedInApiKey.provider == provider)
                .first()
            )
            if existing:
                existing.api_key = trimmed
            else:
                session.add(LinkedInApiKey(user_id=user.id, provider=provider, api_key=trimmed))
            source = session.query(LinkedInApiSource).filter(LinkedInApiSource.external_id == provider).first()
            if source:
                source.status = "connected"
            connected.append(provider)
    labels = ", ".join(connected) if connected else "none"
    return {"success": True, "message": f"API keys saved for: {labels}."}


def get_endpoint_catalog() -> dict:
    return seed_logic.get_endpoint_catalog()


def get_test_data_payload() -> dict:
    raise RuntimeError("Test data dump is only available in JSON seed mode (USE_SEED_DATA=true).")


def append_test_data_payload(dataset: str, entries: List[Dict[str, Any]]) -> dict:
    raise RuntimeError("Test data append is only available in JSON seed mode (USE_SEED_DATA=true).")


def reset_test_data_payload() -> dict:
    from app.db.database import get_engine
    from app.db.models import Base
    from scripts.init_postgres_schema import main as seed_main

    engine = get_engine()
    if engine is None:
        raise RuntimeError("DATABASE_URL is not configured.")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_main()
    return {"success": True, "message": "PostgreSQL database reset and re-seeded from baseline."}
