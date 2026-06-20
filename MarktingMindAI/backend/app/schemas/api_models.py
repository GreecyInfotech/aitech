from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
URL_PATTERN = r"^https?://.+$"
MONTH_PATTERN = r"^\d{4}-\d{2}$"
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class DatabaseStatus(BaseModel):
    status: str
    message: str


class HealthResponse(BaseModel):
    status: str
    database: DatabaseStatus
    modules: List[str]


class OverviewModule(BaseModel):
    slug: str
    label: str
    description: str
    metric: str


class OverviewActivity(BaseModel):
    title: str
    detail: str


class OverviewResponse(BaseModel):
    headline: str
    modules: List[OverviewModule]
    activity: List[OverviewActivity]


class CampaignMetrics(BaseModel):
    emailsSent: int
    openRate: int
    replyRate: int
    bounceRate: int


class CampaignComposer(BaseModel):
    campaignName: str
    fromName: str
    fromEmail: str
    replyTo: str
    subject: str
    body: str
    mergeTags: List[str]
    aiPrompts: List[str]


class Contact(BaseModel):
    name: str
    email: str
    company: str
    status: str
    list: str


class ContactList(BaseModel):
    name: str
    contacts: int
    openRate: int
    replyRate: int


class CampaignItem(BaseModel):
    name: str
    sent: int
    opened: int
    replied: int
    status: str
    scheduledFor: str


class CampaignSettings(BaseModel):
    smtpHost: str
    smtpPort: int
    smtpUsername: str = ""
    smtpPassword: str = ""
    senderLimit: int
    emailDelaySeconds: int = 3
    smartWarmup: bool
    unsubscribeFooter: bool
    spamGuard: bool
    gmailSync: bool
    outlookSync: bool
    openTracking: bool
    aiSubjectAssist: bool
    honorUnsubscribes: bool = True
    bounceManagement: bool = True
    sendgridSync: bool = False
    aiProvider: str = "ollama"
    aiDefaultTone: str = "professional"
    aiPersonalization: bool = True


class CampaignWorkspaceResponse(BaseModel):
    metrics: CampaignMetrics
    composer: CampaignComposer
    contacts: List[Contact]
    lists: List[ContactList]
    campaigns: List[CampaignItem]
    templates: List[Dict[str, str]]
    settings: CampaignSettings


class CampaignTemplatePreviewRequest(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=20000)
    fromName: str = Field(default="", max_length=120)
    fromEmail: str = Field(default="", max_length=255)
    replyTo: str = Field(default="", max_length=255)


class CampaignPreviewRequest(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=20000)
    recipients: List[str] = Field(default_factory=list)

    @field_validator("recipients")
    @classmethod
    def validate_recipients(cls, value: List[str]) -> List[str]:
        for email in value:
            if not email or "@" not in email:
                raise ValueError("All recipients must be valid email values.")
        return value


class CampaignPreviewResponse(BaseModel):
    subject: str
    body: str
    recipientCount: int
    previewHtml: str


class CampaignTestSendRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=1, max_length=20000)
    fromName: str = Field(default="", max_length=120)
    fromEmail: str = Field(default="", max_length=255)
    replyTo: str = Field(default="", max_length=255)


class ActionResponse(BaseModel):
    success: bool
    message: str


class CampaignLaunchRequest(BaseModel):
    campaignName: str = Field(min_length=3, max_length=255)
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=20000)
    recipients: List[str] = Field(min_length=1)
    scheduledFor: str = Field(min_length=5, max_length=64)
    sendNow: bool = False
    fromName: str = Field(default="", max_length=120)
    fromEmail: str = Field(default="", max_length=255)
    replyTo: str = Field(default="", max_length=255)
    openTracking: bool = True
    autoFollowup: bool = False
    sendingSpeed: str = Field(default="50", max_length=16)
    emailDelaySeconds: int = Field(default=3, ge=0, le=300)
    listName: str = Field(default="", max_length=120)

    @field_validator("recipients")
    @classmethod
    def validate_launch_recipients(cls, value: List[str]) -> List[str]:
        invalid = [email for email in value if "@" not in email]
        if invalid:
            raise ValueError("All recipients must be valid email values.")
        return value


class CampaignLaunchResponse(BaseModel):
    success: bool
    message: str
    mode: str = "demo"
    campaign: Optional[Dict[str, Any]] = None
    sentCount: int = 0
    failedCount: int = 0


class CampaignDraftRequest(BaseModel):
    campaignName: str = Field(min_length=3, max_length=255)
    subject: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=20000)
    fromName: str = Field(default="", max_length=120)
    fromEmail: str = Field(default="", max_length=255)
    replyTo: str = Field(default="", max_length=255)


class CampaignDraftResponse(BaseModel):
    success: bool
    message: str
    campaign: Optional[Dict[str, Any]] = None


class CampaignContactImportItem(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)
    company: str = Field(default="", max_length=255)
    list: str = Field(default="Imported", max_length=120)
    status: str = Field(default="Queued", max_length=32)


class CampaignContactImportRequest(BaseModel):
    contacts: List[CampaignContactImportItem] = Field(min_length=1)
    listName: str = Field(default="Imported", max_length=120)


class CampaignContactImportResponse(BaseModel):
    imported: int
    skipped: int
    contacts: List[Contact]


class ContactListCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class JobStats(BaseModel):
    appliedToday: int
    newMatches: int
    interviews: int
    avgMatchScore: int


class JobProfile(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)
    phone: str = Field(min_length=6, max_length=40)
    location: str = Field(min_length=2, max_length=120)
    linkedin: str = Field(pattern=URL_PATTERN, max_length=255)
    experience: str = Field(min_length=2, max_length=60)
    employmentType: str = Field(min_length=2, max_length=80)
    rate: str = Field(min_length=1, max_length=60)
    visa: str = Field(min_length=1, max_length=40)
    workMode: str = Field(min_length=2, max_length=60)
    jobTitles: List[str] = Field(default_factory=list)
    resumeFileName: Optional[str] = None
    resumeSummary: Optional[str] = None
    resumeSkills: List[str] = Field(default_factory=list)


class JobAutomationSettings(BaseModel):
    autoApply: bool
    matchThreshold: int
    maxApplications: int
    alerts: bool
    tailorCv: bool
    scheduleEnabled: bool
    scheduleLabel: str
    scheduleTimezone: str = "America/New_York"
    scheduleTime: str = "09:00"


class SearchConfig(BaseModel):
    titles: List[str]
    requiredSkills: List[str]
    optionalSkills: List[str]
    location: str
    radius: str
    filters: List[str]
    excludeKeywords: List[str] = Field(default_factory=list)
    employmentType: str = "Both"
    minMatchScore: int = 70
    postedWithin: str = "7"
    experienceLevel: str = "Any"
    rateMin: str = ""
    rateMax: str = ""
    repeatEvery: str = "Once daily"


class PortalItem(BaseModel):
    name: str
    url: str
    status: str


class CarrierItem(BaseModel):
    name: str
    url: str
    status: str = "Monitoring"


class JobResult(BaseModel):
    id: int
    role: str
    company: str
    location: str
    type: str
    posted: str
    rate: Optional[str] = None
    match: int
    hot: bool
    skills: List[str]
    portalName: Optional[str] = None
    portalUrl: Optional[str] = None
    sourceUrl: Optional[str] = None
    description: Optional[str] = None


class AnalysisResult(BaseModel):
    selectedJobId: Optional[int] = None
    score: int
    summary: str
    hits: List[str]
    misses: List[str]
    suggestions: List[str]
    experienceMatch: Optional[str] = None
    titleMatch: Optional[str] = None
    jobDescription: Optional[str] = None
    skillGaps: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    tailoredScore: Optional[int] = None


class LinkedInJob(BaseModel):
    role: str
    company: str
    location: str
    type: Optional[str] = None
    posted: Optional[str] = None
    match: Optional[int] = None
    easyApply: bool
    applicants: int
    insight: str
    linkedinUrl: Optional[str] = None
    experienceLevel: Optional[str] = None
    datePosted: Optional[str] = None


class ApplicationRecord(BaseModel):
    role: str
    company: str
    status: str
    stage: str
    updated: str
    action: str
    portal: str = "Direct"
    date: str = ""
    match: Optional[int] = None
    postingUrl: str = ""


class ApplicationStats(BaseModel):
    applied: int
    interviews: int
    actionNeeded: int
    conversion: int
    responseRate: int = 0
    avgMatchScore: int = 0
    avgResponseTime: str = "—"
    bestPlatform: str = "—"


class ApplicationsPayload(BaseModel):
    all: List[ApplicationRecord]
    interviews: List[ApplicationRecord]
    actionNeeded: List[ApplicationRecord]
    stats: ApplicationStats


class JobAutomationWorkspaceResponse(BaseModel):
    stats: JobStats
    profile: JobProfile
    automation: JobAutomationSettings
    search: SearchConfig
    portals: List[PortalItem]
    carriers: List[CarrierItem]
    results: List[JobResult]
    savedJobs: List[int] = Field(default_factory=list)
    analysis: AnalysisResult
    linkedin: List[LinkedInJob]
    applications: ApplicationsPayload


class SearchRunRequest(BaseModel):
    titles: List[str] = Field(min_length=1)
    requiredSkills: List[str] = Field(default_factory=list)
    optionalSkills: List[str] = Field(default_factory=list)
    location: Optional[str] = None
    radius: Optional[str] = None
    filters: List[str] = Field(default_factory=list)
    excludeKeywords: List[str] = Field(default_factory=list)
    employmentType: str = "Both"
    minMatchScore: int = Field(default=70, ge=30, le=100)
    postedWithin: str = "7"
    experienceLevel: str = "Any"
    rateMin: str = ""
    rateMax: str = ""
    repeatEvery: str = "Once daily"

    @field_validator("titles")
    @classmethod
    def validate_titles(cls, value: List[str]) -> List[str]:
        clean = [item.strip() for item in value if item and item.strip()]
        if not clean:
            raise ValueError("At least one non-empty title is required.")
        return clean


class SearchConfigSaveRequest(BaseModel):
    titles: List[str] = Field(default_factory=list)
    requiredSkills: List[str] = Field(default_factory=list)
    optionalSkills: List[str] = Field(default_factory=list)
    location: str = ""
    radius: str = "50 miles"
    filters: List[str] = Field(default_factory=list)
    excludeKeywords: List[str] = Field(default_factory=list)
    employmentType: str = "Both Contract & Full Time"
    minMatchScore: int = Field(default=70, ge=30, le=100)
    postedWithin: str = "7"
    experienceLevel: str = "Any"
    rateMin: str = ""
    rateMax: str = ""
    repeatEvery: str = "Once daily"


class AnalyzeJobRequest(BaseModel):
    jobId: Optional[int] = None
    jobDescription: Optional[str] = Field(default=None, min_length=20)


class LinkedInJobSearchRequest(BaseModel):
    query: str = ""
    experienceLevel: str = "all"
    employmentType: str = "all"
    company: str = ""
    under10Applicants: bool = False
    datePosted: str = "all"
    easyApplyOnly: bool = False


class DeletePortalRequest(BaseModel):
    name: str = Field(min_length=1)
    url: str = Field(min_length=1)


class DeleteCarrierRequest(BaseModel):
    name: str = Field(min_length=1)
    url: str = Field(min_length=1)


class TailorResumeRequest(BaseModel):
    jobId: int = Field(gt=0)
    jobDescription: Optional[str] = None


class SaveTailoredResumeRequest(BaseModel):
    jobId: int = Field(gt=0)
    content: str = Field(min_length=20)


class AutoApplyRequest(BaseModel):
    matchThreshold: Optional[int] = Field(default=None, ge=30, le=100)


class ApplyJobsRequest(BaseModel):
    jobIds: List[int] = Field(min_length=1)


class SaveJobRequest(BaseModel):
    jobId: int = Field(gt=0)


class SaveJobResponse(BaseModel):
    success: bool
    message: str
    saved: bool


class ResumeParsedProfile(BaseModel):
    fullName: Optional[str] = Field(default=None, description="Candidate full name extracted from resume text.")
    email: Optional[str] = Field(default=None, description="Primary email address detected in the resume.")
    phone: Optional[str] = Field(default=None, description="Primary phone number detected in the resume.")
    location: Optional[str] = Field(default=None, description="Detected candidate location (city/state/country when present).")
    skills: List[str] = Field(default_factory=list, description="Normalized skills identified from resume content.")
    jobTitles: List[str] = Field(default_factory=list, description="Job titles inferred from resume content.")
    yearsExperience: Optional[float] = Field(default=None, description="Estimated years of experience inferred from resume text.")
    summary: str = Field(default="", description="Short text summary extracted from the resume body.")


class ResumeMlAssessment(BaseModel):
    modelType: str = Field(description="Scoring strategy used, for example sklearn_tfidf_cosine or keyword_overlap.")
    targetRole: str = Field(description="Role used as the target for match analysis.")
    matchScore: int = Field(description="Role-fit score from 0 to 100.")
    matchedSkills: List[str] = Field(default_factory=list, description="Required skills that were found in the resume.")
    missingSkills: List[str] = Field(default_factory=list, description="Required skills not found in the resume.")


class ResumeLlmAssessment(BaseModel):
    usedLangChain: bool = Field(description="True when LangChain pipeline was used for LLM analysis.")
    provider: str = Field(description="LLM provider used for analysis (or fallback).")
    model: str = Field(description="Model identifier used for LLM analysis.")
    status: str = Field(description="Execution status, such as ok or fallback.")
    insights: str = Field(description="Natural-language insights generated from resume analysis.")


class ResumeAgentTrace(BaseModel):
    used: bool = Field(description="True when a multi-step AI agent flow was used.")
    mode: str = Field(description="Agent mode, for example langchain-openai or fallback.")
    steps: List[str] = Field(default_factory=list, description="Trace of major processing steps executed during parsing.")


class ResumeParseResponse(BaseModel):
    filename: str = Field(description="Original uploaded file name.")
    contentType: str = Field(description="MIME type detected from uploaded file.")
    sizeBytes: int = Field(description="Uploaded file size in bytes.")
    extractedTextPreview: str = Field(description="Short preview of extracted resume text for quick inspection.")
    parsedProfile: ResumeParsedProfile = Field(description="Structured profile extracted from the resume.")
    mlAssessment: ResumeMlAssessment = Field(description="ML-based role-fit and skill match assessment.")
    llmAssessment: ResumeLlmAssessment = Field(description="LLM assessment output, or fallback details when disabled.")
    agentTrace: ResumeAgentTrace = Field(description="Execution trace for the parsing pipeline.")
    profile: Optional[JobProfile] = Field(default=None, description="Updated job profile after persisting parse results.")
    search: Optional[SearchConfig] = Field(default=None, description="Updated search config after persisting parse results.")
    message: Optional[str] = Field(default=None, description="Human-readable status message.")


class AddPortalRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    url: str = Field(pattern=URL_PATTERN, max_length=512)


class AddCarrierRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    url: str = Field(pattern=URL_PATTERN, max_length=512)


class ImportPortalsRequest(BaseModel):
    portals: List[AddPortalRequest] = Field(min_length=1)


class ImportCarriersRequest(BaseModel):
    carriers: List[AddCarrierRequest] = Field(min_length=1)


class DayReportRow(BaseModel):
    date: str
    recruiter: str
    technology: str
    linkedin: int
    calls: int
    sourced: int
    marketing: int
    notes: str


class DayReportDashboardResponse(BaseModel):
    range: Dict[str, str]
    bounds: Optional[Dict[str, str]] = None
    defaultRange: Optional[Dict[str, str]] = None
    recruiters: List[str]
    totals: Dict[str, int]
    rows: List[DayReportRow]


class DayReportFilterRequest(BaseModel):
    start: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
    end: Optional[str] = Field(default=None, pattern=DATE_PATTERN)
    recruiter: Optional[str] = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "DayReportFilterRequest":
        if self.start and self.end and self.start > self.end:
            raise ValueError("start must be less than or equal to end")
        return self


class SubmissionMonth(BaseModel):
    month: str
    submissions: int
    mom: Optional[float] = None
    yoy: Optional[float] = None


class SubmissionDashboardResponse(BaseModel):
    range: Dict[str, str]
    summary: Optional[Dict[str, int]] = None
    months: List[SubmissionMonth]


class SubmissionFilterRequest(BaseModel):
    startMonth: Optional[str] = Field(default=None, pattern=MONTH_PATTERN)
    endMonth: Optional[str] = Field(default=None, pattern=MONTH_PATTERN)

    @model_validator(mode="after")
    def validate_month_range(self) -> "SubmissionFilterRequest":
        if self.startMonth and self.endMonth and self.startMonth > self.endMonth:
            raise ValueError("startMonth must be less than or equal to endMonth")
        return self


class EndpointCatalogItem(BaseModel):
    method: str
    path: str
    summary: str
    requestExample: Optional[dict] = None
    responseExample: dict


class EndpointCatalogResponse(BaseModel):
    items: List[EndpointCatalogItem]


class TestDataDumpResponse(BaseModel):
    dataset: Dict[str, Any]
    counts: Dict[str, int]
    appendableDatasets: List[str]


class TestDataAppendRequest(BaseModel):
    dataset: str = Field(min_length=2, max_length=120)
    entries: List[Dict[str, Any]] = Field(default_factory=list)

    @field_validator("entries")
    @classmethod
    def validate_entries(cls, value: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not value:
            raise ValueError("entries must not be empty")
        return value


class TestDataAppendResponse(ActionResponse):
    dataset: str
    totalRecords: int


class AuthUser(BaseModel):
    id: str
    name: str
    email: str
    role: str


class AuthResponse(BaseModel):
    token: str
    user: AuthUser


class LoginRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(pattern=EMAIL_PATTERN, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    role: str = "user"


class AuthDemoUser(BaseModel):
    name: str
    email: str
    role: str


class AuthOptionsResponse(BaseModel):
    roles: List[str]
    demoUsers: List[AuthDemoUser]


# ── LinkedIn Recruiter Discovery ────────────────────────────────────────────


class LinkedInStats(BaseModel):
    recruitersFound: int
    contacted: int
    replied: int
    followupsDue: int


class RecruiterProfile(BaseModel):
    id: int
    name: str
    title: str
    company: str
    location: str
    techs: List[str]
    conn: str
    avatar: str
    match: int
    source: str
    email: str
    note: str
    status: str


class OutreachSequenceStep(BaseModel):
    label: str
    status: str
    date: str


class OutreachSequence(BaseModel):
    id: int
    name: str
    steps: List[OutreachSequenceStep]


class LinkedInFollowup(BaseModel):
    name: str
    company: str
    due: str
    type: str


class LinkedInMessageTemplate(BaseModel):
    name: str
    body: str


class LinkedInApiSource(BaseModel):
    id: str
    name: str
    shortCode: str
    description: str
    status: str
    color: str


class LinkedInApiUsageItem(BaseModel):
    label: str
    used: int
    limit: Optional[int] = None


class LinkedInSettings(BaseModel):
    autoRunDaily: bool
    autoEnrich: bool
    skipContacted: bool
    autoFollowup: bool
    aiPersonalize: bool
    maxPerDay: int
    delaySeconds: int
    accountEmail: str
    dailyConnections: int
    dailyInmails: int
    isPremium: bool
    respectDnc: bool
    honorUnsubscribes: bool
    usePermittedSources: bool


class LinkedInWorkspaceResponse(BaseModel):
    stats: LinkedInStats
    recruiters: List[RecruiterProfile]
    sequences: List[OutreachSequence]
    followups: List[LinkedInFollowup]
    templates: List[LinkedInMessageTemplate]
    apiSources: List[LinkedInApiSource]
    apiUsage: List[LinkedInApiUsageItem]
    settings: LinkedInSettings
    companies: List[str]
    technologies: List[str]
    apiConnected: bool
    pasteProfilesEnabled: bool
    outreachEnabled: bool


class LinkedInDiscoverRequest(BaseModel):
    companies: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    seniority: str = "Any"
    location: str = "United States"
    connections: str = "1st & 2nd degree"
    resultsPerCompany: int = Field(default=20, ge=5, le=100)


class LinkedInDiscoverResponse(BaseModel):
    recruiters: List[RecruiterProfile]
    totalFound: int
    message: str


class LinkedInEnrichRequest(BaseModel):
    urls: List[str] = Field(min_length=1)
    techContext: str = ""


class LinkedInEnrichResponse(BaseModel):
    profiles: List[RecruiterProfile]
    enriched: int
    message: str


class LinkedInOutreachRequest(BaseModel):
    recruiterIds: List[int] = Field(min_length=1)
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=5000)
    channel: str = "LinkedIn Message"
    scheduleAt: Optional[str] = None


class LinkedInGenerateMessageRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)
    messageType: str = "connect"
    tone: str = "Professional"
    channel: str = "LinkedIn Message"


class LinkedInGenerateMessageResponse(BaseModel):
    subject: str
    body: str
    messageType: str


class LinkedInSettingsUpdateRequest(BaseModel):
    settings: LinkedInSettings


class LinkedInApiKeysRequest(BaseModel):
    apollo: Optional[str] = None
    hunter: Optional[str] = None
    rocketreach: Optional[str] = None
    lusha: Optional[str] = None


# ── User Profile Management ────────────────────────────────────────────


class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    role: str
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    bio: Optional[str] = None
    createdAt: str
    lastLogin: Optional[str] = None


class UserProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)


class UserProfileResponse(BaseModel):
    user: UserProfile


class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=6)
    confirmPassword: str = Field(min_length=6)


class NotificationPreferences(BaseModel):
    emailNotifications: bool = True
    campaignAlerts: bool = True
    jobAlerts: bool = True
    dailyReport: bool = False
    weeklyDigest: bool = True


class UserSettingsResponse(BaseModel):
    notifications: NotificationPreferences
    language: str
    dateFormat: str
    theme: str
