"""
MongoDB Repository Layer
Data access layer for all database operations
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from .mongodb_config import get_collection, COLLECTIONS
from .mongodb_models import (
    UserDocument, CampaignDocument, JobProfileDocument,
    LinkedInRecruiterDocument, DayReportDocument,
    SubmissionDocument, SessionDocument
)


class BaseRepository:
    """Base repository with common CRUD operations"""

    def __init__(self, collection_name: str):
        self.collection = get_collection(collection_name)
        self.collection_name = collection_name

    def create(self, document: Dict[str, Any]) -> str:
        """Insert document and return ID"""
        if self.collection is None:
            raise RuntimeError("Database not connected")
        result = self.collection.insert_one(document)
        return str(result.inserted_id)

    def find_by_id(self, doc_id: str) -> Optional[Dict]:
        """Find document by ID"""
        if self.collection is None:
            return None
        try:
            return self.collection.find_one({'_id': ObjectId(doc_id)})
        except:
            return None

    def find_one(self, query: Dict) -> Optional[Dict]:
        """Find first document matching query"""
        if self.collection is None:
            return None
        return self.collection.find_one(query)

    def find_many(self, query: Dict, limit: int = 100) -> List[Dict]:
        """Find multiple documents"""
        if self.collection is None:
            return []
        return list(self.collection.find(query).limit(limit))

    def update(self, doc_id: str, updates: Dict) -> bool:
        """Update document"""
        if self.collection is None:
            return False
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(doc_id)},
                {'$set': updates}
            )
            return result.modified_count > 0
        except:
            return False

    def update_many(self, query: Dict, updates: Dict) -> int:
        """Update multiple documents"""
        if self.collection is None:
            return 0
        result = self.collection.update_many(query, {'$set': updates})
        return result.modified_count

    def delete(self, doc_id: str) -> bool:
        """Delete document"""
        if self.collection is None:
            return False
        try:
            result = self.collection.delete_one({'_id': ObjectId(doc_id)})
            return result.deleted_count > 0
        except:
            return False

    def count(self, query: Dict = None) -> int:
        """Count documents"""
        if self.collection is None:
            return 0
        query = query or {}
        return self.collection.count_documents(query)


class UserRepository(BaseRepository):
    """User data operations"""

    def __init__(self):
        super().__init__(COLLECTIONS['users'])

    def create_user(self, user: UserDocument) -> str:
        """Create new user"""
        return self.create(user.dict())

    def find_by_email(self, email: str) -> Optional[UserDocument]:
        """Find user by email"""
        doc = self.find_one({'email': email.lower()})
        return UserDocument(**doc) if doc else None

    def find_by_id(self, user_id: str) -> Optional[UserDocument]:
        """Find user by ID"""
        doc = super().find_by_id(user_id)
        return UserDocument(**doc) if doc else None

    def update_login_time(self, user_id: str) -> bool:
        """Update last login timestamp"""
        return self.update(user_id, {'last_login': datetime.utcnow()})


class CampaignRepository(BaseRepository):
    """Campaign data operations"""

    def __init__(self):
        super().__init__(COLLECTIONS['campaigns'])

    def create_campaign(self, campaign: CampaignDocument) -> str:
        """Create new campaign"""
        doc = campaign.dict(by_alias=True, exclude_none=True)
        return self.create(doc)

    def find_by_status(self, status: str) -> List[CampaignDocument]:
        """Find campaigns by status"""
        docs = self.find_many({'status': status})
        return [CampaignDocument(**doc) for doc in docs]

    def get_active_campaigns(self) -> List[CampaignDocument]:
        """Get all active campaigns"""
        docs = self.find_many({'status': {'$in': ['draft', 'scheduled', 'sent']}})
        return [CampaignDocument(**doc) for doc in docs]

    def update_metrics(self, campaign_id: str, metrics: Dict) -> bool:
        """Update campaign metrics"""
        return self.update(campaign_id, {'metrics': metrics})


class JobProfileRepository(BaseRepository):
    """Job Profile data operations"""

    def __init__(self):
        super().__init__(COLLECTIONS['job_profiles'])

    def create_profile(self, profile: JobProfileDocument) -> str:
        """Create job profile"""
        return self.create(profile.dict(by_alias=True, exclude_none=True))

    def find_by_user(self, user_id: str) -> Optional[JobProfileDocument]:
        """Find profile by user ID"""
        doc = self.find_one({'user_id': user_id})
        return JobProfileDocument(**doc) if doc else None

    def find_by_email(self, email: str) -> Optional[JobProfileDocument]:
        """Find profile by email"""
        doc = self.find_one({'email': email.lower()})
        return JobProfileDocument(**doc) if doc else None


class LinkedInRepository(BaseRepository):
    """LinkedIn Recruiter data operations"""

    def __init__(self):
        super().__init__(COLLECTIONS['linkedin_recruiters'])

    def create_recruiter(self, recruiter: LinkedInRecruiterDocument) -> str:
        """Create recruiter record"""
        return self.create(recruiter.dict(by_alias=True, exclude_none=True))

    def find_by_company(self, company: str) -> List[LinkedInRecruiterDocument]:
        """Find recruiters by company"""
        docs = self.find_many({'company': company})
        return [LinkedInRecruiterDocument(**doc) for doc in docs]

    def find_by_skills(self, skills: List[str]) -> List[LinkedInRecruiterDocument]:
        """Find recruiters with specific skills"""
        docs = self.find_many({'skills': {'$in': skills}})
        return [LinkedInRecruiterDocument(**doc) for doc in docs]

    def find_high_match(self, min_score: int = 85) -> List[LinkedInRecruiterDocument]:
        """Find recruiters with high match scores"""
        docs = self.find_many({'match_score': {'$gte': min_score}})
        return [LinkedInRecruiterDocument(**doc) for doc in docs]

    def update_status(self, recruiter_id: str, status: str, timestamp_field: str = None) -> bool:
        """Update recruiter status"""
        updates = {'status': status}
        if timestamp_field and status in ['contacted', 'replied']:
            updates[timestamp_field] = datetime.utcnow()
        return self.update(recruiter_id, updates)


class DayReportRepository(BaseRepository):
    """Day Report data operations"""

    def __init__(self):
        super().__init__(COLLECTIONS['day_report'])

    def create_report(self, report: DayReportDocument) -> str:
        """Create day report"""
        return self.create(report.dict(by_alias=True, exclude_none=True))

    def get_by_date(self, date: str) -> List[DayReportDocument]:
        """Get reports for specific date"""
        docs = self.find_many({'date': date})
        return [DayReportDocument(**doc) for doc in docs]

    def get_by_recruiter(self, recruiter: str, days: int = 30) -> List[DayReportDocument]:
        """Get recruiter reports for last N days"""
        start_date = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
        docs = self.find_many({
            'recruiter': recruiter,
            'date': {'$gte': start_date}
        })
        return [DayReportDocument(**doc) for doc in docs]

    def get_totals(self, recruiter: str = None, days: int = 30) -> Dict[str, int]:
        """Get activity totals"""
        pipeline = [
            {
                '$match': {
                    'date': {'$gte': (datetime.utcnow() - timedelta(days=days)).date().isoformat()}
                }
            }
        ]
        if recruiter:
            pipeline[0]['$match']['recruiter'] = recruiter

        pipeline.append({
            '$group': {
                '_id': None,
                'total_linkedin': {'$sum': '$linkedin_contacts'},
                'total_calls': {'$sum': '$calls'},
                'total_sourced': {'$sum': '$sourced'},
                'total_marketing': {'$sum': '$marketing'}
            }
        })

        result = list(self.collection.aggregate(pipeline))
        return result[0] if result else {}


class SubmissionRepository(BaseRepository):
    """Submission data operations"""

    def __init__(self):
        super().__init__(COLLECTIONS['submissions'])

    def create_submission(self, submission: SubmissionDocument) -> str:
        """Create submission record"""
        return self.create(submission.dict(by_alias=True, exclude_none=True))

    def get_monthly(self, year: int = None) -> List[SubmissionDocument]:
        """Get submissions for year"""
        if year is None:
            year = datetime.utcnow().year

        docs = self.find_many({
            'month': {'$regex': f'^{year}-'}
        })
        return [SubmissionDocument(**doc) for doc in docs]

    def get_trend(self, months: int = 12) -> List[SubmissionDocument]:
        """Get submission trend"""
        start_month = (datetime.utcnow() - timedelta(days=30*months)).date().replace(day=1).isoformat()[:7]
        docs = self.find_many({'month': {'$gte': start_month}})
        return [SubmissionDocument(**doc) for doc in docs]


class SessionRepository(BaseRepository):
    """Session data operations"""

    def __init__(self):
        super().__init__(COLLECTIONS['users'] + '_sessions')

    def create_session(self, session: SessionDocument) -> str:
        """Create session"""
        return self.create(session.dict(by_alias=True, exclude_none=True))

    def find_by_token(self, token: str) -> Optional[SessionDocument]:
        """Find session by token"""
        doc = self.find_one({'token': token})
        return SessionDocument(**doc) if doc else None

    def revoke_session(self, token: str) -> bool:
        """Revoke session"""
        return self.delete(token) if isinstance(token, str) else False

    def cleanup_expired(self) -> int:
        """Delete expired sessions"""
        return self.collection.delete_many({
            'expires_at': {'$lt': datetime.utcnow()}
        }).deleted_count if self.collection else 0
