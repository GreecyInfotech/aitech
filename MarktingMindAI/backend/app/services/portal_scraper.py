"""Simulated portal scraping for job automation workflows."""

from __future__ import annotations

import logging
import random
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

COMPANY_PREFIXES = [
    "Northwind",
    "Atlas",
    "Signal",
    "Lattice",
    "Summit",
    "Vertex",
    "Pinnacle",
    "Harbor",
    "Cobalt",
    "Meridian",
]
COMPANY_SUFFIXES = ["Systems", "Digital", "Labs", "Solutions", "Technologies", "Corp", "Group"]
EMPLOYMENT_TYPES = ["C2C", "W2", "C2H", "Full Time"]
LOCATIONS = ["Dallas, TX", "Austin, TX", "Remote", "Chicago, IL", "Houston, TX", "New York, NY"]


def _slug(text: str) -> str:
    return "".join(character if character.isalnum() else "-" for character in text.lower()).strip("-")


def _compute_match(title: str, skills: List[str], required_skills: List[str]) -> int:
    if not required_skills:
        return random.randint(72, 94)
    title_blob = title.lower()
    hits = 0
    for skill in required_skills:
        normalized = skill.lower().strip()
        if not normalized:
            continue
        if normalized in title_blob:
            hits += 1
            continue
        if any(normalized in candidate.lower() for candidate in skills):
            hits += 1
    base = 62 + hits * 9
    return min(98, base + random.randint(0, 5))


def build_scraped_job(
    *,
    job_id: int,
    portal: Dict[str, str],
    title: str,
    skills: List[str],
    location: str,
    required_skills: List[str],
    offset: int,
) -> Dict[str, Any]:
    company = f"{COMPANY_PREFIXES[offset % len(COMPANY_PREFIXES)]} {COMPANY_SUFFIXES[offset % len(COMPANY_SUFFIXES)]}"
    posted = str(random.randint(1, 7))
    role_skills = list(dict.fromkeys((skills or [])[:4] + (required_skills or [])[:3]))[:6]
    if not role_skills:
        role_skills = ["Java", "Spring Boot", "AWS"]
    match_score = _compute_match(title, role_skills, required_skills)
    portal_slug = _slug(portal["name"])
    return {
        "id": job_id,
        "role": title,
        "company": company,
        "location": location or LOCATIONS[offset % len(LOCATIONS)],
        "type": EMPLOYMENT_TYPES[offset % len(EMPLOYMENT_TYPES)],
        "posted": posted,
        "rate": f"${70 + offset * 3}–{88 + offset * 3}/hr",
        "match": match_score,
        "hot": match_score >= 90,
        "skills": role_skills,
        "portalName": portal["name"],
        "portalUrl": portal["url"],
        "sourceUrl": f"{portal['url'].rstrip('/')}/jobs/{portal_slug}/{job_id}",
        "description": (
            f"{title} at {company} in {location or 'Remote'}. "
            f"Scraped from {portal['name']}. Skills: {', '.join(role_skills)}."
        ),
    }


def existing_job_keys(jobs: List[Dict[str, Any]]) -> Set[Tuple[str, str, str]]:
    keys: Set[Tuple[str, str, str]] = set()
    for job in jobs:
        keys.add(
            (
                (job.get("role") or "").strip().lower(),
                (job.get("company") or "").strip().lower(),
                (job.get("portalName") or job.get("portal_name") or "").strip().lower(),
            )
        )
    return keys


def scrape_portal_jobs(
    portals: List[Dict[str, str]],
    *,
    titles: List[str],
    skills: List[str],
    required_skills: List[str],
    location: str,
    existing_jobs: List[Dict[str, Any]],
    next_job_id: int,
    max_per_portal: int = 3,
) -> tuple[List[Dict[str, Any]], int]:
    """Return newly scraped jobs and the next available job id."""
    if not portals:
        return [], next_job_id

    active_portals = [portal for portal in portals if (portal.get("status") or "Active") == "Active"]
    if not active_portals:
        active_portals = portals

    target_titles = [title.strip() for title in titles if title and title.strip()]
    if not target_titles:
        target_titles = ["Software Engineer", "Java Developer"]

    seen = existing_job_keys(existing_jobs)
    scraped: List[Dict[str, Any]] = []
    job_id = next_job_id
    offset = 0

    for portal in active_portals:
        portal_titles = target_titles[:max_per_portal]
        for title in portal_titles:
            candidate = build_scraped_job(
                job_id=job_id,
                portal=portal,
                title=title,
                skills=skills,
                location=location,
                required_skills=required_skills,
                offset=offset,
            )
            offset += 1
            key = (
                candidate["role"].strip().lower(),
                candidate["company"].strip().lower(),
                candidate["portalName"].strip().lower(),
            )
            if key in seen:
                continue
            seen.add(key)
            scraped.append(candidate)
            job_id += 1

    return scraped, job_id


def scrape_all_portal_jobs(
    portals: List[Dict[str, str]],
    *,
    titles: List[str],
    skills: List[str],
    required_skills: List[str],
    location: str,
    existing_jobs: List[Dict[str, Any]],
    next_job_id: int,
    max_per_portal: int = 3,
) -> tuple[List[Dict[str, Any]], int]:
    """Scrape all portals — Apify for LinkedIn when configured, simulated fallback otherwise."""
    if not portals:
        return [], next_job_id

    active_portals = [portal for portal in portals if (portal.get("status") or "Active") == "Active"]
    if not active_portals:
        active_portals = portals

    scraped: List[Dict[str, Any]] = []
    job_id = next_job_id
    working_existing = list(existing_jobs)

    try:
        from app.services.apify_scraper import (
            apify_configured,
            is_linkedin_portal,
            scrape_linkedin_jobs_apify,
        )
    except ImportError:
        apify_configured = lambda: False  # type: ignore[assignment]
        is_linkedin_portal = lambda _portal: False  # type: ignore[assignment]
        scrape_linkedin_jobs_apify = None  # type: ignore[assignment]

    apify_used = False
    for portal in active_portals:
        portal_batch: List[Dict[str, Any]] = []
        if apify_configured() and is_linkedin_portal(portal) and scrape_linkedin_jobs_apify:
            try:
                portal_batch, job_id = scrape_linkedin_jobs_apify(
                    portal,
                    titles=titles,
                    location=location,
                    existing_jobs=working_existing,
                    next_job_id=job_id,
                )
                apify_used = True
            except Exception as exc:
                logger.warning("Apify scrape failed for %s: %s", portal.get("name"), exc)
        if not portal_batch:
            portal_batch, job_id = scrape_portal_jobs(
                [portal],
                titles=titles,
                skills=skills,
                required_skills=required_skills,
                location=location,
                existing_jobs=working_existing,
                next_job_id=job_id,
                max_per_portal=max_per_portal,
            )
        scraped.extend(portal_batch)
        working_existing.extend(portal_batch)

    if apify_used:
        for job in scraped:
            job.setdefault("scrapeSource", "apify")

    return scraped, job_id
