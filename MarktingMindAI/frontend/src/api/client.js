import axios from 'axios'

const AUTH_TOKEN_KEY = 'mm_auth_token'
const AUTH_USER_KEY = 'mm_auth_user'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Surface a clear message from FastAPI validation errors
    if (error?.response?.data?.detail) {
      const detail = error.response.data.detail
      if (typeof detail === 'string') {
        error.message = detail
      } else if (Array.isArray(detail)) {
        error.message = detail.map((d) => d?.msg ?? JSON.stringify(d)).join('; ')
      }
    }
    return Promise.reject(error)
  },
)

export function getStoredAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const userRaw = localStorage.getItem(AUTH_USER_KEY)

  if (!token || !userRaw) {
    return null
  }

  try {
    return {
      token,
      user: JSON.parse(userRaw),
    }
  } catch {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}

export function setStoredAuth(authPayload) {
  localStorage.setItem(AUTH_TOKEN_KEY, authPayload.token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authPayload.user))
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

export async function fetchAuthOptions() {
  const response = await api.get('/api/auth/options')
  return response.data
}

export async function loginUser(payload) {
  const response = await api.post('/api/auth/login', payload)
  return response.data
}

export async function registerUser(payload) {
  const response = await api.post('/api/auth/register', payload)
  return response.data
}

export async function logoutUser() {
  const response = await api.post('/api/auth/logout')
  return response.data
}

export async function getCurrentSession() {
  const response = await api.get('/api/auth/me')
  return response.data
}

export async function loadWorkspaceData() {
  const [health, overview, campaigns, jobAutomation, dayReport, submissions] = await Promise.all([
    api.get('/health').catch(() => ({ data: { status: 'error', database: { status: 'unknown', message: 'Could not reach backend.' }, mongodb: { status: 'unknown', message: '' }, modules: [] } })),
    api.get('/api/overview'),
    api.get('/api/campaigns/workspace'),
    api.get('/api/job-automation/workspace'),
    api.get('/api/day-report/dashboard'),
    api.get('/api/submissions/dashboard'),
  ])

  return {
    health: health.data,
    overview: overview.data,
    campaigns: campaigns.data,
    jobAutomation: jobAutomation.data,
    dayReport: dayReport.data,
    submissions: submissions.data,
  }
}

export async function loadLinkedInWorkspace() {
  const response = await api.get('/api/linkedin/workspace')
  return response.data
}

export async function runLinkedInDiscovery(payload) {
  const response = await api.post('/api/linkedin/discover', payload)
  return response.data
}

export async function enrichLinkedInProfiles(payload) {
  const response = await api.post('/api/linkedin/enrich', payload)
  return response.data
}

export async function sendLinkedInOutreach(payload) {
  const response = await api.post('/api/linkedin/outreach', payload)
  return response.data
}

export async function generateLinkedInMessage(payload) {
  const response = await api.post('/api/linkedin/outreach/generate', payload)
  return response.data
}

export async function saveLinkedInSettings(payload) {
  const response = await api.put('/api/linkedin/settings', payload)
  return response.data
}

export async function saveLinkedInApiKeys(payload) {
  const response = await api.put('/api/linkedin/api-keys', payload)
  return response.data
}

export async function saveJobProfile(profile) {
  const response = await api.put('/api/job-automation/profile', profile)
  return response.data
}

export async function runJobSearch(searchPayload) {
  const response = await api.post('/api/job-automation/search/run', searchPayload)
  return response.data
}

export async function addPortalItem(portalPayload) {
  const response = await api.post('/api/job-automation/portals', portalPayload)
  return response.data
}

export async function addCarrierItem(carrierPayload) {
  const response = await api.post('/api/job-automation/carriers', carrierPayload)
  return response.data
}

export async function applyToJobs(jobIds) {
  const response = await api.post('/api/job-automation/apply', { jobIds })
  return response.data
}

export async function analyzeJob(jobId) {
  const response = await api.post('/api/job-automation/analyze', { jobId })
  return response.data
}

export async function saveJobItem(jobId) {
  const response = await api.post('/api/job-automation/save', { jobId })
  return response.data
}

export async function previewCampaign(payload) {
  const response = await api.post('/api/campaigns/preview', payload)
  return response.data
}

export async function sendCampaignTest(payload) {
  const response = await api.post('/api/campaigns/test-send', payload)
  return response.data
}

export async function launchCampaign(payload) {
  const response = await api.post('/api/campaigns/launch', payload)
  return response.data
}

export async function saveCampaignSettings(payload) {
  const response = await api.put('/api/campaigns/settings', payload)
  return response.data
}

export async function createCampaignList(name) {
  const response = await api.post('/api/campaigns/lists', { name })
  return response.data
}

export async function filterDayReportDashboard(payload) {
  const response = await api.post('/api/day-report/filter', payload)
  return response.data
}

export async function fetchApiEndpointCatalog() {
  const response = await api.get('/api/meta/endpoints')
  return response.data
}

export async function fetchBackendTestData() {
  const response = await api.get('/api/meta/test-data')
  return response.data
}

export async function appendBackendTestData(payload) {
  const response = await api.post('/api/meta/test-data/append', payload)
  return response.data
}

export async function resetBackendTestData() {
  const response = await api.post('/api/meta/test-data/reset')
  return response.data
}


// ── User Profile Management ────────────────────────────────────────────


export async function getUserProfile() {
  const response = await api.get('/api/user/profile')
  return response.data
}

export async function updateUserProfile(profile) {
  const response = await api.put('/api/user/profile', profile)
  return response.data
}

export async function changeUserPassword(payload) {
  const response = await api.put('/api/user/password', payload)
  return response.data
}

export async function getUserSettings() {
  const response = await api.get('/api/user/settings')
  return response.data
}

export async function updateUserSettings(settings) {
  const response = await api.put('/api/user/settings', settings)
  return response.data
}
