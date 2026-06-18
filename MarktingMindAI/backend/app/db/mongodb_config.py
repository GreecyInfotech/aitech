"""
MongoDB Database Configuration and Models
Replaces in-memory storage with persistent MongoDB
"""

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from contextlib import contextmanager
import os
from typing import Optional

# MongoDB Connection Configuration
MONGODB_URL = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'marketingmind_ai')

class MongoDBConnection:
    """MongoDB connection manager"""
    _client: Optional[MongoClient] = None
    _db = None

    @classmethod
    def connect(cls, url: str = MONGODB_URL, db_name: str = MONGODB_DB_NAME):
        """Establish MongoDB connection"""
        if cls._client is None:
            try:
                cls._client = MongoClient(url, serverSelectionTimeoutMS=5000)
                # Test connection
                cls._client.admin.command('ping')
                cls._db = cls._client[db_name]
                print(f"✓ Connected to MongoDB: {db_name}")
                return cls._db
            except ConnectionFailure as e:
                print(f"✗ Failed to connect to MongoDB: {e}")
                return None
        return cls._db

    @classmethod
    def get_db(cls):
        """Get database instance"""
        if cls._db is None:
            cls.connect()
        return cls._db

    @classmethod
    def close(cls):
        """Close MongoDB connection"""
        if cls._client:
            cls._client.close()
            cls._client = None
            cls._db = None
            print("✓ MongoDB connection closed")

    @classmethod
    def status(cls) -> dict:
        """Return MongoDB connection health status."""
        if cls._client is None:
            return {"status": "not_configured", "message": "MongoDB client not initialised."}
        try:
            cls._client.admin.command("ping")
            db_name = cls._db.name if cls._db is not None else "unknown"
            return {"status": "available", "message": f"MongoDB connected to '{db_name}'."}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

# Collections configuration
COLLECTIONS = {
    'users': 'users',
    'campaigns': 'campaigns',
    'campaign_contacts': 'campaign_contacts',
    'campaign_templates': 'campaign_templates',
    'job_profiles': 'job_profiles',
    'job_searches': 'job_searches',
    'job_results': 'job_results',
    'linkedin_recruiters': 'linkedin_recruiters',
    'linkedin_sequences': 'linkedin_sequences',
    'linkedin_templates': 'linkedin_templates',
    'day_report': 'day_report',
    'submissions': 'submissions',
}

def init_collections():
    """Initialize MongoDB collections with indexes"""
    db = MongoDBConnection.get_db()

    if db is None:
        print("✗ Cannot initialize collections - database not connected")
        return

    # Users collection
    db[COLLECTIONS['users']].create_index('email', unique=True)
    db[COLLECTIONS['users']].create_index('role')

    # Campaigns collection
    db[COLLECTIONS['campaigns']].create_index('name')
    db[COLLECTIONS['campaigns']].create_index('created_at')
    db[COLLECTIONS['campaigns']].create_index('status')

    # Campaign contacts
    db[COLLECTIONS['campaign_contacts']].create_index('campaign_id')
    db[COLLECTIONS['campaign_contacts']].create_index('email')

    # Job profiles
    db[COLLECTIONS['job_profiles']].create_index('user_id', unique=True)
    db[COLLECTIONS['job_profiles']].create_index('email')

    # LinkedIn recruiters
    db[COLLECTIONS['linkedin_recruiters']].create_index('company')
    db[COLLECTIONS['linkedin_recruiters']].create_index('email', unique=True)
    db[COLLECTIONS['linkedin_recruiters']].create_index([('match_score', -1)])

    # Day report
    db[COLLECTIONS['day_report']].create_index([('date', -1), ('recruiter', 1)])

    # Submissions
    db[COLLECTIONS['submissions']].create_index([('month', -1)])

    print("✓ MongoDB collections initialized with indexes")

def get_collection(collection_name: str):
    """Get a specific collection"""
    db = MongoDBConnection.get_db()
    return db[collection_name] if db is not None else None
