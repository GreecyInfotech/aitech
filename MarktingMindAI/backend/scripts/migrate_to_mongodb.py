#!/usr/bin/env python3
"""
MongoDB Data Migration Script
Migrates all in-memory seed data to MongoDB
Run this script to initialize your MongoDB database with sample data
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / 'backend'
sys.path.insert(0, str(backend_path))

from app.db.mongodb_config import MongoDBConnection, init_collections
from app.db.repositories import (
    UserRepository,
    CampaignRepository,
    JobProfileRepository,
    LinkedInRepository,
    DayReportRepository,
    SubmissionRepository
)
from app.db.mongodb_models import (
    UserDocument,
    CampaignDocument,
    JobProfileDocument,
    LinkedInRecruiterDocument,
    DayReportDocument,
    SubmissionDocument
)


def migrate_users():
    """Migrate user data to MongoDB"""
    print("\n📝 Migrating users...")
    repo = UserRepository()

    users = [
        UserDocument(
            id="u-super-1",
            email="superadmin@marketingmind.ai",
            name="Super Admin",
            password="Super@123",
            role="super_admin",
            phone="+1-555-0102",
            company="MarketingMind",
            title="Chief Operations Officer",
            created_at=datetime.utcnow() - timedelta(days=180)
        ),
        UserDocument(
            id="u-admin-1",
            email="admin@marketingmind.ai",
            name="Admin User",
            password="Admin@123",
            role="admin",
            phone="+1-555-0101",
            company="MarketingMind",
            title="Platform Administrator",
            created_at=datetime.utcnow() - timedelta(days=150)
        ),
        UserDocument(
            id="u-user-1",
            email="user@marketingmind.ai",
            name="Read Only User",
            password="User@123",
            role="user",
            phone="+1-555-0103",
            company="MarketingMind",
            title="Campaign Analyst",
            created_at=datetime.utcnow() - timedelta(days=120)
        ),
    ]

    for user in users:
        repo.create_user(user)
        print(f"  ✓ Created user: {user.email}")


def migrate_campaigns():
    """Migrate campaign data to MongoDB"""
    print("\n📧 Migrating campaigns...")
    repo = CampaignRepository()

    campaigns = [
        CampaignDocument(
            name="May Talent Pulse - Southwest",
            from_name="Sarah Mitchell",
            from_email="sarah@marketingmind.ai",
            subject="Available consultants | {{candidate_name}} | {{location}} | C2C",
            body="Hi {{recruiter_name}},\n\nI have a senior Java developer available immediately for {{location}}...",
            status="sent",
            sent_at=datetime.utcnow() - timedelta(days=5),
            metrics={"sent": 896, "opened": 447, "replied": 89, "bounce_rate": 2}
        ),
        CampaignDocument(
            name="June Pipeline - Mid-Market",
            from_name="Sarah Mitchell",
            from_email="sarah@marketingmind.ai",
            subject="Available consultants | {{candidate_name}} | {{location}}",
            body="Hi {{recruiter_name}},\n\nLooking for talent in {{location}}...",
            status="scheduled",
            scheduled_at=datetime.utcnow() + timedelta(days=2),
            metrics={}
        ),
    ]

    for campaign in campaigns:
        campaign_id = repo.create_campaign(campaign)
        print(f"  ✓ Created campaign: {campaign.name}")


def migrate_job_profiles():
    """Migrate job profile data to MongoDB"""
    print("\n👨‍💼 Migrating job profiles...")
    repo = JobProfileRepository()

    profile = JobProfileDocument(
        user_id="u-user-1",
        name="Alex Johnson",
        email="alex@example.com",
        phone="+1-555-1234",
        title="Senior Java Developer",
        experience_years=8,
        skills=["Java", "Spring Boot", "AWS", "Docker", "Kubernetes"],
        location="Austin, TX",
        linkedin_url="https://linkedin.com/in/alexjohnson",
        resume_url="https://s3.amazonaws.com/resumes/alex-johnson.pdf",
        created_at=datetime.utcnow() - timedelta(days=60)
    )

    profile_id = repo.create_profile(profile)
    print(f"  ✓ Created job profile: {profile.name} (ID: {profile_id})")


def migrate_linkedin_recruiters():
    """Migrate LinkedIn recruiter data to MongoDB"""
    print("\n🔗 Migrating LinkedIn recruiters...")
    repo = LinkedInRepository()

    recruiters = [
        LinkedInRecruiterDocument(
            name="Jessica Turner",
            title="Senior Technical Recruiter",
            company="TEKsystems",
            email="j.turner@teksystems.com",
            location="Dallas, TX",
            skills=["Java", "Spring Boot", "AWS"],
            connection_degree="2nd",
            match_score=96,
            source="Apollo",
            status="new",
            created_at=datetime.utcnow() - timedelta(days=30)
        ),
        LinkedInRecruiterDocument(
            name="Michael Patel",
            title="IT Recruiter — Java & Cloud",
            company="TEKsystems",
            email="m.patel@teksystems.com",
            location="Austin, TX",
            skills=["Java", "Microservices", "Kubernetes"],
            connection_degree="1st",
            match_score=93,
            source="Apollo",
            status="contacted",
            created_at=datetime.utcnow() - timedelta(days=25),
            contacted_at=datetime.utcnow() - timedelta(days=20)
        ),
        LinkedInRecruiterDocument(
            name="Anita Sharma",
            title="Technical Talent Acquisition",
            company="Infosys BPM",
            email="anita.s@infosys.com",
            location="Remote",
            skills=["Java", "Spring Boot", "DevOps"],
            connection_degree="2nd",
            match_score=91,
            source="Hunter",
            status="new",
            created_at=datetime.utcnow() - timedelta(days=15)
        ),
    ]

    for recruiter in recruiters:
        recruiter_id = repo.create_recruiter(recruiter)
        print(f"  ✓ Created recruiter: {recruiter.name} ({recruiter.company})")


def migrate_day_reports():
    """Migrate day report data to MongoDB"""
    print("\n📊 Migrating day reports...")
    repo = DayReportRepository()

    reports = []
    for i in range(10):
        date = (datetime.utcnow() - timedelta(days=i)).date().isoformat()
        report = DayReportDocument(
            date=date,
            recruiter="John Smith",
            linkedin_contacts=5 + (i % 3),
            calls=3 + (i % 2),
            sourced=2 + (i % 4),
            marketing=1 + (i % 3),
            created_at=datetime.utcnow() - timedelta(days=i)
        )
        reports.append(report)
        repo.create_report(report)

    print(f"  ✓ Created {len(reports)} day reports")


def migrate_submissions():
    """Migrate submission data to MongoDB"""
    print("\n📈 Migrating submissions...")
    repo = SubmissionRepository()

    submissions = [
        SubmissionDocument(
            month="2026-01",
            submissions=15,
            placement_rate=0.87,
            created_at=datetime.utcnow() - timedelta(days=180)
        ),
        SubmissionDocument(
            month="2026-02",
            submissions=18,
            placement_rate=0.89,
            created_at=datetime.utcnow() - timedelta(days=150)
        ),
        SubmissionDocument(
            month="2026-03",
            submissions=22,
            placement_rate=0.91,
            created_at=datetime.utcnow() - timedelta(days=120)
        ),
        SubmissionDocument(
            month="2026-04",
            submissions=25,
            placement_rate=0.93,
            created_at=datetime.utcnow() - timedelta(days=90)
        ),
        SubmissionDocument(
            month="2026-05",
            submissions=28,
            placement_rate=0.94,
            created_at=datetime.utcnow() - timedelta(days=60)
        ),
        SubmissionDocument(
            month="2026-06",
            submissions=32,
            placement_rate=0.95,
            created_at=datetime.utcnow() - timedelta(days=14)
        ),
    ]

    for submission in submissions:
        submission_id = repo.create_submission(submission)
        print(f"  ✓ Created submission: {submission.month} ({submission.submissions} submissions)")


def main():
    """Run all migrations"""
    print("\n" + "="*60)
    print("🚀 MongoDB Data Migration")
    print("="*60)

    try:
        # Connect to MongoDB
        print("\n🔌 Connecting to MongoDB...")
        db = MongoDBConnection.connect()

        if db is None:
            print("✗ Failed to connect to MongoDB")
            print("Ensure MongoDB is running and MONGODB_URL is configured correctly")
            return False

        print("✓ Connected successfully")

        # Initialize collections
        print("\n📋 Initializing collections...")
        init_collections()

        # Run migrations
        migrate_users()
        migrate_campaigns()
        migrate_job_profiles()
        migrate_linkedin_recruiters()
        migrate_day_reports()
        migrate_submissions()

        print("\n" + "="*60)
        print("✅ Migration completed successfully!")
        print("="*60)
        print("\nYour MongoDB database is now populated with seed data.")
        print("You can start the backend with: python -m uvicorn app.main:app")

        return True

    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        MongoDBConnection.close()


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
