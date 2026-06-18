from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.auth import (
    ROLE_ADMIN,
    ROLE_SUPER_ADMIN,
    ROLE_USER,
    AuthError,
    get_auth_options,
    get_current_user,
    login_user,
    logout_user,
    register_user,
    require_roles,
)

from app.schemas.api_models import (
    ActionResponse,
    AddCarrierRequest,
    AddPortalRequest,
    AnalyzeJobRequest,
    AnalysisResult,
    ApplyJobsRequest,
    SaveJobRequest,
    SaveJobResponse,
    CampaignLaunchRequest,
    CampaignPreviewRequest,
    CampaignPreviewResponse,
    CampaignSettings,
    CampaignTestSendRequest,
    CampaignWorkspaceResponse,
    CarrierItem,
    ChangePasswordRequest,
    ContactList,
    ContactListCreateRequest,
    DayReportDashboardResponse,
    DayReportFilterRequest,
    EndpointCatalogResponse,
    HealthResponse,
    JobAutomationWorkspaceResponse,
    JobProfile,
    LinkedInApiKeysRequest,
    LinkedInDiscoverRequest,
    LinkedInDiscoverResponse,
    LinkedInEnrichRequest,
    LinkedInEnrichResponse,
    LinkedInGenerateMessageRequest,
    LinkedInGenerateMessageResponse,
    LinkedInOutreachRequest,
    LinkedInSettingsUpdateRequest,
    LinkedInWorkspaceResponse,
    LoginRequest,
    NotificationPreferences,
    OverviewResponse,
    PortalItem,
    RegisterRequest,
    ResumeParseResponse,
    SearchRunRequest,
    SubmissionDashboardResponse,
    SubmissionFilterRequest,
    AuthOptionsResponse,
    AuthResponse,
    TestDataAppendRequest,
    TestDataAppendResponse,
    TestDataDumpResponse,
    UserProfileResponse,
    UserProfileUpdateRequest,
    UserSettingsResponse,
)
from app.services.resume_ai import parse_resume_with_ai
from app.db.database import database_status
from app.db.mongodb_config import MongoDBConnection
from app.services.seed_data import (
    add_carrier,
    add_portal,
    analyze_job,
    apply_jobs,
    create_contact_list,
    enrich_linkedin_profiles,
    filter_day_report,
    filter_submissions,
    generate_linkedin_message,
    get_campaign_workspace,
    get_day_report_dashboard,
    get_endpoint_catalog,
    get_job_automation_workspace,
    get_linkedin_workspace,
    get_overview_payload,
    get_submission_dashboard,
    get_test_data_payload,
    launch_campaign,
    append_test_data_payload,
    preview_campaign,
    reset_test_data_payload,
    run_job_search,
    run_linkedin_discovery,
    save_campaign_settings,
    save_job,
    save_job_profile,
    save_linkedin_api_keys,
    save_linkedin_settings,
    send_linkedin_outreach,
    send_test_campaign,
)

router = APIRouter()


@router.get("/api/auth/options", response_model=AuthOptionsResponse)
def get_auth_bootstrap_options() -> dict:
    return get_auth_options()


@router.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> dict:
    try:
        return login_user(payload.email, payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/api/auth/register", response_model=AuthResponse)
def register(payload: RegisterRequest) -> dict:
    try:
        return register_user(payload.name, payload.email, payload.password, payload.role)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/auth/logout", response_model=ActionResponse, dependencies=[Depends(get_current_user)])
def logout(current_user: dict = Depends(get_current_user)) -> dict:
    logout_user(current_user["token"])
    return {"success": True, "message": "Logged out successfully."}


@router.get("/api/auth/me", response_model=AuthResponse, dependencies=[Depends(get_current_user)])
def auth_me(current_user: dict = Depends(get_current_user)) -> dict:
    return {
        "token": current_user["token"],
        "user": {
            "id": current_user["id"],
            "name": current_user["name"],
            "email": current_user["email"],
            "role": current_user["role"],
        },
    }


# ── User Profile Management ────────────────────────────────────────────


@router.get("/api/user/profile", response_model=UserProfileResponse, dependencies=[Depends(get_current_user)])
def get_user_profile(current_user: dict = Depends(get_current_user)) -> dict:
    from app.services.seed_data import get_user_profile as get_profile_data
    profile = get_profile_data(current_user["id"])
    return {"user": profile}


@router.put("/api/user/profile", response_model=ActionResponse, dependencies=[Depends(get_current_user)])
def update_user_profile(
    payload: UserProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    from app.services.seed_data import update_user_profile as update_profile_data
    update_profile_data(current_user["id"], payload.model_dump(exclude_none=True))
    return {"success": True, "message": "Profile updated successfully."}


@router.put("/api/user/password", response_model=ActionResponse, dependencies=[Depends(get_current_user)])
def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    from app.services.seed_data import change_user_password
    try:
        change_user_password(current_user["id"], payload.currentPassword, payload.newPassword, payload.confirmPassword)
        return {"success": True, "message": "Password changed successfully."}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/user/settings", response_model=UserSettingsResponse, dependencies=[Depends(get_current_user)])
def get_user_settings(current_user: dict = Depends(get_current_user)) -> dict:
    from app.services.seed_data import get_user_settings as get_settings_data
    return get_settings_data(current_user["id"])


@router.put("/api/user/settings", response_model=ActionResponse, dependencies=[Depends(get_current_user)])
def update_user_settings(
    payload: UserSettingsResponse,
    current_user: dict = Depends(get_current_user),
) -> dict:
    from app.services.seed_data import update_user_settings as update_settings_data
    update_settings_data(current_user["id"], payload.model_dump())
    return {"success": True, "message": "Settings updated successfully."}


@router.get("/health", response_model=HealthResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def health_check() -> dict:
    return {
        "status": "ok",
        "database": database_status(),
        "mongodb": MongoDBConnection.status(),
        "modules": ["overview", "campaigns", "job-automation", "day-report", "submissions", "linkedin"],
    }


@router.get("/api/overview", response_model=OverviewResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def get_overview() -> dict:
    return get_overview_payload()


@router.get("/api/campaigns/workspace", response_model=CampaignWorkspaceResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def get_campaigns_workspace() -> dict:
    return get_campaign_workspace()


@router.post("/api/campaigns/preview", response_model=CampaignPreviewResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def preview_campaign_payload(payload: CampaignPreviewRequest) -> dict:
    return preview_campaign(payload.subject, payload.body, payload.recipients)


@router.post("/api/campaigns/test-send", response_model=ActionResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def send_campaign_test(payload: CampaignTestSendRequest) -> dict:
    return send_test_campaign(payload.email, payload.subject, payload.body)


@router.post("/api/campaigns/launch", response_model=ActionResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def launch_campaign_payload(payload: CampaignLaunchRequest) -> dict:
    return launch_campaign(payload.model_dump())


@router.put("/api/campaigns/settings", response_model=ActionResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def save_campaign_settings_payload(payload: CampaignSettings) -> dict:
    return save_campaign_settings(payload.model_dump())


@router.post("/api/campaigns/lists", response_model=ContactList, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def create_campaign_list(payload: ContactListCreateRequest) -> dict:
    return create_contact_list(payload.name)


@router.get("/api/job-automation/workspace", response_model=JobAutomationWorkspaceResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def get_job_automation() -> dict:
    return get_job_automation_workspace()


@router.put("/api/job-automation/profile", response_model=ActionResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def save_job_profile_payload(payload: JobProfile) -> dict:
    return save_job_profile(payload.model_dump())


@router.post("/api/job-automation/search/run", dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def run_job_search_payload(payload: SearchRunRequest) -> dict:
    return run_job_search(payload.model_dump())


@router.post("/api/job-automation/portals", response_model=PortalItem, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def add_portal_payload(payload: AddPortalRequest) -> dict:
    return add_portal(payload.name, payload.url)


@router.post("/api/job-automation/carriers", response_model=CarrierItem, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def add_carrier_payload(payload: AddCarrierRequest) -> dict:
    return add_carrier(payload.name, payload.url)


@router.post("/api/job-automation/apply", response_model=ActionResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def apply_jobs_payload(payload: ApplyJobsRequest) -> dict:
    return apply_jobs(payload.jobIds)


@router.post("/api/job-automation/analyze", response_model=AnalysisResult, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def analyze_job_payload(payload: AnalyzeJobRequest) -> dict:
    return analyze_job(payload.jobId)


@router.post("/api/job-automation/save", response_model=SaveJobResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def save_job_payload(payload: SaveJobRequest) -> dict:
    return save_job(payload.jobId)


@router.post(
    "/api/job-automation/resume/parse",
    response_model=ResumeParseResponse,
    tags=["Job Automation"],
    summary="Upload and parse resume with AI",
    description=(
        "Accepts TXT, PDF, or DOCX resume files and returns structured profile extraction, "
        "ML role-fit scoring, and optional LangChain/OpenAI insights. "
        "When OPENAI_API_KEY is not configured, the endpoint falls back to deterministic parsing and ML scoring."
    ),
    response_description="Parsed resume profile with ML and LLM assessments.",
    dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file"],
                        "properties": {
                            "file": {"type": "string", "format": "binary", "description": "Resume file (.txt, .pdf, .docx)"},
                            "targetRole": {
                                "type": "string",
                                "default": "Software Engineer",
                                "description": "Target role used for match scoring.",
                            },
                            "requiredSkills": {
                                "type": "string",
                                "default": "Python, FastAPI, SQL",
                                "description": "Comma-separated required skills.",
                            },
                        },
                    },
                    "example": {
                        "targetRole": "Backend Engineer",
                        "requiredSkills": "Python,FastAPI,SQL,AWS,Docker",
                    },
                }
            },
        }
    },
)
async def parse_resume_payload(
    file: UploadFile = File(...),
    targetRole: str = Form("Software Engineer"),
    requiredSkills: str = Form("Python, FastAPI, SQL"),
) -> dict:
    required_skills = [skill.strip() for skill in requiredSkills.split(",") if skill.strip()]
    return await parse_resume_with_ai(file=file, target_role=targetRole, required_skills=required_skills)


@router.get("/api/day-report/dashboard", response_model=DayReportDashboardResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def get_day_report() -> dict:
    return get_day_report_dashboard()


@router.post("/api/day-report/filter", response_model=DayReportDashboardResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def filter_day_report_payload(payload: DayReportFilterRequest) -> dict:
    return filter_day_report(payload.start, payload.end, payload.recruiter)


@router.get("/api/submissions/dashboard", response_model=SubmissionDashboardResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def get_submission_progress() -> dict:
    return get_submission_dashboard()


@router.post("/api/submissions/filter", response_model=SubmissionDashboardResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def filter_submissions_payload(payload: SubmissionFilterRequest) -> dict:
    return filter_submissions(payload.startMonth, payload.endMonth)


@router.get("/api/meta/endpoints", response_model=EndpointCatalogResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def get_api_catalog() -> dict:
    return get_endpoint_catalog()


@router.get("/api/meta/test-data", response_model=TestDataDumpResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def get_test_data_dump() -> dict:
    return get_test_data_payload()


@router.post("/api/meta/test-data/append", response_model=TestDataAppendResponse, dependencies=[Depends(require_roles(ROLE_SUPER_ADMIN))])
def append_test_data_rows(payload: TestDataAppendRequest) -> dict:
    if not payload.entries:
        raise HTTPException(status_code=400, detail="entries must not be empty")
    try:
        return append_test_data_payload(payload.dataset, payload.entries)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/meta/test-data/reset", response_model=ActionResponse, dependencies=[Depends(require_roles(ROLE_SUPER_ADMIN))])
def reset_test_data_rows() -> dict:
    return reset_test_data_payload()


# ── LinkedIn Recruiter Discovery ────────────────────────────────────────────


@router.get("/api/linkedin/workspace", response_model=LinkedInWorkspaceResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def get_linkedin_workspace_endpoint() -> dict:
    return get_linkedin_workspace()


@router.post("/api/linkedin/discover", response_model=LinkedInDiscoverResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def linkedin_discover(payload: LinkedInDiscoverRequest) -> dict:
    return run_linkedin_discovery(
        payload.companies,
        payload.technologies,
        payload.seniority,
        payload.location,
        payload.connections,
        payload.resultsPerCompany,
    )


@router.post("/api/linkedin/enrich", response_model=LinkedInEnrichResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def linkedin_enrich(payload: LinkedInEnrichRequest) -> dict:
    return enrich_linkedin_profiles(payload.urls, payload.techContext)


@router.post("/api/linkedin/outreach", response_model=ActionResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def linkedin_outreach(payload: LinkedInOutreachRequest) -> dict:
    return send_linkedin_outreach(
        payload.recruiterIds,
        payload.subject,
        payload.body,
        payload.channel,
        payload.scheduleAt,
    )


@router.post("/api/linkedin/outreach/generate", response_model=LinkedInGenerateMessageResponse, dependencies=[Depends(require_roles(ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def linkedin_generate_message(payload: LinkedInGenerateMessageRequest) -> dict:
    return generate_linkedin_message(payload.prompt, payload.messageType, payload.tone, payload.channel)


@router.put("/api/linkedin/settings", response_model=ActionResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def linkedin_save_settings(payload: LinkedInSettingsUpdateRequest) -> dict:
    return save_linkedin_settings(payload.settings.model_dump())


@router.put("/api/linkedin/api-keys", response_model=ActionResponse, dependencies=[Depends(require_roles(ROLE_ADMIN, ROLE_SUPER_ADMIN))])
def linkedin_save_api_keys(payload: LinkedInApiKeysRequest) -> dict:
    return save_linkedin_api_keys(payload.model_dump(exclude_none=True))
