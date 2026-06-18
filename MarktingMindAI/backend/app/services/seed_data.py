from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union

from app.services.test_data_store import (
    LIST_DATASETS,
    append_test_data as append_rows_to_dataset,
    get_test_data,
    get_test_data_snapshot,
    reset_test_data,
    save_test_data,
)


def _data() -> Dict[str, Any]:
    return get_test_data()


def _campaign_metrics() -> Dict[str, Union[int, float]]:
    items = _data()["campaign_items"]
    total_sent = sum(item["sent"] for item in items)
    total_opened = sum(item["opened"] for item in items)
    total_replied = sum(item["replied"] for item in items)
    open_rate = 0 if total_sent == 0 else round(total_opened / total_sent * 100)
    reply_rate = 0 if total_sent == 0 else round(total_replied / total_sent * 100)
    return {
        "emailsSent": total_sent,
        "openRate": open_rate,
        "replyRate": reply_rate,
        "bounceRate": 2,
    }


def get_overview_payload() -> dict:
    payload = _data()
    campaign_metrics = _campaign_metrics()
    submission_months = payload["submission_months"]
    job_results = payload["job_results"]
    return {
        "headline": "MarketingMind AI operating system for staffing campaigns, recruiter dashboards, and job automation.",
        "modules": [
            {
                "slug": "campaigns",
                "label": "Campaign Studio",
                "description": "Mass email drafting, templates, contact lists, scheduling, and compliance.",
                "metric": f"{campaign_metrics['emailsSent']:,} sends",
            },
            {
                "slug": "job-automation",
                "label": "Job Automation",
                "description": "Profile setup, search automation, portal management, CV analysis, LinkedIn, and tracker.",
                "metric": f"{len(job_results)} high-match roles",
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
                "metric": f"{submission_months[-1]['submissions']} this month",
            },
        ],
        "activity": [
            {"title": "Campaign queue ready", "detail": "Data/AI Bench Update is scheduled for 08:45 with smart throttling enabled."},
            {"title": "Recruiter output rising", "detail": "Komal leads sourced volume this week with 18 qualified profiles."},
            {"title": "Action required", "detail": "One AI/ML application needs a tailored resume before submission."},
        ],
    }


def get_campaign_workspace() -> dict:
    payload = _data()
    return {
        "metrics": _campaign_metrics(),
        "composer": {
            "campaignName": "May Talent Pulse - Southwest",
            "fromName": "Sarah Mitchell",
            "fromEmail": "sarah@marketingmind.ai",
            "replyTo": "recruiter@marketingmind.ai",
            "subject": "Available consultants | {{candidate_name}} | {{location}} | C2C",
            "body": payload["campaign_templates"][0]["body"],
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
        "contacts": payload["campaign_contacts"],
        "lists": payload["campaign_lists"],
        "campaigns": payload["campaign_items"],
        "templates": payload["campaign_templates"],
        "settings": deepcopy(payload["campaign_settings"]),
    }


def get_job_automation_workspace() -> dict:
    payload = _data()
    applications = payload["applications"]
    job_results = payload["job_results"]
    interviews = [item for item in applications if item["status"] == "Interview"]
    action_needed = [item for item in applications if item["status"] == "Action Needed"]
    return {
        "stats": {
            "appliedToday": 6,
            "newMatches": len(job_results),
            "interviews": len(interviews),
            "avgMatchScore": round(sum(job["match"] for job in job_results) / len(job_results)),
        },
        "profile": deepcopy(payload["job_profile"]),
        "automation": deepcopy(payload["job_automation"]),
        "search": deepcopy(payload["search_config"]),
        "portals": deepcopy(payload["portal_items"]),
        "carriers": deepcopy(payload["carrier_items"]),
        "results": job_results,
        "savedJobs": deepcopy(payload.get("saved_jobs", [])),
        "analysis": {
            "selectedJobId": 1,
            "score": 87,
            "summary": "Strong fit for backend and cloud-heavy roles with room to sharpen leadership positioning.",
            "hits": ["Java", "Spring Boot", "AWS", "REST APIs", "Microservices"],
            "misses": ["Kubernetes", "GraphQL"],
            "suggestions": [
                "Move recent Spring Boot architecture work into the top summary section.",
                "Add measurable AWS migration outcomes to the first project entry.",
                "Highlight mentoring and ownership for senior-level screening.",
            ],
        },
        "linkedin": payload["linkedin_jobs"],
        "applications": {
            "all": applications,
            "interviews": interviews,
            "actionNeeded": action_needed,
            "stats": {
                "applied": len(applications),
                "interviews": len(interviews),
                "actionNeeded": len(action_needed),
                "conversion": 50,
            },
        },
    }


def get_day_report_dashboard() -> dict:
    rows = _data()["day_report_rows"]
    totals = {
        "linkedin": sum(row["linkedin"] for row in rows),
        "calls": sum(row["calls"] for row in rows),
        "sourced": sum(row["sourced"] for row in rows),
        "marketing": sum(row["marketing"] for row in rows),
    }
    return {
        "range": {"start": rows[0]["date"], "end": rows[-1]["date"]},
        "recruiters": sorted({row["recruiter"] for row in rows}),
        "totals": totals,
        "rows": rows,
    }


def get_submission_dashboard() -> dict:
    months = _data()["submission_months"]
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
        "range": {"start": months[0]["month"], "end": months[-1]["month"]},
        "months": enriched,
    }


def preview_campaign(subject: str, body: str, recipients: List[str]) -> dict:
    return {
        "subject": subject,
        "body": body,
        "recipientCount": len(recipients),
        "previewHtml": f"<h3>{subject}</h3><div>{body}</div>",
    }


def send_test_campaign(email: str, subject: str, body: str) -> dict:
    return {
        "success": True,
        "message": f"Test email queued to {email} with subject '{subject}'.",
    }


def launch_campaign(payload: dict) -> dict:
    data = _data()
    recipients = payload.get("recipients", [])
    now_label = payload.get("scheduledFor") or datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    campaign = {
        "name": payload["campaignName"],
        "sent": len(recipients),
        "opened": max(0, round(len(recipients) * 0.38)),
        "replied": max(0, round(len(recipients) * 0.12)),
        "status": "Sent" if payload.get("sendNow") else "Scheduled",
        "scheduledFor": now_label,
    }
    data["campaign_items"].insert(0, campaign)
    save_test_data()
    return {
        "success": True,
        "message": f"Campaign '{payload['campaignName']}' {'sent' if payload.get('sendNow') else 'scheduled'} for {len(recipients)} recipients.",
    }


def save_campaign_settings(payload: dict) -> dict:
    data = _data()
    data["campaign_settings"].update(payload)
    save_test_data()
    return {
        "success": True,
        "message": "Campaign settings updated in test data.",
    }


def create_contact_list(name: str) -> dict:
    data = _data()
    new_list = {
        "name": name,
        "contacts": 0,
        "openRate": 0,
        "replyRate": 0,
    }
    data["campaign_lists"].insert(0, new_list)
    save_test_data()
    return new_list


def save_job_profile(payload: dict) -> dict:
    data = _data()
    data["job_profile"].update(payload)
    save_test_data()
    return {
        "success": True,
        "message": "Job profile updated in test data.",
    }


def run_job_search(payload: dict) -> dict:
    data = _data()
    data["search_config"].update({key: value for key, value in payload.items() if value is not None})
    titles = payload.get("titles") or []
    filtered = []
    for job in data["job_results"]:
        if not titles or any(title.lower() in job["role"].lower() for title in titles):
            filtered.append(job)
    return {
        "success": True,
        "message": f"Search completed with {len(filtered)} matching jobs.",
        "results": filtered,
    }


def save_job(job_id: int) -> dict:
    data = _data()
    saved = data.setdefault("saved_jobs", [])
    if job_id in saved:
        saved.remove(job_id)
        save_test_data()
        return {"success": True, "message": "Job removed from saved list.", "saved": False}
    saved.append(job_id)
    save_test_data()
    return {"success": True, "message": "Job saved to favorites.", "saved": True}


def add_portal(name: str, url: str) -> dict:
    data = _data()
    portal = {"name": name, "url": url, "status": "Active"}
    data["portal_items"].append(portal)
    save_test_data()
    return portal


def add_carrier(name: str, url: str) -> dict:
    data = _data()
    carrier = {"name": name, "url": url}
    data["carrier_items"].append(carrier)
    save_test_data()
    return carrier


def apply_jobs(job_ids: List[int]) -> dict:
    data = _data()
    selected_jobs = [job for job in data["job_results"] if job["id"] in job_ids]
    for job in selected_jobs:
        data["applications"].insert(
            0,
            {
                "role": job["role"],
                "company": job["company"],
                "status": "Applied",
                "stage": "Application submitted from test endpoint",
                "updated": date.today().isoformat(),
                "action": "Await recruiter response",
            },
        )
    save_test_data()
    return {
        "success": True,
        "message": f"Applied to {len(selected_jobs)} job(s) using test data.",
    }


def analyze_job(job_id: int) -> dict:
    jobs = _data()["job_results"]
    selected = next((job for job in jobs if job["id"] == job_id), jobs[0])
    cv_skills = ["Java", "Spring Boot", "Python", "React", "AWS", "Docker", "Maven", "Git", "Agile", "REST APIs", "TypeScript"]
    job_skills = selected.get("skills", [])
    hits = [s for s in job_skills if any(cv.lower() in s.lower() for cv in cv_skills)]
    misses = [s for s in job_skills if s not in hits]
    score = max(78, selected["match"] - 3)
    return {
        "selectedJobId": selected["id"],
        "score": score,
        "summary": f"Test analysis for {selected['role']} at {selected['company']}.",
        "hits": hits if hits else selected["skills"][:2],
        "misses": misses if misses else ["Leadership metrics", "Portfolio link"],
        "suggestions": [
            "Promote the most recent relevant achievement to the profile summary.",
            "Quantify delivery outcomes for the top listed project.",
            "Mirror the target role terminology in the opening paragraph.",
        ],
        "experienceMatch": f"Your experience aligns well with the requirements for {selected['role']}.",
        "titleMatch": f"'{selected['role']}' directly matches your profile headline and resume title.",
    }


def filter_day_report(start: Optional[str] = None, end: Optional[str] = None, recruiter: Optional[str] = None) -> dict:
    rows = []
    all_rows = _data()["day_report_rows"]
    for row in all_rows:
        if start and row["date"] < start:
            continue
        if end and row["date"] > end:
            continue
        if recruiter and row["recruiter"] != recruiter:
            continue
        rows.append(row)

    totals = {
        "linkedin": sum(row["linkedin"] for row in rows),
        "calls": sum(row["calls"] for row in rows),
        "sourced": sum(row["sourced"] for row in rows),
        "marketing": sum(row["marketing"] for row in rows),
    }
    return {
        "range": {
            "start": start or all_rows[0]["date"],
            "end": end or all_rows[-1]["date"],
        },
        "recruiters": sorted({row["recruiter"] for row in all_rows}),
        "totals": totals,
        "rows": rows,
    }


def filter_submissions(start_month: Optional[str] = None, end_month: Optional[str] = None) -> dict:
    dashboard = get_submission_dashboard()
    months = []
    for month in dashboard["months"]:
        if start_month and month["month"] < start_month:
            continue
        if end_month and month["month"] > end_month:
            continue
        months.append(month)
    return {
        "range": {
            "start": start_month or dashboard["range"]["start"],
            "end": end_month or dashboard["range"]["end"],
        },
        "months": months,
    }


def get_test_data_payload() -> dict:
    snapshot = get_test_data_snapshot()
    counts = {}
    for key, value in snapshot.items():
        if isinstance(value, list):
            counts[key] = len(value)
    return {
        "dataset": snapshot,
        "counts": counts,
        "appendableDatasets": sorted(LIST_DATASETS),
    }


def append_test_data_payload(dataset: str, entries: List[Dict[str, Any]]) -> dict:
    total = append_rows_to_dataset(dataset, entries)
    return {
        "success": True,
        "message": f"Appended {len(entries)} record(s) to {dataset}.",
        "dataset": dataset,
        "totalRecords": total,
    }


def reset_test_data_payload() -> dict:
    reset_test_data()
    return {
        "success": True,
        "message": "Test data reset to baseline JSON.",
    }


_LINKEDIN_RECRUITERS = [
    {"id": 1, "name": "Jessica Turner", "title": "Senior Technical Recruiter", "company": "TEKsystems", "location": "Dallas, TX", "techs": ["Java", "Spring Boot", "AWS"], "conn": "2nd", "avatar": "JT", "match": 96, "source": "Apollo", "email": "j.turner@teksystems.com", "note": "Actively hiring Java developers for Fortune 500 clients", "status": "new"},
    {"id": 2, "name": "Michael Patel", "title": "IT Recruiter — Java & Cloud", "company": "TEKsystems", "location": "Austin, TX", "techs": ["Java", "Microservices", "Kubernetes"], "conn": "1st", "avatar": "MP", "match": 93, "source": "Apollo", "email": "m.patel@teksystems.com", "note": "Specializes in contract C2C placements", "status": "contacted"},
    {"id": 3, "name": "Anita Sharma", "title": "Technical Talent Acquisition", "company": "Infosys BPM", "location": "Remote", "techs": ["Java", "Spring Boot", "DevOps"], "conn": "2nd", "avatar": "AS", "match": 91, "source": "Hunter", "email": "anita.s@infosys.com", "note": "Focuses on backend Java and cloud roles", "status": "new"},
    {"id": 4, "name": "David Rodriguez", "title": "Sr. Recruiter — Software Engineering", "company": "Cognizant", "location": "New York, NY", "techs": ["Java", "React", "AWS"], "conn": "3rd", "avatar": "DR", "match": 88, "source": "Apollo", "email": "d.rodriguez@cognizant.com", "note": "Handles full-stack and Java bench hiring", "status": "new"},
    {"id": 5, "name": "Lisa Chen", "title": "Technology Recruiter", "company": "Capgemini", "location": "Chicago, IL", "techs": ["Java", "Spring", "Hibernate"], "conn": "2nd", "avatar": "LC", "match": 86, "source": "Hunter", "email": "l.chen@capgemini.com", "note": "Mid-to-senior Java developer placements", "status": "replied"},
    {"id": 6, "name": "Kevin Brooks", "title": "Contract Recruiter — Java/Cloud", "company": "HCL Tech", "location": "Remote", "techs": ["Java", "AWS", "Docker"], "conn": "2nd", "avatar": "KB", "match": 84, "source": "Apollo", "email": "k.brooks@hcltech.com", "note": "C2C and W2 contract specialist", "status": "contacted"},
    {"id": 7, "name": "Priya Nair", "title": "Technical Recruiter", "company": "Wipro", "location": "Dallas, TX", "techs": ["Java", "Spring Boot", "SQL"], "conn": "1st", "avatar": "PN", "match": 82, "source": "Apollo", "email": "p.nair@wipro.com", "note": "Active in Texas tech market", "status": "new"},
    {"id": 8, "name": "Robert Kim", "title": "Recruiting Lead — Engineering", "company": "Accenture", "location": "Houston, TX", "techs": ["Java", "Microservices", "Kafka"], "conn": "3rd", "avatar": "RK", "match": 80, "source": "Hunter", "email": "r.kim@accenture.com", "note": "Enterprise Java and integration roles", "status": "new"},
]

_LINKEDIN_SEQUENCES = [
    {"id": 1, "name": "Jessica Turner — TEKsystems", "steps": [{"label": "Connection sent", "status": "sent", "date": "May 5"}, {"label": "Follow-up InMail", "status": "sent", "date": "May 8"}, {"label": "2nd follow-up", "status": "pending", "date": "May 11"}, {"label": "Final touch", "status": "scheduled", "date": "May 14"}]},
    {"id": 2, "name": "Michael Patel — TEKsystems", "steps": [{"label": "Connection sent", "status": "sent", "date": "May 6"}, {"label": "InMail — Java hotlist", "status": "replied", "date": "May 7"}]},
    {"id": 3, "name": "Anita Sharma — Infosys", "steps": [{"label": "InMail sent", "status": "sent", "date": "May 4"}, {"label": "Follow-up", "status": "pending", "date": "May 11"}]},
    {"id": 4, "name": "David Rodriguez — Cognizant", "steps": [{"label": "Connection request", "status": "sent", "date": "May 3"}, {"label": "Follow-up message", "status": "sent", "date": "May 6"}, {"label": "2nd follow-up", "status": "pending", "date": "May 11"}]},
]

_LINKEDIN_FOLLOWUPS = [
    {"name": "Anita Sharma", "company": "Infosys", "due": "Today", "type": "2nd follow-up"},
    {"name": "David Rodriguez", "company": "Cognizant", "due": "Today", "type": "3rd touch"},
    {"name": "Lisa Chen", "company": "Capgemini", "due": "Tomorrow", "type": "InMail follow-up"},
]

_LINKEDIN_TEMPLATES = [
    {"name": "Connection — Java Specialist", "body": "Hi {{recruiter_name}},\n\nI noticed your work at {{company}} and would love to connect. I am a Senior Java/Spring Boot Developer available immediately for C2C roles in {{location}}.\n\nLooking forward to connecting!\n{{candidate_name}}"},
    {"name": "InMail — C2C Hotlist", "body": "Hi {{recruiter_name}},\n\nHope you are doing well! I have a Senior Java Developer with {{tech_stack}} expertise available immediately for C2C contract roles.\n\nWould love to share a full profile if you have any matching requirements.\n\nBest,\n{{candidate_name}}"},
    {"name": "Follow-up — 3 day", "body": "Hi {{recruiter_name}},\n\nFollowing up on my previous message about our Java Developer. This consultant is still available — wanted to check in before the window closes.\n\n{{candidate_name}}"},
]

_LINKEDIN_API_SOURCES = [
    {"id": "apollo", "name": "Apollo.io", "shortCode": "AP", "description": "300M+ contacts · title + email lookup · company search", "status": "connected", "color": "#005f94"},
    {"id": "hunter", "name": "Hunter.io", "shortCode": "HN", "description": "Email finder by name + domain · domain search", "status": "connected", "color": "#92400e"},
    {"id": "rocketreach", "name": "RocketReach", "shortCode": "RR", "description": "Direct dials · LinkedIn URL enrichment", "status": "disconnected", "color": "#5b21b6"},
    {"id": "lusha", "name": "Lusha", "shortCode": "LU", "description": "B2B contact data · phone numbers · company info", "status": "disconnected", "color": "#2e7d32"},
    {"id": "linkedin", "name": "LinkedIn Official API", "shortCode": "LI", "description": "Requires LinkedIn partnership approval · most accurate", "status": "pending", "color": "#0077b5"},
]

_LINKEDIN_SETTINGS = {
    "autoRunDaily": True, "autoEnrich": True, "skipContacted": True, "autoFollowup": True,
    "aiPersonalize": True, "maxPerDay": 25, "delaySeconds": 45,
    "accountEmail": "sarah@techstaff.com", "dailyConnections": 20, "dailyInmails": 10,
    "isPremium": False, "respectDnc": True, "honorUnsubscribes": True, "usePermittedSources": True,
}


def get_linkedin_workspace() -> dict:
    contacted = sum(1 for r in _LINKEDIN_RECRUITERS if r["status"] in ("contacted", "replied"))
    replied = sum(1 for r in _LINKEDIN_RECRUITERS if r["status"] == "replied")

    # Extract unique companies and technologies from recruiters
    companies = sorted(set(r["company"] for r in _LINKEDIN_RECRUITERS))
    all_techs = set()
    for r in _LINKEDIN_RECRUITERS:
        all_techs.update(r.get("techs", []))
    technologies = sorted(list(all_techs))

    # Get connected APIs
    api_connected = any(s["status"] == "connected" for s in _LINKEDIN_API_SOURCES)

    return {
        "stats": {
            "recruitersFound": len(_LINKEDIN_RECRUITERS),
            "contacted": contacted,
            "replied": replied,
            "followupsDue": len(_LINKEDIN_FOLLOWUPS),
        },
        "recruiters": deepcopy(_LINKEDIN_RECRUITERS),
        "sequences": deepcopy(_LINKEDIN_SEQUENCES),
        "followups": deepcopy(_LINKEDIN_FOLLOWUPS),
        "templates": deepcopy(_LINKEDIN_TEMPLATES),
        "apiSources": deepcopy(_LINKEDIN_API_SOURCES),
        "companies": companies,
        "technologies": technologies,
        "apiConnected": api_connected,
        "pasteProfilesEnabled": True,
        "outreachEnabled": True,
        "apiUsage": [
            {"label": "Apollo.io lookups", "used": 1240, "limit": 5000},
            {"label": "Hunter.io searches", "used": 340, "limit": 1000},
            {"label": "Emails found", "used": 247, "limit": None},
            {"label": "Credits remaining", "used": 3760, "limit": None},
        ],
        "settings": deepcopy(_LINKEDIN_SETTINGS),
    }


def run_linkedin_discovery(companies: list, technologies: list, seniority: str, location: str, connections: str, results_per_company: int) -> dict:
    filtered = [
        r for r in _LINKEDIN_RECRUITERS
        if (not companies or r["company"] in companies)
        and (not technologies or any(t in r["techs"] for t in technologies))
    ]
    if not filtered:
        filtered = deepcopy(_LINKEDIN_RECRUITERS)
    return {
        "recruiters": deepcopy(filtered),
        "totalFound": len(filtered),
        "count": len(filtered),
        "message": f"Found {len(filtered)} recruiters matching your criteria across {len(set(r['company'] for r in filtered))} companies.",
    }


def enrich_linkedin_profiles(urls: list, tech_context: str) -> dict:
    names = ["Sarah Johnson", "Tom Mitchell", "Priya Kapoor", "Alex Wong", "Maria Silva"]
    companies = ["TEKsystems", "Infosys", "Capgemini", "Wipro", "Accenture"]
    techs_list = [["Java", "Spring Boot"], ["Java", "AWS", "Docker"], ["Java", "Microservices"], ["Spring", "SQL"], ["Java", "DevOps"]]
    profiles = []
    for i, url in enumerate(urls[:5]):
        idx = i % len(names)
        name = names[idx]
        profiles.append({
            "id": 100 + i,
            "name": name,
            "title": "Technical Recruiter",
            "company": companies[idx],
            "location": "United States",
            "techs": techs_list[idx],
            "conn": "2nd",
            "avatar": "".join(part[0] for part in name.split()),
            "match": 80 - i * 3,
            "source": "Apollo",
            "email": f"{name.lower().replace(' ', '.')}@{companies[idx].lower().replace(' ', '')}.com",
            "note": f"Enriched via API from {url[:40]}",
            "status": "new",
        })
    return {
        "profiles": profiles,
        "enriched": len(profiles),
        "message": f"{len(profiles)} profiles enriched successfully via Apollo/Hunter.",
    }


def send_linkedin_outreach(recruiter_ids: list, subject: str, body: str, channel: str, schedule_at: Optional[str]) -> dict:
    names = [r["name"] for r in _LINKEDIN_RECRUITERS if r["id"] in recruiter_ids]
    return {
        "success": True,
        "count": len(recruiter_ids),
        "message": f"Outreach queued for {len(recruiter_ids)} recruiter(s) via {channel}: {', '.join(names[:3])}{'...' if len(names) > 3 else ''}.",
    }


def generate_linkedin_message(prompt: str, message_type: str, tone: str, channel: str) -> dict:
    subjects = {
        "connect": "Let us connect — Java Developer available C2C",
        "inmail": "Senior Java Developer available — C2C — Immediate start",
        "cold_outreach": "Available Senior Java Developer | C2C | Immediate",
        "followup": "Following up — Java Developer still available",
        "hotlist": "Java Developer Hotlist — Available Now | C2C",
        "thankyou": "Thank you for connecting!",
        "resume": "Resume — Senior Java Developer | C2C | Immediate",
    }
    bodies = {
        "connect": "Hi {{recruiter_name}},\n\nI noticed your expertise in IT staffing at {{company}} and wanted to reach out. I have a Senior Java Developer with Spring Boot and AWS experience available immediately for C2C roles.\n\nWould love to connect!\n\n{{candidate_name}}",
        "inmail": "Hi {{recruiter_name}},\n\nHope this message finds you well! I am reaching out because I have a highly skilled Senior Java Developer currently available for C2C contract positions at {{company}}.\n\nKey highlights:\n• 8+ years Java, Spring Boot, Microservices\n• Cloud: AWS, Docker, Kubernetes\n• Location: {{location}} | Rate: $85-90/hr C2C\n• Availability: Immediate\n\nWould you be open to a quick conversation?\n\nBest,\n{{candidate_name}}",
        "cold_outreach": "Hi {{recruiter_name}},\n\nI hope this message finds you well. I'm reaching out because I have an excellent Senior Java Developer available for C2C contract roles.\n\nProfile Highlights:\n• 8+ years of Java development with Spring Boot, Microservices, and AWS expertise\n• Full-stack capabilities: Java backend, REST APIs, cloud architecture\n• Available immediately for long-term C2C engagements\n• Rate: $85-90/hr | {{location}}\n\nWould this be a fit for any current client needs?\n\nBest regards,\n{{candidate_name}}",
        "followup": "Hi {{recruiter_name}},\n\nJust following up on my earlier message. Our Java Developer remains available and is actively interviewing. Wanted to touch base before this window closes.\n\n{{candidate_name}}",
        "hotlist": "Hi {{recruiter_name}},\n\nI have a Senior Java Developer on our bench:\n• Skills: {{tech_stack}}\n• Experience: 8+ years\n• Location: {{location}}\n• Availability: Immediate | Rate: $85-90/hr C2C\n\nWould this profile be a fit for any open requirements?\n\n{{candidate_name}}",
        "thankyou": "Hi {{recruiter_name}},\n\nThank you so much for connecting! We appreciate your responsiveness and look forward to working together.\n\nPlease reach out anytime you have Java/{{tech_stack}} requirements.\n\nBest,\n{{candidate_name}}",
        "resume": "Hi {{recruiter_name}},\n\nAs discussed, please find attached the resume of our Senior Java Developer:\n• 8+ years Java, Spring Boot, Microservices\n• Cloud: AWS, Docker, Kubernetes\n• Available immediately · C2C · {{location}}\n\nLet me know if you need additional information.\n\nBest,\n{{candidate_name}}",
    }
    key = message_type if message_type in subjects else "cold_outreach"
    return {
        "subject": subjects[key],
        "message": bodies[key],
        "body": bodies[key],
        "messageType": key,
    }


def save_linkedin_settings(settings: dict) -> dict:
    _LINKEDIN_SETTINGS.update(settings)
    return {"success": True, "message": "LinkedIn settings saved successfully."}


def save_linkedin_api_keys(keys: dict) -> dict:
    connected = [k for k, v in keys.items() if v and v.strip()]
    return {"success": True, "message": f"API keys saved for: {', '.join(connected) if connected else 'none'}."}


def get_endpoint_catalog() -> dict:
    return {
        "items": [
            {
                "method": "GET",
                "path": "/health",
                "summary": "Service health with database and MongoDB status.",
                "requestExample": None,
                "responseExample": {
                    "status": "ok",
                    "database": {"status": "available", "message": "SQLite connection succeeded."},
                    "mongodb": {"status": "available", "message": "MongoDB connected to 'marketingmind_ai'."},
                    "modules": ["overview", "campaigns", "job-automation", "day-report", "submissions", "linkedin"],
                },
            },
            {
                "method": "POST",
                "path": "/api/auth/login",
                "summary": "Login and receive session token.",
                "requestExample": {"email": "admin@marketingmind.ai", "password": "Admin@123"},
                "responseExample": {"token": "uuid-token", "user": {"id": "u-admin-1", "name": "Admin User", "email": "admin@marketingmind.ai", "role": "admin"}},
            },
            {
                "method": "POST",
                "path": "/api/auth/register",
                "summary": "Register a new user.",
                "requestExample": {"name": "New User", "email": "new@example.com", "password": "Pass@123", "role": "user"},
                "responseExample": {"token": "uuid-token", "user": {"id": "u-xxx", "name": "New User", "email": "new@example.com", "role": "user"}},
            },
            {
                "method": "GET",
                "path": "/api/user/profile",
                "summary": "Get the authenticated user's profile.",
                "requestExample": None,
                "responseExample": {"user": {"id": "u-admin-1", "name": "Admin User", "email": "admin@marketingmind.ai", "role": "admin", "phone": "+1-555-0101", "company": "MarketingMind"}},
            },
            {
                "method": "PUT",
                "path": "/api/user/profile",
                "summary": "Update user profile fields.",
                "requestExample": {"name": "Admin User", "phone": "+1-555-0101", "company": "MarketingMind", "title": "Platform Administrator", "location": "San Francisco, CA"},
                "responseExample": {"success": True, "message": "Profile updated successfully."},
            },
            {
                "method": "GET",
                "path": "/api/overview",
                "summary": "Platform overview metrics and module list.",
                "requestExample": None,
                "responseExample": get_overview_payload(),
            },
            {
                "method": "GET",
                "path": "/api/campaigns/workspace",
                "summary": "Full campaign workspace with metrics, templates, and contacts.",
                "requestExample": None,
                "responseExample": {"metrics": {"emailsSent": 0, "openRate": 0, "replyRate": 0, "bounceRate": 2}},
            },
            {
                "method": "POST",
                "path": "/api/campaigns/preview",
                "summary": "Preview campaign subject/body before launch.",
                "requestExample": {
                    "subject": "Available consultants | {{candidate_name}}",
                    "body": "Hi {{company_name}},<br/>Sharing a strong profile.",
                    "recipients": ["buyer@example.com"],
                },
                "responseExample": preview_campaign(
                    "Available consultants | {{candidate_name}}",
                    "Hi {{company_name}},<br/>Sharing a strong profile.",
                    ["buyer@example.com"],
                ),
            },
            {
                "method": "POST",
                "path": "/api/campaigns/launch",
                "summary": "Launch or schedule a campaign.",
                "requestExample": {
                    "campaignName": "Data/AI Pulse",
                    "subject": "Senior Data Engineer available",
                    "body": "Profile summary",
                    "recipients": ["team@example.com"],
                    "scheduledFor": "2026-05-29 09:00",
                    "sendNow": False,
                },
                "responseExample": {"success": True, "message": "Campaign scheduled."},
            },
            {
                "method": "GET",
                "path": "/api/job-automation/workspace",
                "summary": "Full job automation workspace: profile, search, results, analysis.",
                "requestExample": None,
                "responseExample": {"stats": {"appliedToday": 6, "newMatches": 6, "interviews": 2, "avgMatchScore": 84}},
            },
            {
                "method": "PUT",
                "path": "/api/job-automation/profile",
                "summary": "Save candidate job profile.",
                "requestExample": deepcopy(_data()["job_profile"]),
                "responseExample": {"success": True, "message": "Job profile updated in test data."},
            },
            {
                "method": "POST",
                "path": "/api/job-automation/search/run",
                "summary": "Run filtered job search against stored jobs.",
                "requestExample": {"titles": ["Java Developer"], "requiredSkills": ["Spring Boot"], "optionalSkills": ["AWS"], "location": "Texas"},
                "responseExample": {"success": True, "message": "Search completed with 2 matching jobs.", "results": _data()["job_results"][:2]},
            },
            {
                "method": "POST",
                "path": "/api/job-automation/apply",
                "summary": "Submit applications for selected job IDs.",
                "requestExample": {"jobIds": [1, 2]},
                "responseExample": {"success": True, "message": "Applied to 2 job(s)."},
            },
            {
                "method": "POST",
                "path": "/api/job-automation/analyze",
                "summary": "Run CV match analysis against a job.",
                "requestExample": {"jobId": 1},
                "responseExample": {"selectedJobId": 1, "score": 89, "summary": "Strong fit.", "hits": ["Java", "Spring Boot"], "misses": ["Kubernetes"]},
            },
            {
                "method": "POST",
                "path": "/api/job-automation/save",
                "summary": "Toggle save/bookmark a job (requires auth).",
                "requestExample": {"jobId": 1},
                "responseExample": {"success": True, "message": "Job saved to favorites.", "saved": True},
            },
            {
                "method": "POST",
                "path": "/api/job-automation/portals",
                "summary": "Add a job portal to the automation queue.",
                "requestExample": {"name": "Dice", "url": "https://www.dice.com"},
                "responseExample": {"name": "Dice", "url": "https://www.dice.com", "status": "Active"},
            },
            {
                "method": "POST",
                "path": "/api/job-automation/carriers",
                "summary": "Add a company career page to monitor.",
                "requestExample": {"name": "TCS Careers", "url": "https://www.tcs.com/careers"},
                "responseExample": {"name": "TCS Careers", "url": "https://www.tcs.com/careers"},
            },
            {
                "method": "GET",
                "path": "/api/day-report/dashboard",
                "summary": "Day-to-day recruiter performance dashboard.",
                "requestExample": None,
                "responseExample": {"range": {"start": "2026-05-12", "end": "2026-05-21"}, "recruiters": ["Komal", "Sam"], "totals": {"linkedin": 100, "calls": 80}},
            },
            {
                "method": "POST",
                "path": "/api/day-report/filter",
                "summary": "Filter recruiter dashboard rows.",
                "requestExample": {"start": "2026-05-13", "end": "2026-05-15", "recruiter": "Komal"},
                "responseExample": filter_day_report("2026-05-13", "2026-05-15", "Komal"),
            },
            {
                "method": "GET",
                "path": "/api/submissions/dashboard",
                "summary": "Submission progress with MoM and YoY comparisons.",
                "requestExample": None,
                "responseExample": {"range": {"start": "2025-11", "end": "2026-05"}, "months": []},
            },
            {
                "method": "POST",
                "path": "/api/submissions/filter",
                "summary": "Filter submission progress by month range.",
                "requestExample": {"startMonth": "2026-01", "endMonth": "2026-05"},
                "responseExample": filter_submissions("2026-01", "2026-05"),
            },
            {
                "method": "GET",
                "path": "/api/linkedin/workspace",
                "summary": "LinkedIn recruiter discovery workspace.",
                "requestExample": None,
                "responseExample": {"stats": {}, "recruiters": []},
            },
            {
                "method": "POST",
                "path": "/api/linkedin/discover",
                "summary": "Discover LinkedIn recruiters by company/technology.",
                "requestExample": {"companies": ["TCS", "Infosys"], "technologies": ["Java"], "seniority": "Senior", "location": "Dallas, TX", "connections": "2nd", "resultsPerCompany": 5},
                "responseExample": {"recruiters": [], "totalFound": 0, "message": "Discovery completed."},
            },
            {
                "method": "GET",
                "path": "/api/meta/test-data",
                "summary": "Export full backend test dataset JSON.",
                "requestExample": None,
                "responseExample": {"counts": {"campaign_contacts": 6, "job_results": 6}},
            },
            {
                "method": "POST",
                "path": "/api/meta/test-data/append",
                "summary": "Append records to an appendable dataset.",
                "requestExample": {"dataset": "campaign_contacts", "entries": [{"name": "Priya N", "email": "priya@example.com", "company": "Acme", "status": "Queued", "list": "Priority Accounts"}]},
                "responseExample": {"success": True, "message": "Appended 1 record(s) to campaign_contacts.", "dataset": "campaign_contacts", "totalRecords": 7},
            },
            {
                "method": "POST",
                "path": "/api/meta/test-data/reset",
                "summary": "Reset runtime test data back to baseline JSON.",
                "requestExample": None,
                "responseExample": {"success": True, "message": "Test data reset to baseline JSON."},
            },
        ]
    }


# ── User Profile Management ────────────────────────────────────────────


_USER_PROFILES: Dict[str, Dict[str, Any]] = {
    "u-admin-1": {
        "id": "u-admin-1",
        "name": "Admin User",
        "email": "admin@marketingmind.ai",
        "role": "admin",
        "phone": "+1-555-0101",
        "company": "MarketingMind",
        "title": "Platform Administrator",
        "department": "Operations",
        "location": "San Francisco, CA",
        "timezone": "America/Los_Angeles",
        "bio": "Platform admin managing campaign operations and recruiter dashboards.",
        "createdAt": "2025-01-01T00:00:00Z",
        "lastLogin": "2026-06-13T18:30:00Z",
    },
    "u-super-1": {
        "id": "u-super-1",
        "name": "Super Admin",
        "email": "superadmin@marketingmind.ai",
        "role": "super_admin",
        "phone": "+1-555-0102",
        "company": "MarketingMind",
        "title": "Chief Operations Officer",
        "department": "Executive",
        "location": "New York, NY",
        "timezone": "America/New_York",
        "bio": "Leading the MarketingMind platform and overseeing all operations.",
        "createdAt": "2024-12-01T00:00:00Z",
        "lastLogin": "2026-06-13T22:15:00Z",
    },
    "u-user-1": {
        "id": "u-user-1",
        "name": "Read Only User",
        "email": "user@marketingmind.ai",
        "role": "user",
        "phone": "+1-555-0103",
        "company": "MarketingMind",
        "title": "Campaign Analyst",
        "department": "Marketing",
        "location": "Austin, TX",
        "timezone": "America/Chicago",
        "bio": "Analyzing campaign performance and reporting insights.",
        "createdAt": "2026-02-15T00:00:00Z",
        "lastLogin": "2026-06-13T16:45:00Z",
    },
}

_USER_SETTINGS: Dict[str, Dict[str, Any]] = {
    "u-admin-1": {
        "notifications": {
            "emailNotifications": True,
            "campaignAlerts": True,
            "jobAlerts": True,
            "dailyReport": False,
            "weeklyDigest": True,
        },
        "language": "en",
        "dateFormat": "MM/DD/YYYY",
        "theme": "light",
    },
    "u-super-1": {
        "notifications": {
            "emailNotifications": True,
            "campaignAlerts": True,
            "jobAlerts": True,
            "dailyReport": True,
            "weeklyDigest": True,
        },
        "language": "en",
        "dateFormat": "MM/DD/YYYY",
        "theme": "light",
    },
    "u-user-1": {
        "notifications": {
            "emailNotifications": True,
            "campaignAlerts": False,
            "jobAlerts": True,
            "dailyReport": False,
            "weeklyDigest": False,
        },
        "language": "en",
        "dateFormat": "MM/DD/YYYY",
        "theme": "light",
    },
}


def get_user_profile(user_id: str) -> dict:
    if user_id not in _USER_PROFILES:
        # Auto-create a minimal profile for any newly registered user
        from app.core.auth import _USERS_BY_EMAIL
        auth_record = next(
            (r for r in _USERS_BY_EMAIL.values() if r.id == user_id), None
        )
        now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        _USER_PROFILES[user_id] = {
            "id": user_id,
            "name": auth_record.name if auth_record else "User",
            "email": auth_record.email if auth_record else "",
            "role": auth_record.role if auth_record else "user",
            "phone": "",
            "company": "MarketingMind",
            "title": "",
            "department": "",
            "location": "",
            "timezone": "UTC",
            "bio": "",
            "createdAt": now_iso,
            "lastLogin": now_iso,
        }
    return deepcopy(_USER_PROFILES[user_id])


def update_user_profile(user_id: str, updates: dict) -> None:
    if user_id not in _USER_PROFILES:
        # Auto-initialize profile before updating
        get_user_profile(user_id)

    allowed_fields = {"name", "phone", "company", "title", "department", "location", "timezone", "bio"}
    for key in updates:
        if key not in allowed_fields:
            continue
        _USER_PROFILES[user_id][key] = updates[key]


def change_user_password(user_id: str, current_password: str, new_password: str, confirm_password: str) -> None:
    if new_password != confirm_password:
        raise ValueError("New passwords do not match.")

    if len(new_password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    # In production, verify current_password against hashed value in database
    # For demo, we just accept any current password
    return


def get_user_settings(user_id: str) -> dict:
    if user_id not in _USER_SETTINGS:
        _USER_SETTINGS[user_id] = {
            "notifications": {
                "emailNotifications": True,
                "campaignAlerts": True,
                "jobAlerts": True,
                "dailyReport": False,
                "weeklyDigest": True,
            },
            "language": "en",
            "dateFormat": "MM/DD/YYYY",
            "theme": "light",
        }
    return deepcopy(_USER_SETTINGS[user_id])


def update_user_settings(user_id: str, settings: dict) -> None:
    if user_id not in _USER_SETTINGS:
        _USER_SETTINGS[user_id] = settings
    else:
        _USER_SETTINGS[user_id].update(settings)
