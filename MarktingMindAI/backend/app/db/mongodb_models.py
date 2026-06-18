"""
MongoDB Data Models
Pydantic models for database documents with serialization
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId


class PyObjectId(str):
    """Custom type for MongoDB ObjectId"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError(f'Invalid ObjectId: {v}')
        return ObjectId(v)

    def __repr__(self):
        return f'ObjectId({super().__repr__()})'


class UserDocument(BaseModel):
    """User database document"""
    id: str
    email: str
    name: str
    password: str  # Should be hashed in production
    role: str
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed = True


class CampaignDocument(BaseModel):
    """Campaign database document"""
    id: Optional[PyObjectId] = Field(None, alias='_id')
    name: str
    from_name: str
    from_email: str
    subject: str
    body: str
    status: str = 'draft'  # draft, scheduled, sent, paused
    created_at: datetime = Field(default_factory=datetime.utcnow)
    scheduled_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    metrics: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True


class JobProfileDocument(BaseModel):
    """Job Profile database document"""
    id: Optional[PyObjectId] = Field(None, alias='_id')
    user_id: str
    name: str
    email: str
    phone: str
    title: str
    experience_years: int
    skills: List[str]
    location: str
    linkedin_url: Optional[str] = None
    resume_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True


class LinkedInRecruiterDocument(BaseModel):
    """LinkedIn Recruiter database document"""
    id: Optional[PyObjectId] = Field(None, alias='_id')
    name: str
    title: str
    company: str
    email: str
    location: str
    skills: List[str]
    connection_degree: str
    match_score: int
    source: str
    status: str = 'new'  # new, contacted, replied, follow_up
    created_at: datetime = Field(default_factory=datetime.utcnow)
    contacted_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None

    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True


class DayReportDocument(BaseModel):
    """Daily Report database document"""
    id: Optional[PyObjectId] = Field(None, alias='_id')
    date: str  # YYYY-MM-DD
    recruiter: str
    linkedin_contacts: int = 0
    calls: int = 0
    sourced: int = 0
    marketing: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True


class SubmissionDocument(BaseModel):
    """Submission database document"""
    id: Optional[PyObjectId] = Field(None, alias='_id')
    month: str  # YYYY-MM
    submissions: int
    placement_rate: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True


class SessionDocument(BaseModel):
    """Active session database document"""
    id: Optional[PyObjectId] = Field(None, alias='_id')
    token: str
    user_id: str
    email: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime

    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True
