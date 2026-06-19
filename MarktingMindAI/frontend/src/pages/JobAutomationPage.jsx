import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Calendar,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileSearch,
  FileText,
  Globe,
  Linkedin,
  MessageSquare,
  Search,
  Send,
  Trash2,
  TrendingUp,
  Upload,
  UserCircle2,
  WandSparkles,
  X,
} from 'lucide-react'

import {
  addCarrierItem,
  addPortalItem,
  analyzeJob,
  applyLinkedInJob,
  applyToJobs,
  deleteCarrierItem,
  deletePortalItem,
  getTailoredResume,
  importCarrierItems,
  importPortalItems,
  parseResumeFile,
  runAutoApply,
  runJobSearch,
  saveAutomationSettings,
  saveJobItem,
  saveJobProfile,
  saveSearchConfig,
  saveTailoredResume,
  searchLinkedInJobs,
  tailorResumeForJob,
} from '../api/client'
import {
  downloadTextFile,
  getCompanyInitials,
  getPortalInitials,
  LINKEDIN_DATE_POSTED,
  LINKEDIN_EXPERIENCE_LEVELS,
  LINKEDIN_SORT_OPTIONS,
  mergeUniqueSkills,
  mergeUniqueTitles,
  mapYearsToExperienceText,
  PROFILE_EMPLOYMENT_OPTIONS,
  PROFILE_VISA_OPTIONS,
  PROFILE_WORK_MODE_OPTIONS,
  readImportFile,
  SEARCH_EXPERIENCE_OPTIONS,
  SEARCH_POSTED_WITHIN_OPTIONS,
  SEARCH_RADIUS_OPTIONS,
  SEARCH_REPEAT_OPTIONS,
  sortLinkedInJobs,
  US_TIMEZONES,
  countSearchConfigItems,
  formatMatchSource,
  formatPipelineMatchSource,
} from '../utils/jobAutomationHelpers'
import { isEmail, isHttpUrl, isNonEmpty, isPhone } from '../utils/validators'

const panelTabs = [
  { key: 'profile', label: 'My Profile', shortLabel: 'Profile', hint: 'Resume & details', icon: UserCircle2, accent: 'cobalt' },
  { key: 'search', label: 'Job Search', shortLabel: 'Search', hint: 'Keywords & filters', icon: Search, accent: 'teal' },
  { key: 'portals', label: 'Portals', shortLabel: 'Portals', hint: 'Board connections', icon: Globe, accent: 'amber' },
  { key: 'results', label: 'Results', shortLabel: 'Results', hint: 'Matched roles', icon: Briefcase, accent: 'green' },
  { key: 'analyzer', label: 'CV Analyzer', shortLabel: 'Analyzer', hint: 'Fit & tailoring', icon: Cpu, accent: 'violet' },
  { key: 'linkedin', label: 'LinkedIn', shortLabel: 'LinkedIn', hint: 'Live job feed', icon: Linkedin, accent: 'blue' },
  { key: 'tracker', label: 'Tracker', shortLabel: 'Tracker', hint: 'Applications', icon: FileSearch, accent: 'rose' },
]

const trackerTabConfig = [
  { key: 'all', label: 'All Applications', icon: FileSearch },
  { key: 'interviews', label: 'Interviews', icon: Calendar },
  { key: 'actionNeeded', label: 'Action Needed', icon: AlertCircle },
  { key: 'stats', label: 'Statistics', icon: TrendingUp },
]

function getTrackerStatusTone(status = '') {
  const normalized = status.toLowerCase()
  if (normalized.includes('interview')) return 'interview'
  if (normalized.includes('reject')) return 'rejected'
  if (normalized.includes('review')) return 'review'
  if (normalized.includes('action')) return 'action'
  if (normalized.includes('applied')) return 'applied'
  return 'default'
}

const presetTitles = ['Java Developer', 'Python Developer', 'Data Engineer', 'Full Stack Developer']

function normalizeLabel(value) {
  return value.trim().toLowerCase()
}

function formatTitle(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

function TagEditor({ label, items, placeholder, onAdd, onRemove }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    if (!draft.trim()) {
      return
    }
    onAdd(draft)
    setDraft('')
  }

  return (
    <div className="page-stack dense">
      <label>{label}</label>
      <div className="tag-editor-shell">
        <div className="chip-wrap inset">
          {items.map((item) => (
            <span key={item} className="chip-button tag-chip">
              {item}
              <button type="button" className="chip-dismiss" onClick={() => onRemove(item)} aria-label={`Remove ${item}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="tag-editor-row">
          <input
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                commit()
              }
            }}
          />
          <button className="secondary-button" type="button" onClick={commit}>Add</button>
        </div>
      </div>
    </div>
  )
}

function AutomationToggle({ label, hint, enabled, onToggle }) {
  return (
    <button
      type="button"
      className="toggle-row toggle-button ja-automation-toggle"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
    >
      <div className="toggle-copy">
        <strong>{label}</strong>
        <p>{hint}</p>
      </div>
      <span className={`toggle-switch${enabled ? ' on' : ''}`} aria-hidden="true">
        <span className="toggle-knob" />
      </span>
    </button>
  )
}

function getPostedDays(postedLabel) {
  const numeric = Number.parseInt(postedLabel, 10)

  if (Number.isFinite(numeric)) {
    return numeric
  }

  return 999
}

function getFilteredJobs(results, filters) {
  const query = normalizeLabel(filters.query)

  const rows = results.filter((job) => {
    const searchText = [job.role, job.company, job.location, ...(job.skills ?? [])].join(' ').toLowerCase()
    const matchesQuery = !query || searchText.includes(query)
    const matchesType = filters.type === 'all' || job.type === filters.type
    const matchesScore = job.match >= filters.minScore
    const matchesDate = filters.postedWindow === 'all' || getPostedDays(job.posted) <= Number(filters.postedWindow)
    const excludeHit = (filters.excludeKeywords ?? []).some((kw) =>
      kw.trim() && searchText.includes(kw.trim().toLowerCase())
    )
    return matchesQuery && matchesType && matchesScore && matchesDate && !excludeHit
  })

  const sorted = [...rows]

  if (filters.sort === 'match') {
    sorted.sort((left, right) => right.match - left.match)
  } else if (filters.sort === 'recent') {
    sorted.sort((left, right) => getPostedDays(left.posted) - getPostedDays(right.posted))
  } else if (filters.sort === 'company') {
    sorted.sort((left, right) => left.company.localeCompare(right.company))
  } else if (filters.sort === 'rate') {
    sorted.sort((left, right) => {
      const extractRate = (r) => {
        const m = String(r?.rate ?? '').match(/\d[\d,]+/)
        return m ? Number(m[0].replace(/,/g, '')) : 0
      }
      return extractRate(right) - extractRate(left)
    })
  }

  return sorted
}

function getLinkedinResults(rows, searchTerm, easyApplyOnly) {
  const query = normalizeLabel(searchTerm)

  return rows.filter((row) => {
    const haystack = `${row.role} ${row.company} ${row.location} ${row.insight}`.toLowerCase()
    const matchesQuery = !query || haystack.includes(query)
    const matchesEasyApply = !easyApplyOnly || row.easyApply
    return matchesQuery && matchesEasyApply
  })
}

function bumpApplicationsState(applications, jobIds, fallbackJobs) {
  const selectedFallback = fallbackJobs.filter((job) => jobIds.includes(job.id))
  const createdRows = selectedFallback.map((job) => ({
    role: job.role,
    company: job.company,
    status: 'Applied',
    stage: 'Application submitted',
    updated: 'Just now',
    date: new Date().toISOString().slice(0, 10),
    action: 'Await response',
    portal: job.portalName ?? 'Direct',
    match: job.match ?? null,
    postingUrl: job.sourceUrl ?? job.portalUrl ?? '',
  }))

  return {
    ...applications,
    all: [...createdRows, ...applications.all],
    actionNeeded: applications.actionNeeded,
    interviews: applications.interviews,
    stats: {
      ...applications.stats,
      applied: applications.stats.applied + createdRows.length,
    },
  }
}

function ToastStack({ toasts }) {
  if (!toasts.length) {
    return null
  }

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast show ${toast.tone}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}

export function JobAutomationPage({ workspace, currentUser }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [trackerTab, setTrackerTab] = useState('all')
  const [profile, setProfile] = useState(null)
  const [searchConfig, setSearchConfig] = useState(null)
  const [automation, setAutomation] = useState(null)
  const [results, setResults] = useState([])
  const [applications, setApplications] = useState(null)
  const [analysisJobId, setAnalysisJobId] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [portals, setPortals] = useState([])
  const [carriers, setCarriers] = useState([])
  const [portalDraft, setPortalDraft] = useState({ name: '', url: '' })
  const [carrierDraft, setCarrierDraft] = useState({ name: '', url: '' })
  const [portalUploadName, setPortalUploadName] = useState('')
  const [carrierUploadName, setCarrierUploadName] = useState('')
  const [portalImportPreview, setPortalImportPreview] = useState([])
  const [carrierImportPreview, setCarrierImportPreview] = useState([])
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeFileName, setResumeFileName] = useState('')
  const [resumeParseResult, setResumeParseResult] = useState(null)
  const [jobDescriptionText, setJobDescriptionText] = useState('')
  const [tailoredResume, setTailoredResume] = useState({ content: '', jobId: null, score: null })
  const [selectedJobs, setSelectedJobs] = useState([])
  const [savedJobs, setSavedJobs] = useState([])
  const [appliedToday, setAppliedToday] = useState(0)
  const [resultsFilter, setResultsFilter] = useState({ query: '', type: 'all', postedWindow: 'all', minScore: 70, sort: 'match', excludeKeywords: [] })
  const [excludeKeywordsDraft, setExcludeKeywordsDraft] = useState('')
  const [analyzerDraft, setAnalyzerDraft] = useState('')
  const [linkedinFilters, setLinkedinFilters] = useState({
    query: '',
    experienceLevel: 'all',
    employmentType: 'all',
    company: '',
    under10Applicants: false,
    datePosted: 'all',
    easyApplyOnly: false,
  })
  const [linkedinSort, setLinkedinSort] = useState('relevance')
  const [linkedinRows, setLinkedinRows] = useState([])
  const [toasts, setToasts] = useState([])
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [showTailoredPreview, setShowTailoredPreview] = useState(false)
  const [searchProgress, setSearchProgress] = useState(null)
  const [matchingPipeline, setMatchingPipeline] = useState(null)
  const [appliedSuggestions, setAppliedSuggestions] = useState([])
  const [busyAction, setBusyAction] = useState('')
  const isReadOnly = currentUser?.role === 'user'

  useEffect(() => {
    if (!workspace) {
      return
    }

    setProfile(workspace.profile)
    setSearchConfig(workspace.search)
    setAutomation(workspace.automation)
    setResults(workspace.results)
    setApplications(workspace.applications)
    setAnalysisJobId(workspace.analysis.selectedJobId)
    setAnalysisResult(workspace.analysis)
    setPortals(workspace.portals)
    setCarriers(workspace.carriers)
    setLinkedinRows(workspace.linkedin)
    setAnalyzerDraft(workspace.analysis.jobDescription ?? workspace.analysis.summary ?? '')
    setJobDescriptionText(workspace.analysis.jobDescription ?? '')
    setSavedJobs(workspace.savedJobs ?? [])
    setAppliedToday(workspace.stats.appliedToday)
    if (workspace.profile?.resumeFileName) {
      setResumeFileName(workspace.profile.resumeFileName)
    }
    if (workspace.linkedin?.length) {
      setLinkedinRows(workspace.linkedin)
    }
  }, [workspace])

  useEffect(() => {
    if (activeTab === 'linkedin' && linkedinRows.length === 0 && workspace?.linkedin?.length) {
      runLinkedInSearchAction()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const deferredResultsFilter = useDeferredValue(resultsFilter)

  const filteredResults = useMemo(
    () => getFilteredJobs(results, deferredResultsFilter),
    [results, deferredResultsFilter],
  )

  const filteredLinkedin = useMemo(
    () => sortLinkedInJobs(linkedinRows, linkedinSort),
    [linkedinRows, linkedinSort],
  )

  const avgMatchScore = useMemo(() => {
    if (!results.length) {
      return workspace?.stats?.avgMatchScore ?? 0
    }
    return Math.round(results.reduce((sum, job) => sum + job.match, 0) / results.length)
  }, [results, workspace?.stats?.avgMatchScore])

  const tabBadges = useMemo(() => ({
    search: countSearchConfigItems(searchConfig),
    results: filteredResults.length,
    linkedin: linkedinRows.length,
    tracker: applications?.stats?.actionNeeded ?? 0,
  }), [searchConfig, filteredResults.length, linkedinRows.length, applications?.stats?.actionNeeded])

  if (!workspace || !profile || !searchConfig || !automation || !applications || !analysisResult) {
    return null
  }

  const selectedJob = analysisJobId ? results.find((job) => job.id === analysisJobId) : null
  const currentTrackerRows =
    trackerTab === 'interviews'
      ? applications.interviews
      : trackerTab === 'actionNeeded'
        ? applications.actionNeeded
        : applications.all

  const pushNotice = (message, tone = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3200)
  }

  const ensureCanModify = (actionLabel) => {
    if (!isReadOnly) {
      return true
    }
    pushNotice(`You have view-only access. ${actionLabel} requires admin access.`, 'error')
    return false
  }

  const validateProfile = () => {
    if (!isNonEmpty(profile.name, 2)) {
      pushNotice('Full name must be at least 2 characters.', 'error')
      return false
    }
    if (!isEmail(profile.email)) {
      pushNotice('Profile email must be valid.', 'error')
      return false
    }
    if (!isPhone(profile.phone)) {
      pushNotice('Enter a valid phone number (6+ digits).', 'error')
      return false
    }
    if (!isNonEmpty(profile.location, 2)) {
      pushNotice('Location is required.', 'error')
      return false
    }
    if (!isHttpUrl(profile.linkedin)) {
      pushNotice('LinkedIn must be a valid http/https URL.', 'error')
      return false
    }
    return true
  }

  const validateSearchConfig = () => {
    if (!Array.isArray(searchConfig.titles) || !searchConfig.titles.length) {
      pushNotice('Add at least one job title before search.', 'error')
      return false
    }
    if (!isNonEmpty(searchConfig.location, 2)) {
      pushNotice('Search location is required.', 'error')
      return false
    }
    return true
  }

  const updateProfile = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  const updateAutomation = (field, value) => {
    setAutomation((current) => ({ ...current, [field]: value }))
  }

  const updateSearchConfig = (field, value) => {
    setSearchConfig((current) => ({ ...current, [field]: value }))
  }

  const persistSearchConfig = async (nextConfig, successMessage) => {
    if (!ensureCanModify('Search configuration')) {
      return false
    }

    try {
      const response = await saveSearchConfig(nextConfig)
      if (response.search) {
        setSearchConfig(response.search)
      }
      if (successMessage) {
        pushNotice(successMessage)
      }
      return true
    } catch (error) {
      pushNotice(error.message ?? 'Failed to save search configuration.', 'error')
      return false
    }
  }

  const addTag = async (field, draft) => {
    const normalized = formatTitle(draft.trim())

    if (!normalized) {
      return
    }

    const currentItems = searchConfig[field] ?? []
    if (currentItems.some((item) => normalizeLabel(item) === normalizeLabel(normalized))) {
      pushNotice(`"${normalized}" is already in the list.`, 'warning')
      return
    }

    const nextConfig = { ...searchConfig, [field]: [...currentItems, normalized] }
    setSearchConfig(nextConfig)
    if (isReadOnly) {
      pushNotice(`Added "${normalized}" locally (admin access required to save).`, 'warning')
      return
    }
    await persistSearchConfig(nextConfig, `Added "${normalized}".`)
  }

  const removeTag = async (field, value) => {
    const nextConfig = {
      ...searchConfig,
      [field]: (searchConfig[field] ?? []).filter((item) => item !== value),
    }
    setSearchConfig(nextConfig)
    if (isReadOnly) {
      pushNotice(`Removed "${value}" locally (admin access required to save).`, 'warning')
      return
    }
    await persistSearchConfig(nextConfig, `Removed "${value}".`)
  }

  const saveSearchConfigAction = async () => {
    if (!validateSearchConfig()) {
      return
    }
    setBusyAction('saveSearch')
    try {
      await persistSearchConfig(searchConfig, 'Search configuration saved.')
    } finally {
      setBusyAction('')
    }
  }

  const addPresetSearchTitles = async () => {
    const merged = [...searchConfig.titles]

    presetTitles.forEach((title) => {
      if (!merged.some((item) => normalizeLabel(item) === normalizeLabel(title))) {
        merged.push(title)
      }
    })

    const nextConfig = { ...searchConfig, titles: merged }
    setSearchConfig(nextConfig)
    await persistSearchConfig(nextConfig, 'Preset job titles added to the search builder.')
  }

  const togglePortalStatus = (portal) => {
    if (!ensureCanModify('Portal status')) {
      return
    }

    setPortals((current) => current.map((item) => {
      if (item.name === portal.name && item.url === portal.url) {
        const nextStatus = (item.status ?? 'Active') === 'Active' ? 'Paused' : 'Active'
        pushNotice(`${portal.name} is now ${nextStatus}.`, nextStatus === 'Active' ? 'success' : 'warning')
        return { ...item, status: nextStatus }
      }
      return item
    }))
  }

  const applyAllSuggestions = () => {
    const suggestions = analysisResult.recommendations ?? analysisResult.suggestions ?? []
    if (!suggestions.length) {
      pushNotice('No suggestions to apply yet.', 'error')
      return
    }
    setAppliedSuggestions(suggestions)
    pushNotice(`All ${suggestions.length} suggestions applied to your CV draft.`, 'success')
  }

  const followUpAction = (item) => {
    pushNotice(`Follow-up reminder scheduled for ${item.company} — ${item.role}.`, 'success')
  }

  const viewPostingAction = (item) => {
    if (item.postingUrl) {
      window.open(item.postingUrl, '_blank', 'noopener,noreferrer')
      return
    }
    pushNotice(`No posting URL on file for ${item.role} at ${item.company}.`, 'warning')
  }

  const toggleJob = (jobId) => {
    setSelectedJobs((current) => (
      current.includes(jobId)
        ? current.filter((item) => item !== jobId)
        : [...current, jobId]
    ))
  }

  const saveProfileAction = async () => {
    if (!ensureCanModify('Profile update')) {
      return
    }

    if (!validateProfile()) {
      return
    }

    setBusyAction('saveProfile')

    try {
      const profileResponse = await saveJobProfile(profile)
      await saveAutomationSettings(automation)
      if (profileResponse.profile) {
        setProfile(profileResponse.profile)
      }
      if (profileResponse.search) {
        setSearchConfig(profileResponse.search)
      }
      pushNotice(profileResponse.message ?? 'Profile and automation settings saved.')
    } catch {
      pushNotice('Profile save failed. Check the backend connection.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const parseResumeAction = async () => {
    if (!resumeFile) {
      pushNotice('Upload a resume file before parsing.', 'error')
      return
    }

    setBusyAction('parseResume')

    try {
      const response = await parseResumeFile(
        resumeFile,
        searchConfig?.titles?.[0] ?? profile?.jobTitles?.[0] ?? 'Software Engineer',
        (searchConfig?.requiredSkills ?? []).join(',') || 'Java,Spring Boot,Python,AWS',
      )
      const parsed = response.parsedProfile ?? {}
      const titles = parsed.jobTitles?.length ? parsed.jobTitles : (searchConfig?.titles ?? [])
      const skills = parsed.skills ?? []
      const experienceText = mapYearsToExperienceText(parsed.yearsExperience)

      const nextProfile = response.profile ?? {
        ...profile,
        name: parsed.fullName || profile.name,
        email: parsed.email || profile.email,
        phone: parsed.phone || profile.phone,
        location: parsed.location || profile.location,
        experience: experienceText || profile.experience,
        jobTitles: mergeUniqueTitles(profile.jobTitles ?? [], titles),
        resumeFileName: response.filename,
        resumeSummary: parsed.summary || profile.resumeSummary,
        resumeSkills: skills,
      }

      const nextSearch = response.search ?? {
        ...searchConfig,
        titles: mergeUniqueTitles(searchConfig.titles ?? [], titles),
        requiredSkills: mergeUniqueSkills(searchConfig.requiredSkills ?? [], skills),
      }

      setProfile(nextProfile)
      setSearchConfig(nextSearch)
      setResumeParseResult({
        mlScore: response.mlAssessment?.matchScore,
        matchedSkills: response.mlAssessment?.matchedSkills ?? [],
        missingSkills: response.mlAssessment?.missingSkills ?? [],
        insights: response.llmAssessment?.insights ?? '',
        preview: response.extractedTextPreview ?? '',
        agentUsed: response.agentTrace?.used,
      })

      pushNotice(
        response.message
          ?? `Resume parsed — ${titles.length} title(s), ${skills.length} skill(s), ${response.mlAssessment?.matchScore ?? 0}% role fit.`,
      )
    } catch (error) {
      pushNotice(error.message ?? 'Resume parsing failed. Check file format and backend status.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const handleResumeFileSelect = (file) => {
    setResumeFile(file)
    setResumeFileName(file?.name ?? '')
  }

  const previewResumeAction = () => {
    if (resumeFile) {
      const url = URL.createObjectURL(resumeFile)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      pushNotice(`Opened preview for ${resumeFile.name}.`)
      return
    }

    if (resumeParseResult?.preview) {
      const previewWindow = window.open('', '_blank', 'noopener,noreferrer')
      if (previewWindow) {
        previewWindow.document.write(`<pre style="font-family:system-ui;padding:16px;white-space:pre-wrap;">${resumeParseResult.preview}</pre>`)
        previewWindow.document.close()
      }
      return
    }

    if (profile.resumeFileName || profile.resumeSummary) {
      pushNotice(`Active resume: ${profile.resumeFileName || 'parsed profile on file'}.`)
      return
    }

    pushNotice('Upload a resume before previewing.', 'error')
  }

  const runAutoApplyAction = async () => {
    if (!ensureCanModify('Auto apply')) {
      return
    }

    if (!portals.length) {
      pushNotice('Add at least one portal in the Portals tab before running auto apply.', 'error')
      return
    }

    if (!searchConfig?.titles?.length) {
      pushNotice('Configure at least one job title in Job Search before running auto apply.', 'error')
      return
    }

    setBusyAction('autoApply')
    setSearchProgress({
      active: true,
      message: `Scraping ${portals.length} configured portal(s)…`,
      pct: 10,
    })
    const progressTimer = window.setInterval(() => {
      setSearchProgress((current) => (
        current?.active
          ? { ...current, pct: Math.min((current.pct ?? 0) + 10, 90) }
          : current
      ))
    }, 400)

    try {
      const response = await runAutoApply(automation.matchThreshold)

      setSearchProgress({
        active: true,
        message: `Found ${response.results?.length ?? 0} matching role(s) across portals.`,
        pct: 100,
      })

      startTransition(() => {
        if (response.results?.length) {
          setResults(response.results)
        }
        setMatchingPipeline(response.matchingPipeline ?? null)
        setActiveTab('results')
      })

      const jobIds = response.jobIds ?? []
      if (jobIds.length) {
        setApplications((current) => bumpApplicationsState(current, jobIds, response.results ?? results))
        setAppliedToday((n) => n + jobIds.length)
      }

      pushNotice(
        response.message
          ?? `Auto apply completed with ${response.results?.length ?? 0} result(s).`,
      )
    } catch (error) {
      pushNotice(error.message ?? 'Auto apply failed. Check portals, search config, and backend service.', 'error')
    } finally {
      window.clearInterval(progressTimer)
      setBusyAction('')
      window.setTimeout(() => setSearchProgress(null), 800)
    }
  }

  const handleAutoApplyToggle = async () => {
    const next = !automation.autoApply
    updateAutomation('autoApply', next)
    if (!ensureCanModify('Automation settings')) {
      return
    }
    try {
      await saveAutomationSettings({ ...automation, autoApply: next })
      if (next) {
        await runAutoApplyAction()
      } else {
        pushNotice('Auto apply disabled.')
      }
    } catch {
      pushNotice('Failed to save automation settings.', 'error')
    }
  }

  const runSearchAction = async () => {
    if (!ensureCanModify('Search execution')) {
      return
    }

    if (!validateSearchConfig()) {
      return
    }

    setBusyAction('runSearch')
    setSearchProgress({ active: true, message: `Searching ${portals.length || 4} portals…`, pct: 8 })
    const progressTimer = window.setInterval(() => {
      setSearchProgress((current) => (
        current?.active
          ? { ...current, pct: Math.min((current.pct ?? 0) + 12, 92) }
          : current
      ))
    }, 350)

    try {
      await persistSearchConfig(searchConfig)
      const response = await runJobSearch({
        titles: searchConfig.titles,
        requiredSkills: searchConfig.requiredSkills,
        optionalSkills: searchConfig.optionalSkills,
        location: searchConfig.location,
        radius: searchConfig.radius,
        filters: searchConfig.filters,
        excludeKeywords: searchConfig.excludeKeywords,
        employmentType: searchConfig.employmentType ?? 'Both',
        minMatchScore: searchConfig.minMatchScore ?? 70,
        postedWithin: searchConfig.postedWithin ?? '7',
        experienceLevel: searchConfig.experienceLevel ?? 'Any',
        rateMin: searchConfig.rateMin ?? '',
        rateMax: searchConfig.rateMax ?? '',
        repeatEvery: searchConfig.repeatEvery ?? 'Once daily',
      })

      setSearchProgress({ active: true, message: `Found ${response.results?.length ?? 0} matching jobs!`, pct: 100 })

      startTransition(() => {
        if (response.results?.length) {
          setResults(response.results)
        }
        setMatchingPipeline(response.matchingPipeline ?? null)
        setActiveTab('results')
      })

      pushNotice(response.message ?? 'Search completed with fresh matches.')
    } catch (error) {
      pushNotice(error.message ?? 'Search failed. Verify the backend service and retry.', 'error')
    } finally {
      window.clearInterval(progressTimer)
      setBusyAction('')
      window.setTimeout(() => setSearchProgress(null), 700)
    }
  }

  const addPortalAction = async () => {
    if (!ensureCanModify('Portal updates')) {
      return
    }

    if (!portalDraft.name.trim() || !portalDraft.url.trim()) {
      pushNotice('Portal name and URL are required.', 'error')
      return
    }

    if (!isHttpUrl(portalDraft.url)) {
      pushNotice('Portal URL must be a valid http/https URL.', 'error')
      return
    }

    setBusyAction('addPortal')

    try {
      const created = await addPortalItem(portalDraft)
      const portal = created.portal ?? portalDraft
      setPortals((current) => [...current, { ...portal, status: portal.status ?? 'Active' }])
      setPortalDraft({ name: '', url: '' })
      pushNotice(created.message ?? 'Portal added to the automation queue.')
    } catch {
      pushNotice('Portal add failed. Check the backend service.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const addCarrierAction = async () => {
    if (!ensureCanModify('Carrier updates')) {
      return
    }

    if (!carrierDraft.name.trim() || !carrierDraft.url.trim()) {
      pushNotice('Carrier name and URL are required.', 'error')
      return
    }

    if (!isHttpUrl(carrierDraft.url)) {
      pushNotice('Carrier URL must be a valid http/https URL.', 'error')
      return
    }

    setBusyAction('addCarrier')

    try {
      const created = await addCarrierItem(carrierDraft)
      const carrier = created.carrier ?? carrierDraft
      setCarriers((current) => [...current, carrier])
      setCarrierDraft({ name: '', url: '' })
      pushNotice(created.message ?? 'Carrier page saved.')
    } catch {
      pushNotice('Carrier save failed. Check the backend service.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const analyzeAction = async (jobId = analysisJobId) => {
    if (!ensureCanModify('CV analysis')) {
      return
    }

    const description = jobDescriptionText.trim() || analyzerDraft.trim()
    if (!jobId && description.length < 20) {
      pushNotice('Select a job or paste a job description (20+ characters).', 'error')
      return
    }

    setBusyAction('analyze')

    try {
      const response = await analyzeJob({
        jobId: jobId || undefined,
        jobDescription: description || undefined,
      })
      const analysis = response.analysis ?? response
      setAnalysisResult(analysis)
      setHasAnalyzed(true)
      if (jobId) {
        setAnalysisJobId(jobId)
      }
      if (analysis.jobDescription) {
        setJobDescriptionText(analysis.jobDescription)
        setAnalyzerDraft(analysis.jobDescription)
      }
      pushNotice(response.message ?? `CV analysis completed — ${analysis.score}% match.`)
      setActiveTab('analyzer')
    } catch {
      pushNotice('CV analysis failed. Check the backend service.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const tailorResumeAction = async () => {
    if (!analysisJobId) {
      pushNotice('Select a job before tailoring the resume.', 'error')
      return
    }

    setBusyAction('tailor')

    try {
      const response = await tailorResumeForJob(analysisJobId, jobDescriptionText || analyzerDraft)
      setTailoredResume({
        content: response.content,
        jobId: analysisJobId,
        score: response.tailoredScore,
      })
      setShowTailoredPreview(true)
      if (response.analysis) {
        setAnalysisResult(response.analysis)
      }
      pushNotice(response.message ?? 'Resume tailored for this job.')
    } catch {
      pushNotice('Resume tailoring failed.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const saveTailoredResumeAction = async () => {
    if (!tailoredResume.content || !tailoredResume.jobId) {
      pushNotice('Tailor a resume before saving.', 'error')
      return
    }

    setBusyAction('saveTailored')

    try {
      const response = await saveTailoredResume(tailoredResume.jobId, tailoredResume.content)
      pushNotice(response.message ?? 'Tailored resume saved for this job.')
    } catch {
      pushNotice('Failed to save tailored resume.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const downloadTailoredResumeAction = () => {
    if (!tailoredResume.content) {
      pushNotice('Tailor a resume before downloading.', 'error')
      return
    }
    downloadTextFile(`tailored-resume-job-${tailoredResume.jobId}.txt`, tailoredResume.content)
    pushNotice('Tailored resume downloaded.')
  }

  const loadTailoredResumeAction = async (jobId) => {
    try {
      const response = await getTailoredResume(jobId)
      if (response.content) {
        setTailoredResume({ content: response.content, jobId, score: null })
        pushNotice('Saved tailored resume loaded.')
      }
    } catch {
      pushNotice('No saved tailored resume for this job.', 'error')
    }
  }

  const applyAction = async (jobIds) => {
    if (!ensureCanModify('Job applications')) {
      return
    }

    if (!jobIds.length) {
      pushNotice('Select at least one job before applying.', 'error')
      return
    }

    setBusyAction('apply')

    try {
      const response = await applyToJobs(jobIds)
      setApplications((current) => bumpApplicationsState(current, jobIds, results))
      setAppliedToday((n) => n + jobIds.length)
      setSelectedJobs([])
      pushNotice(response.message ?? `${jobIds.length} applications queued.`)
    } catch {
      pushNotice('Apply action failed. Check the backend service.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const saveJobAction = async (jobId) => {
    setBusyAction(`save-${jobId}`)
    try {
      const response = await saveJobItem(jobId)
      setSavedJobs((current) =>
        response.saved
          ? [...current, jobId]
          : current.filter((id) => id !== jobId)
      )
      pushNotice(response.message ?? (response.saved ? 'Job saved to favorites.' : 'Job removed from saved list.'))
    } catch {
      // Optimistic local toggle if backend unavailable
      setSavedJobs((current) =>
        current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId]
      )
      pushNotice(savedJobs.includes(jobId) ? 'Job removed from saved list.' : 'Job saved to favorites.')
    } finally {
      setBusyAction('')
    }
  }

  const removePortal = async (portal) => {
    if (!ensureCanModify('Portal updates')) {
      return
    }

    try {
      await deletePortalItem({ name: portal.name, url: portal.url })
      setPortals((current) => current.filter((item) => !(item.name === portal.name && item.url === portal.url)))
      pushNotice(`Portal '${portal.name}' removed.`)
    } catch {
      setPortals((current) => current.filter((item) => !(item.name === portal.name && item.url === portal.url)))
      pushNotice(`Portal '${portal.name}' removed locally.`)
    }
  }

  const removeCarrier = async (carrier) => {
    if (!ensureCanModify('Carrier updates')) {
      return
    }

    try {
      await deleteCarrierItem({ name: carrier.name, url: carrier.url })
      setCarriers((current) => current.filter((item) => !(item.name === carrier.name && item.url === carrier.url)))
      pushNotice(`Carrier '${carrier.name}' removed.`)
    } catch {
      setCarriers((current) => current.filter((item) => !(item.name === carrier.name && item.url === carrier.url)))
      pushNotice(`Carrier '${carrier.name}' removed locally.`)
    }
  }

  const previewPortalImport = async (file) => {
    const { rows } = await readImportFile(file)
    const validRows = rows.filter((row) => row?.name && row?.url)
    setPortalImportPreview(validRows)
    setPortalUploadName(file?.name ?? '')
    if (!validRows.length) {
      pushNotice('No rows with valid portal URLs found. Rows without http(s) links (e.g. APIs found) are ignored.', 'error')
      return
    }
    const skipped = rows.length - validRows.length
    pushNotice(
      skipped
        ? `Preview ready — ${validRows.length} portal row(s). Skipped ${skipped} row(s) without links.`
        : `Preview ready — ${validRows.length} portal row(s).`,
      'success',
    )
  }

  const confirmPortalImport = async () => {
    if (!portalImportPreview.length) {
      pushNotice('Preview an import before confirming.', 'error')
      return
    }
    if (!ensureCanModify('Portal import')) {
      return
    }

    setBusyAction('importPortals')
    try {
      const response = await importPortalItems(portalImportPreview)
      if (response.portals) {
        setPortals(response.portals)
      }
      setPortalImportPreview([])
      pushNotice(response.message ?? 'Portals imported.')
    } catch {
      pushNotice('Portal import failed.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const previewCarrierImport = async (file) => {
    const { rows } = await readImportFile(file)
    setCarrierImportPreview(rows)
    setCarrierUploadName(file?.name ?? '')
    pushNotice(rows.length ? `Preview ready — ${rows.length} carrier row(s).` : 'No valid carrier rows found.', rows.length ? 'success' : 'error')
  }

  const confirmCarrierImport = async () => {
    if (!carrierImportPreview.length) {
      pushNotice('Preview an import before confirming.', 'error')
      return
    }
    if (!ensureCanModify('Carrier import')) {
      return
    }

    setBusyAction('importCarriers')
    try {
      const response = await importCarrierItems(carrierImportPreview)
      if (response.carriers) {
        setCarriers(response.carriers)
      }
      setCarrierImportPreview([])
      pushNotice(response.message ?? 'Carrier pages imported.')
    } catch {
      pushNotice('Carrier import failed.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const runLinkedInSearchAction = async () => {
    setBusyAction('linkedinSearch')
    try {
      const response = await searchLinkedInJobs(linkedinFilters)
      setLinkedinRows(response.results ?? [])
      pushNotice(response.message ?? 'LinkedIn search refreshed.')
    } catch {
      pushNotice('LinkedIn search failed.', 'error')
    } finally {
      setBusyAction('')
    }
  }

  const linkedinApplyAction = async (job) => {
    if (!ensureCanModify('LinkedIn apply')) {
      return
    }

    try {
      const response = await applyLinkedInJob({
        role: job.role,
        company: job.company,
        easyApply: job.easyApply,
        linkedinUrl: job.linkedinUrl,
      })
      if (response.redirect && job.linkedinUrl) {
        window.open(job.linkedinUrl, '_blank', 'noopener,noreferrer')
      } else {
        setAppliedToday((n) => n + 1)
      }
      pushNotice(response.message ?? 'LinkedIn application processed.')
    } catch {
      if (job.linkedinUrl) {
        window.open(job.linkedinUrl, '_blank', 'noopener,noreferrer')
        pushNotice('Opened LinkedIn posting in a new tab.')
      } else {
        pushNotice('LinkedIn apply failed.', 'error')
      }
    }
  }

  return (
    <div className="page-stack ja-page">
      <section className="ja-module-banner glass-card">
        <div className="ja-module-header">
          <div className="ja-module-intro">
            <p className="fancy-eyebrow">
              <span className="fancy-eyebrow-dot" aria-hidden="true" />
              Job Automation Module
            </p>
            <h3 className="ja-title-fancy">Automate applications across job boards and LinkedIn.</h3>
            <div className="ja-feature-labels" aria-label="Module sections">
              {panelTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`fancy-label accent-${tab.accent}${activeTab === tab.key ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon size={13} aria-hidden="true" />
                    <span>{tab.shortLabel}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <span className="ja-live-badge">● LIVE</span>
        </div>

        <nav className="ja-fancy-nav" role="tablist" aria-label="Job automation sections">
          {panelTabs.map((tab) => {
            const Icon = tab.icon
            const badge =
              tab.key === 'search' ? tabBadges.search
                : tab.key === 'results' ? tabBadges.results
                  : tab.key === 'linkedin' ? tabBadges.linkedin
                    : tab.key === 'tracker' ? tabBadges.tracker
                      : null
            const badgeClass =
              tab.key === 'results' ? ' green'
                : tab.key === 'tracker' ? ' red'
                  : ''

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`ja-fancy-nav-item accent-${tab.accent}${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="ja-fancy-nav-icon">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="ja-fancy-nav-copy">
                  <strong>{tab.label}</strong>
                  <small>{tab.hint}</small>
                </span>
                {badge != null && badge > 0 ? (
                  <span className={`tab-count-badge${badgeClass}`}>{badge}</span>
                ) : null}
              </button>
            )
          })}
        </nav>
      </section>

      <section className="hero-panel">
        <div>
          <p className="eyebrow">Job Automation</p>
          <h3>Automate applications across job boards and LinkedIn.</h3>
          <p className="hero-copy">Resume optimization, portal scraping, and interview tracking in one workspace.</p>
        </div>
        <div className="hero-grid four-up">
          <div className="metric-tile accent-amber">
            <Briefcase size={18} />
            <strong>{appliedToday}</strong>
            <span>Applied today</span>
          </div>
          <div className="metric-tile accent-teal">
            <TrendingUp size={18} />
            <strong>{results.length}</strong>
            <span>New matches</span>
          </div>
          <div className="metric-tile accent-cobalt">
            <Send size={18} />
            <strong>{applications.stats.interviews}</strong>
            <span>Interviews</span>
          </div>
          <div className="metric-tile accent-amber">
            <Cpu size={18} />
            <strong>{avgMatchScore}%</strong>
            <span>Avg match score</span>
          </div>
        </div>
      </section>

      <ToastStack toasts={toasts} />

      {activeTab === 'profile' ? (
        <section className="page-stack dense">
          <section className="ja-profile-stats">
            <article className="ja-stat-card"><strong>{appliedToday}</strong><span>Applied Today</span></article>
            <article className="ja-stat-card"><strong>{results.length}</strong><span>New Matches</span></article>
            <article className="ja-stat-card"><strong>{applications.stats.interviews}</strong><span>Interviews</span></article>
            <article className="ja-stat-card"><strong>{avgMatchScore}%</strong><span>Avg Match Score</span></article>
          </section>
        <section className="ja-profile-layout dual-grid align-start">
          <div className="ja-profile-left page-stack dense">
            <article className="glass-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Personal information</p>
                  <h4>Contact details and location</h4>
                </div>
              </div>
              <div className="form-grid two-columns">
                <label>Full name<input value={profile.name} onChange={(event) => updateProfile('name', event.target.value)} /></label>
                <label>Email<input value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} /></label>
                <label>Phone<input value={profile.phone} onChange={(event) => updateProfile('phone', event.target.value)} /></label>
                <label>Location<input value={profile.location} onChange={(event) => updateProfile('location', event.target.value)} /></label>
                <label className="full-width">LinkedIn<input value={profile.linkedin} onChange={(event) => updateProfile('linkedin', event.target.value)} /></label>
              </div>
            </article>

            <article className="glass-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Work preferences</p>
                  <h4>Experience, employment, and availability</h4>
                </div>
              </div>
              <div className="form-grid two-columns">
                <label>
                  Total experience
                  <input
                    value={profile.experience ?? ''}
                    placeholder="e.g. 8 years, 5+ years Java development"
                    onChange={(event) => updateProfile('experience', event.target.value)}
                  />
                </label>
                <label>
                  Employment type
                  <select value={profile.employmentType ?? 'Both Contract & Full Time'} onChange={(event) => updateProfile('employmentType', event.target.value)}>
                    {PROFILE_EMPLOYMENT_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>Expected rate<input value={profile.rate} placeholder="$85/hr or $120,000/yr" onChange={(event) => updateProfile('rate', event.target.value)} /></label>
                <label>
                  Work authorization
                  <select value={profile.visa} onChange={(event) => updateProfile('visa', event.target.value)}>
                    {PROFILE_VISA_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="full-width">
                  Work mode preference
                  <select value={profile.workMode} onChange={(event) => updateProfile('workMode', event.target.value)}>
                    {PROFILE_WORK_MODE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
            </article>

            <div className="button-row">
              <button className="primary-button" type="button" disabled={busyAction === 'saveProfile'} onClick={saveProfileAction}>Save profile</button>
              <button className="secondary-button" type="button" onClick={() => setActiveTab('search')}>Configure search</button>
            </div>
          </div>

          <div className="ja-profile-right page-stack dense">
            <article className="glass-card ja-resume-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Resume upload</p>
                  <h4>Attach the active resume and stage it for parsing</h4>
                </div>
              </div>

              <label className="ja-resume-upload-zone">
                <input
                  type="file"
                  className="ja-resume-file-input"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(event) => handleResumeFileSelect(event.target.files?.[0] ?? null)}
                />
                <FileText size={32} className="ja-resume-upload-icon" aria-hidden="true" />
                <strong>Upload Resume</strong>
                <p>PDF, DOC, DOCX up to 10MB</p>
              </label>

              {resumeFileName ? (
                <div className="ja-resume-file-item">
                  <FileText size={16} aria-hidden="true" />
                  <span>{resumeFileName}</span>
                </div>
              ) : (
                <p className="ja-resume-hint">No file chosen</p>
              )}

              <div className="button-row ja-resume-actions">
                <button className="secondary-button" type="button" disabled={busyAction === 'parseResume'} onClick={parseResumeAction}>
                  <Cpu size={16} />
                  Parse with AI
                </button>
                <button className="ghost-button ja-resume-preview-btn" type="button" onClick={previewResumeAction}>
                  <Eye size={16} />
                  Preview
                </button>
              </div>
            </article>

            {(profile.jobTitles ?? []).length || profile.resumeSummary || (profile.resumeSkills ?? []).length || resumeParseResult ? (
              <article className="glass-card ja-resume-parsed-panel">
                {(profile.jobTitles ?? []).length ? (
                  <section className="ja-parsed-block">
                    <h5 className="ja-parsed-label">Present job titles (from resume)</h5>
                    <div className="chip-wrap inset ja-title-chip-wrap">
                      {profile.jobTitles.map((title) => (
                        <span key={title} className="chip-button static soft">{title}</span>
                      ))}
                    </div>
                  </section>
                ) : null}

                {profile.resumeSummary ? (
                  <section className="ja-parsed-block">
                    <h5 className="ja-parsed-label">Resume summary</h5>
                    <div className="ja-resume-summary-box">{profile.resumeSummary}</div>
                  </section>
                ) : null}

                {(profile.resumeSkills ?? []).length ? (
                  <section className="ja-parsed-block">
                    <h5 className="ja-parsed-label">Parsed skills</h5>
                    <div className="chip-wrap inset ja-skill-chip-wrap">
                      {profile.resumeSkills.map((skill) => (
                        <span key={skill} className="chip-button static success">{skill}</span>
                      ))}
                    </div>
                  </section>
                ) : null}

                {resumeParseResult ? (
                  <section className="ja-parsed-block ja-parse-results">
                    <h5 className="ja-parsed-label">
                      AI parse results
                      {resumeParseResult.mlScore != null ? ` (${resumeParseResult.mlScore}% role fit)` : ''}
                    </h5>
                    {resumeParseResult.matchedSkills?.length ? (
                      <div className="chip-wrap inset">
                        {resumeParseResult.matchedSkills.map((skill) => (
                          <span key={skill} className="chip-button static success">{skill}</span>
                        ))}
                      </div>
                    ) : null}
                    {resumeParseResult.missingSkills?.length ? (
                      <p className="support-copy"><strong>Gaps:</strong> {resumeParseResult.missingSkills.join(', ')}</p>
                    ) : null}
                    {resumeParseResult.insights ? (
                      <p className="support-copy">{resumeParseResult.insights}</p>
                    ) : null}
                    {resumeParseResult.preview ? (
                      <div className="ja-resume-summary-box compact">{resumeParseResult.preview}…</div>
                    ) : null}
                  </section>
                ) : null}
              </article>
            ) : null}

            <article className="glass-card ja-automation-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Automation</p>
                  <h4>Auto-apply settings</h4>
                </div>
              </div>

              <div className="ja-automation-toggles">
                <AutomationToggle
                  label="Auto-Apply to Matching Jobs"
                  hint="Apply when match score ≥ threshold"
                  enabled={automation.autoApply}
                  onToggle={handleAutoApplyToggle}
                />
              </div>

              <label className="ja-automation-field">
                Minimum match score
                <input
                  type="range"
                  className="match-threshold-slider"
                  min="50"
                  max="95"
                  value={automation.matchThreshold}
                  onChange={async (event) => {
                    const value = Number(event.target.value)
                    updateAutomation('matchThreshold', value)
                    if (ensureCanModify('Automation settings')) {
                      try {
                        await saveAutomationSettings({ ...automation, matchThreshold: value })
                      } catch {
                        pushNotice('Failed to save match threshold.', 'error')
                      }
                    }
                  }}
                />
                <div className="match-threshold-value">{automation.matchThreshold}%</div>
              </label>

              <label className="ja-automation-field">
                Max applications per day
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={automation.maxApplications}
                  onChange={(event) => updateAutomation('maxApplications', Number(event.target.value))}
                />
              </label>

              <div className="ja-automation-toggles">
                <AutomationToggle
                  label="Send Application Alerts"
                  hint="Email & SMS notifications"
                  enabled={automation.alerts}
                  onToggle={() => updateAutomation('alerts', !automation.alerts)}
                />
                <AutomationToggle
                  label="Tailor CV Automatically"
                  hint="AI rewrites resume for each job"
                  enabled={automation.tailorCv}
                  onToggle={() => updateAutomation('tailorCv', !automation.tailorCv)}
                />
                <AutomationToggle
                  label="Scheduled Discovery"
                  hint="Run recurring searches through the day"
                  enabled={automation.scheduleEnabled}
                  onToggle={() => updateAutomation('scheduleEnabled', !automation.scheduleEnabled)}
                />
              </div>

              <div className="ja-automation-schedule form-grid two-columns">
                <label className="ja-automation-field">
                  Scheduled time
                  <input
                    type="time"
                    value={automation.scheduleTime ?? '09:00'}
                    onChange={(event) => updateAutomation('scheduleTime', event.target.value)}
                  />
                </label>
                <label className="ja-automation-field">
                  Time zone
                  <select
                    value={automation.scheduleTimezone ?? 'America/New_York'}
                    onChange={(event) => updateAutomation('scheduleTimezone', event.target.value)}
                  >
                    {US_TIMEZONES.map((zone) => (
                      <option key={zone.value} value={zone.value}>{zone.label}</option>
                    ))}
                  </select>
                </label>
                <label className="ja-automation-field full-width">
                  Search schedule
                  <input value={automation.scheduleLabel} onChange={(event) => updateAutomation('scheduleLabel', event.target.value)} />
                </label>
              </div>

              <button className="secondary-button" type="button" disabled={busyAction === 'autoApply'} onClick={runAutoApplyAction}>
                Run auto apply now
              </button>
            </article>
          </div>
        </section>
        </section>
      ) : null}

      {activeTab === 'search' ? (
        <section className="dual-grid align-start">
          <article className="glass-card">
            <div className="section-heading inline-actions">
              <div>
                <p className="eyebrow">Search builder</p>
                <h4>Keywords, skills, and presets</h4>
              </div>
              <button className="secondary-button" type="button" onClick={addPresetSearchTitles}>Add preset titles</button>
            </div>
            <TagEditor
              label="Job titles"
              items={searchConfig.titles}
              placeholder="Add target job title"
              onAdd={(value) => addTag('titles', value)}
              onRemove={(value) => removeTag('titles', value)}
            />
            <TagEditor
              label="Required skills (AND)"
              items={searchConfig.requiredSkills}
              placeholder="Add must-have skill"
              onAdd={(value) => addTag('requiredSkills', value)}
              onRemove={(value) => removeTag('requiredSkills', value)}
            />
            <TagEditor
              label="Optional skills (OR)"
              items={searchConfig.optionalSkills}
              placeholder="Add optional skill"
              onAdd={(value) => addTag('optionalSkills', value)}
              onRemove={(value) => removeTag('optionalSkills', value)}
            />
          </article>

          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Scope</p>
                <h4>Location, filters, and schedule</h4>
              </div>
            </div>
            <div className="form-grid two-columns">
              <label>Location<input value={searchConfig.location} onChange={(event) => updateSearchConfig('location', event.target.value)} /></label>
              <label>
                Radius
                <select value={searchConfig.radius} onChange={(event) => updateSearchConfig('radius', event.target.value)}>
                  {SEARCH_RADIUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                Job posted within
                <select value={searchConfig.postedWithin ?? '7'} onChange={(event) => updateSearchConfig('postedWithin', event.target.value)}>
                  {SEARCH_POSTED_WITHIN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Experience level
                <select value={searchConfig.experienceLevel ?? 'Any'} onChange={(event) => updateSearchConfig('experienceLevel', event.target.value)}>
                  {SEARCH_EXPERIENCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>Rate min ($)<input value={searchConfig.rateMin ?? ''} placeholder="e.g. 70" onChange={(event) => updateSearchConfig('rateMin', event.target.value)} /></label>
              <label>Rate max ($)<input value={searchConfig.rateMax ?? ''} placeholder="e.g. 120" onChange={(event) => updateSearchConfig('rateMax', event.target.value)} /></label>
              <label>
                Employment type
                <select
                  value={searchConfig.employmentType ?? 'Both'}
                  onChange={(event) => updateSearchConfig('employmentType', event.target.value)}
                >
                  {PROFILE_EMPLOYMENT_OPTIONS.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Match score (min {searchConfig.minMatchScore ?? 70}%)
                <input
                  type="range"
                  className="match-threshold-slider"
                  min="50"
                  max="95"
                  value={searchConfig.minMatchScore ?? 70}
                  onChange={(event) => updateSearchConfig('minMatchScore', Number(event.target.value))}
                />
              </label>
              <label>
                Repeat every
                <select value={searchConfig.repeatEvery ?? 'Once daily'} onChange={(event) => updateSearchConfig('repeatEvery', event.target.value)}>
                  {SEARCH_REPEAT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="full-span">Advanced filters<input value={searchConfig.filters.join(', ')} onChange={(event) => updateSearchConfig('filters', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} /></label>
              <label className="full-span">
                Exclude keywords
                <input
                  value={excludeKeywordsDraft}
                  placeholder="e.g. Clearance, Security (comma-separated)"
                  onChange={(event) => setExcludeKeywordsDraft(event.target.value)}
                  onBlur={() => updateSearchConfig('excludeKeywords', excludeKeywordsDraft.split(',').map((k) => k.trim()).filter(Boolean))}
                />
              </label>
            </div>
            {searchProgress?.active ? (
              <div className="search-progress-panel">
                <strong>{searchProgress.message}</strong>
                <div className="search-progress-track">
                  <div className="search-progress-fill" style={{ width: `${searchProgress.pct}%` }} />
                </div>
              </div>
            ) : null}
            <div className="button-row">
              <button className="primary-button" type="button" disabled={busyAction === 'saveSearch'} onClick={saveSearchConfigAction}>Save search config</button>
              <button className="primary-button" type="button" disabled={busyAction === 'runSearch'} onClick={runSearchAction}>Run search now</button>
              <button className="secondary-button" type="button" onClick={() => setActiveTab('results')}>View results</button>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'portals' ? (
        <section className="dual-grid align-start">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Configured portals</p>
                <h4>Excel upload and portal management</h4>
              </div>
            </div>
            <div className="attachment-dropzone compact-dropzone">
              <strong>Upload portal URLs via Excel</strong>
              <span>{portalUploadName || 'Stage a .xlsx or .csv with portal name + URL columns. Rows without links are skipped.'}</span>
              <div className="button-row">
                <label className="secondary-button file-trigger">
                  <Upload size={16} />
                  Upload file
                  <input
                    type="file"
                    accept=".csv,.xlsx,.txt"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        previewPortalImport(file)
                      }
                    }}
                  />
                </label>
                <button className="secondary-button" type="button" onClick={confirmPortalImport} disabled={!portalImportPreview.length}>Confirm import</button>
              </div>
            </div>
            {portalImportPreview.length ? (
              <div className="nested-card page-stack dense">
                <strong>Import preview ({portalImportPreview.length} rows with valid URLs)</strong>
                {portalImportPreview.map((row, index) => (
                  <div key={`${row.name}-${row.url}-${index}`} className="list-card list-card-inline">
                    <div><strong>{row.name}</strong><p>{row.url}</p></div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="card-list compact-list">
              {portals.map((portal) => (
                <div key={`${portal.name}-${portal.url}`} className="list-card list-card-inline">
                  <span className="portal-avatar">{getPortalInitials(portal.name)}</span>
                  <div>
                    <strong>{portal.name}</strong>
                    <p>{portal.url}</p>
                  </div>
                  <div className="button-row compact-actions">
                    <button
                      type="button"
                      className={`status-toggle${(portal.status ?? 'Active') === 'Active' ? ' active' : ' paused'}`}
                      onClick={() => togglePortalStatus(portal)}
                    >
                      {portal.status ?? 'Active'}
                    </button>
                    <button className="secondary-button icon-button" type="button" onClick={() => removePortal(portal)} aria-label={`Remove ${portal.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="form-grid two-columns compact-gap">
              <label>Portal name<input value={portalDraft.name} onChange={(event) => setPortalDraft((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Portal URL<input value={portalDraft.url} onChange={(event) => setPortalDraft((current) => ({ ...current, url: event.target.value }))} /></label>
            </div>
            <button className="primary-button" type="button" disabled={busyAction === 'addPortal'} onClick={addPortalAction}>Add portal</button>
          </article>

          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Carrier pages</p>
                <h4>Client career sites</h4>
              </div>
            </div>
            <div className="attachment-dropzone compact-dropzone">
              <strong>Upload career pages via Excel/CSV</strong>
              <span>{carrierUploadName || 'Stage a .xlsx or .csv source for batch ingestion.'}</span>
              <div className="button-row">
                <label className="secondary-button file-trigger">
                  <Upload size={16} />
                  Upload file
                  <input
                    type="file"
                    accept=".csv,.xlsx,.txt"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        previewCarrierImport(file)
                      }
                    }}
                  />
                </label>
                <button className="secondary-button" type="button" onClick={confirmCarrierImport} disabled={!carrierImportPreview.length}>Confirm import</button>
              </div>
            </div>
            {carrierImportPreview.length ? (
              <div className="nested-card page-stack dense">
                <strong>Import preview ({carrierImportPreview.length} rows)</strong>
                {carrierImportPreview.map((row) => (
                  <div key={`${row.name}-${row.url}`} className="list-card list-card-inline">
                    <div><strong>{row.name}</strong><p>{row.url}</p></div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="card-list compact-list">
              {carriers.map((carrier) => (
                <div key={`${carrier.name}-${carrier.url}`} className="list-card list-card-inline">
                  <span className="portal-avatar">{getPortalInitials(carrier.name)}</span>
                  <div>
                    <strong>{carrier.name}</strong>
                    <p>{carrier.url}</p>
                  </div>
                  <div className="button-row compact-actions">
                    <span className="monitoring-badge">{carrier.status ?? 'Monitoring'}</span>
                    <button className="secondary-button icon-button" type="button" onClick={() => removeCarrier(carrier)} aria-label={`Remove ${carrier.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="form-grid two-columns compact-gap">
              <label>Carrier name<input value={carrierDraft.name} onChange={(event) => setCarrierDraft((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Carrier URL<input value={carrierDraft.url} onChange={(event) => setCarrierDraft((current) => ({ ...current, url: event.target.value }))} /></label>
            </div>
            <button className="primary-button" type="button" disabled={busyAction === 'addCarrier'} onClick={addCarrierAction}>Add carrier</button>
          </article>
        </section>
      ) : null}

      {activeTab === 'results' ? (
        <section className="page-stack dense">
          <div className="section-heading inline-actions">
            <div>
              <p className="eyebrow">Matched roles</p>
              <h4>{filteredResults.length} qualified results</h4>
            </div>
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => setSelectedJobs(filteredResults.map((job) => job.id))}>Select all filtered</button>
              <button className="primary-button" type="button" disabled={busyAction === 'apply'} onClick={() => applyAction(selectedJobs.length ? selectedJobs : filteredResults.map((job) => job.id))}>
                <Send size={16} />
                Apply selected ({selectedJobs.length || filteredResults.length})
              </button>
            </div>
          </div>

          {matchingPipeline ? (
            <article className={`ja-tracker-banner${matchingPipeline.llmUsed ? ' success' : ' warning'}`}>
              <div>
                <strong>
                  CV ↔ job matching pipeline
                  {' · '}
                  {formatPipelineMatchSource(matchingPipeline.matchSource, matchingPipeline.llmUsed)}
                </strong>
                <p>{matchingPipeline.message}</p>
                {matchingPipeline.embeddingModel ? (
                  <p className="support-copy" style={{ marginTop: 4 }}>
                    Embeddings: <strong>{matchingPipeline.embeddingModel.split('/').pop()}</strong>
                    {matchingPipeline.llmProvider && matchingPipeline.llmUsed
                      ? ` · LLM: ${matchingPipeline.llmProvider}`
                      : null}
                  </p>
                ) : null}
                {matchingPipeline.steps?.length ? (
                  <div className="chip-wrap inset" style={{ marginTop: 8 }}>
                    {matchingPipeline.steps.map((step) => (
                      <span key={step} className="chip-button static soft">{step.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                ) : null}
                {!matchingPipeline.llmUsed ? (
                  <p className="support-copy" style={{ marginTop: 8 }}>
                    Start <strong>Ollama</strong> with <code>ollama run mistral</code> (USE_LOCAL_LLM=true)
                    or add <strong>OPENAI_API_KEY</strong> to <code>backend/.env</code> for ranking explanations.
                  </p>
                ) : null}
              </div>
            </article>
          ) : null}

          <article className="glass-card">
            <div className="form-grid results-filter-grid">
              <label>Search<input value={resultsFilter.query} onChange={(event) => setResultsFilter((current) => ({ ...current, query: event.target.value }))} placeholder="Role, company, skill" /></label>
              <label>
                Job type
                <select value={resultsFilter.type} onChange={(event) => setResultsFilter((current) => ({ ...current, type: event.target.value }))}>
                  <option value="all">All</option>
                  <option value="Full Time">Full Time</option>
                  <option value="C2C">C2C</option>
                  <option value="W2">W2</option>
                  <option value="C2H">C2H</option>
                  <option value="Contract">Contract</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </label>
              <label>
                Posted within
                <select value={resultsFilter.postedWindow} onChange={(event) => setResultsFilter((current) => ({ ...current, postedWindow: event.target.value }))}>
                  <option value="all">Any time</option>
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                </select>
              </label>
              <label>
                Sort by
                <select value={resultsFilter.sort} onChange={(event) => setResultsFilter((current) => ({ ...current, sort: event.target.value }))}>
                  <option value="match">Match score</option>
                  <option value="recent">Most recent</option>
                  <option value="company">Company</option>
                  <option value="rate">Highest rate</option>
                </select>
              </label>
              <label className="full-span">
                Minimum match score: {resultsFilter.minScore}%
                <input type="range" min="50" max="95" value={resultsFilter.minScore} onChange={(event) => setResultsFilter((current) => ({ ...current, minScore: Number(event.target.value) }))} />
              </label>
              <label className="full-span">
                Exclude keywords
                <input
                  value={resultsFilter.excludeKeywords.join(', ')}
                  placeholder="e.g. Clearance, Security"
                  onChange={(event) => setResultsFilter((current) => ({
                    ...current,
                    excludeKeywords: event.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                  }))}
                />
              </label>
            </div>
          </article>

          <div className="card-grid two-up">
            {filteredResults.map((job) => (
              <article key={job.id} className={`glass-card selectable${selectedJobs.includes(job.id) ? ' selected' : ''}`}>
                <div className="job-card-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedJobs.includes(job.id)}
                    onChange={() => toggleJob(job.id)}
                    aria-label={`Select ${job.role} at ${job.company}`}
                  />
                  <div style={{ flex: 1 }}>
                <div className="module-header">
                  <div>
                    <h4>{job.role}{job.hot ? <span className="chip-button static hot" style={{ marginLeft: 8, fontSize: 11 }}>🔥 Hot</span> : null}</h4>
                    <p>{job.company} · {job.location}</p>
                    {job.portalName ? <p className="support-copy">Portal: {job.portalName}</p> : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="metric-chip">{job.match}% match</span>
                    {job.matchSource ? (
                      <p className="support-copy" style={{ marginTop: 4, fontSize: 11 }}>
                        {formatMatchSource(job.matchSource)}
                      </p>
                    ) : null}
                    {job.rate ? <p style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginTop: 4 }}>{job.rate}</p> : null}
                  </div>
                </div>
                {job.matchInsight ? (
                  <p className="support-copy" style={{ marginBottom: 8 }}>{job.matchInsight}</p>
                ) : null}
                <div className="chip-wrap inset">
                  <span className="chip-button static">{job.type}</span>
                  <span className="chip-button static">{job.posted}h ago</span>
                  {job.portalName ? <span className="chip-button static soft">{job.portalName}</span> : null}
                </div>
                {job.sourceUrl ? (
                  <a className="inline-link" href={job.sourceUrl} target="_blank" rel="noreferrer">View on {job.portalName ?? 'portal'}</a>
                ) : null}
                <div className="progress-track"><div className="progress-fill" style={{ width: `${job.match}%` }} /></div>
                <div className="chip-wrap inset">
                  {job.skills.map((skill) => <span key={skill} className="chip-button static soft">{skill}</span>)}
                </div>
                <div className="button-row wrap-actions">
                  <button className="primary-button" type="button" disabled={busyAction === 'apply'} onClick={() => applyAction([job.id])}>Quick apply</button>
                  <button className="secondary-button" type="button" onClick={() => { setAnalysisJobId(job.id); setJobDescriptionText(job.description ?? ''); setAnalyzerDraft(job.description ?? ''); setActiveTab('analyzer') }}>Analyze</button>
                  <button
                    className="secondary-button icon-button"
                    type="button"
                    disabled={busyAction === `save-${job.id}`}
                    onClick={() => saveJobAction(job.id)}
                    title={savedJobs.includes(job.id) ? 'Remove from saved' : 'Save to favorites'}
                    aria-label={savedJobs.includes(job.id) ? 'Remove from saved' : 'Save to favorites'}
                  >
                    {savedJobs.includes(job.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  </button>
                </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'analyzer' ? (
        <section className="dual-grid align-start">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Analyzer</p>
                <h4>Select a job and compare it with the current CV</h4>
              </div>
            </div>
            <label>
              Optional job reference
              <select value={analysisJobId ?? ''} onChange={(event) => {
                const id = event.target.value ? Number(event.target.value) : null
                setAnalysisJobId(id)
                if (id) {
                  const job = results.find((row) => row.id === id)
                  if (job?.description) {
                    setJobDescriptionText(job.description)
                    setAnalyzerDraft(job.description)
                  }
                }
              }}>
                <option value="">Manual job description only</option>
                {results.map((job) => (
                  <option key={job.id} value={job.id}>{job.role} · {job.company}</option>
                ))}
              </select>
            </label>
            {selectedJob && analysisJobId ? (
              <div className="nested-card page-stack dense">
                <strong>{selectedJob.role}</strong>
                <p>{selectedJob.company} · {selectedJob.location}</p>
                <div className="chip-wrap inset">
                  {selectedJob.skills.map((skill) => <span key={skill} className="chip-button static soft">{skill}</span>)}
                </div>
              </div>
            ) : null}
            <label>
              Job description
              <textarea
                className="job-description-area"
                rows={12}
                value={jobDescriptionText}
                onChange={(event) => {
                  setJobDescriptionText(event.target.value)
                  setAnalyzerDraft(event.target.value)
                }}
                placeholder="Paste the full job description here to analyze match score without selecting a saved job result."
              />
            </label>
            <div className="button-row wrap-actions">
              <button className="primary-button" type="button" disabled={busyAction === 'analyze'} onClick={() => analyzeAction(analysisJobId)}>
                <Cpu size={16} />
                Analyze CV match
              </button>
              {automation.tailorCv ? (
                <button className="secondary-button" type="button" disabled={busyAction === 'tailor'} onClick={tailorResumeAction}>
                  <WandSparkles size={16} />
                  Tailor resume
                </button>
              ) : null}
              <button className="secondary-button" type="button" onClick={saveTailoredResumeAction}>Save updated resume</button>
              <button className="secondary-button" type="button" onClick={() => {
                if (tailoredResume.content) {
                  setShowTailoredPreview(true)
                  return
                }
                pushNotice('Tailor a resume before previewing.', 'error')
              }}>Preview tailored CV</button>
              <button className="secondary-button" type="button" onClick={downloadTailoredResumeAction}>
                <Download size={16} />
                Download tailored resume
              </button>
              {analysisJobId ? (
                <button className="secondary-button" type="button" onClick={() => loadTailoredResumeAction(analysisJobId)}>Load saved tailored resume</button>
              ) : null}
            </div>
            {(tailoredResume.content || showTailoredPreview) && tailoredResume.content ? (
              <div className="nested-card">
                <strong>Tailored resume preview {tailoredResume.score ? `(${tailoredResume.score}% match)` : ''}</strong>
                <pre className="code-block" style={{ whiteSpace: 'pre-wrap' }}>{tailoredResume.content}</pre>
              </div>
            ) : null}
          </article>

          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Analysis result</p>
                <h4>{hasAnalyzed ? `${analysisResult.score}% match score${analysisResult.tailoredScore ? ` → ${analysisResult.tailoredScore}% tailored` : ''}` : 'Run analysis to see match insights'}</h4>
              </div>
            </div>
            {!hasAnalyzed ? (
              <div className="analyzer-placeholder">
                <Cpu size={42} />
                <strong>No analysis yet</strong>
                <p>Paste a job description or select a job, then click Analyze CV match.</p>
              </div>
            ) : (
              <>
            <div className="analyzer-summary-tiles">
              <div className="analyzer-summary-tile matched">
                <strong>{analysisResult.hits.length}</strong>
                <span>Matched keywords</span>
              </div>
              <div className="analyzer-summary-tile missed">
                <strong>{analysisResult.misses.length}</strong>
                <span>Missing keywords</span>
              </div>
            </div>
            <div
              className="match-score-circle"
              style={{ '--pct': `${Math.round((analysisResult.score / 100) * 360)}deg` }}
            >
              <div><strong>{analysisResult.score}%</strong><span>match</span></div>
            </div>
            <p className="support-copy">{analysisResult.summary}</p>
            <div className="dual-grid analysis-grid">
              <div className="nested-card">
                <strong>Matched keywords ({analysisResult.hits.length})</strong>
                <div className="chip-wrap inset">
                  {analysisResult.hits.map((hit) => <span key={hit} className="chip-button static success">{hit}</span>)}
                </div>
              </div>
              <div className="nested-card">
                <strong>Missing keywords ({analysisResult.misses.length})</strong>
                <div className="chip-wrap inset">
                  {analysisResult.misses.map((miss) => <span key={miss} className="chip-button static danger">{miss}</span>)}
                </div>
              </div>
            </div>
            {analysisResult.experienceMatch ? (
              <div className="nested-card" style={{ marginTop: 8 }}>
                <strong>Experience match</strong>
                <p style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>{analysisResult.experienceMatch}</p>
              </div>
            ) : null}
            {analysisResult.titleMatch ? (
              <div className="nested-card" style={{ marginTop: 8 }}>
                <strong>Title alignment</strong>
                <p style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>{analysisResult.titleMatch}</p>
              </div>
            ) : null}
            {analysisResult.skillGaps?.length ? (
              <div className="nested-card" style={{ marginTop: 8 }}>
                <strong>Skill gaps</strong>
                <div className="chip-wrap inset">
                  {analysisResult.skillGaps.map((gap) => <span key={gap} className="chip-button static danger">{gap}</span>)}
                </div>
              </div>
            ) : null}
            <div className="section-heading inline-actions" style={{ marginTop: 12 }}>
              <strong>Recommendations</strong>
              <button className="secondary-button btn-sm" type="button" onClick={applyAllSuggestions}>Apply all suggestions</button>
            </div>
            <div className="card-list compact-list">
              {(analysisResult.recommendations ?? analysisResult.suggestions).map((item, idx) => (
                <div key={item} className="list-card">
                  <div>
                    <strong>Suggestion {idx + 1}{appliedSuggestions.includes(item) ? ' ✓' : ''}</strong>
                    <p>{item}</p>
                  </div>
                  <button
                    className="secondary-button btn-sm"
                    type="button"
                    style={{ flexShrink: 0 }}
                    onClick={() => {
                      setAppliedSuggestions((current) => [...current, item])
                      pushNotice(`Suggestion applied: ${item.slice(0, 50)}…`)
                    }}
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
              </>
            )}
          </article>
        </section>
      ) : null}

      {activeTab === 'linkedin' ? (
        <section className="page-stack dense">
          <div className="linkedin-panel-header">
            <div>
              <strong>LinkedIn Job Search</strong>
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.9 }}>Connected account · Easy Apply and filtered discovery</p>
            </div>
            <span className="linkedin-connected-badge">Connected</span>
          </div>
          <article className="glass-card">
            <div className="form-grid linkedin-filter-grid">
              <label>Search LinkedIn roles<input value={linkedinFilters.query} onChange={(event) => setLinkedinFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Role, company, location" /></label>
              <label>Company<input value={linkedinFilters.company} onChange={(event) => setLinkedinFilters((current) => ({ ...current, company: event.target.value }))} placeholder="Filter by company" /></label>
              <label>
                Experience level
                <select value={linkedinFilters.experienceLevel} onChange={(event) => setLinkedinFilters((current) => ({ ...current, experienceLevel: event.target.value }))}>
                  {LINKEDIN_EXPERIENCE_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Sort by
                <select value={linkedinSort} onChange={(event) => setLinkedinSort(event.target.value)}>
                  {LINKEDIN_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Employment type
                <select value={linkedinFilters.employmentType} onChange={(event) => setLinkedinFilters((current) => ({ ...current, employmentType: event.target.value }))}>
                  <option value="all">All types</option>
                  {PROFILE_EMPLOYMENT_OPTIONS.map((type) => (
                    <option key={type} value={type.toLowerCase()}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Date posted
                <select value={linkedinFilters.datePosted} onChange={(event) => setLinkedinFilters((current) => ({ ...current, datePosted: event.target.value }))}>
                  {LINKEDIN_DATE_POSTED.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <div className="toggle-stack">
                <AutomationToggle
                  label="Under 10 applicants"
                  hint="Show only roles with fewer than 10 applicants."
                  enabled={linkedinFilters.under10Applicants}
                  onToggle={() => setLinkedinFilters((current) => ({ ...current, under10Applicants: !current.under10Applicants }))}
                />
                <AutomationToggle
                  label="Easy Apply only"
                  hint="Filter to roles with one-click application."
                  enabled={linkedinFilters.easyApplyOnly}
                  onToggle={() => setLinkedinFilters((current) => ({ ...current, easyApplyOnly: !current.easyApplyOnly }))}
                />
              </div>
              <div className="button-row">
                <button className="primary-button" type="button" disabled={busyAction === 'linkedinSearch'} onClick={runLinkedInSearchAction}>Search LinkedIn</button>
              </div>
            </div>
          </article>
          <section className="card-grid three-up">
            {filteredLinkedin.map((job) => (
              <article key={`${job.role}-${job.company}`} className="glass-card">
                <div className="module-header">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span className="company-avatar">{getCompanyInitials(job.company)}</span>
                    <div>
                    <h4>{job.role}</h4>
                    <p>{job.company}</p>
                    </div>
                  </div>
                  {job.match != null ? <span className="metric-chip">{job.match}%</span> : null}
                </div>
                <div className="chip-wrap inset">
                  {job.type ? <span className="chip-button static">{job.type}</span> : null}
                  <span className="chip-button static">{job.location}</span>
                  {job.posted ? <span className="chip-button static">{job.posted}</span> : null}
                  {job.experienceLevel ? <span className="chip-button static soft">{job.experienceLevel}</span> : null}
                  {job.easyApply ? <span className="chip-button static success">Easy Apply</span> : null}
                </div>
                <p className="support-copy">{job.insight}</p>
                <div className="mini-stats">
                  <span>{job.applicants} applicants</span>
                </div>
                {job.match != null ? (
                  <div className="linkedin-match-bar" aria-hidden="true">
                    <div style={{ width: `${job.match}%` }} />
                  </div>
                ) : null}
                <div className="button-row wrap-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => linkedinApplyAction(job)}
                  >
                    {job.easyApply ? 'Easy Apply' : 'Apply on LinkedIn'}
                  </button>
                  {job.linkedinUrl ? (
                    <a className="secondary-button" href={job.linkedinUrl} target="_blank" rel="noreferrer">Open posting</a>
                  ) : null}
                  <button className="secondary-button" type="button" onClick={() => pushNotice(`${job.role} at ${job.company} saved from LinkedIn.`)}>
                    <Bookmark size={16} />
                    Save
                  </button>
                </div>
              </article>
            ))}
          </section>
        </section>
      ) : null}

      {activeTab === 'tracker' ? (
        <section className="ja-tracker-panel page-stack dense">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Application tracker</p>
              <h4>Monitor applications, interviews, and follow-ups</h4>
            </div>
          </div>

          <section className="ja-tracker-stats hero-grid four-up" aria-label="Tracker summary">
            <article className="metric-tile accent-cobalt">
              <Briefcase size={18} />
              <strong>{applications.stats.applied}</strong>
              <span>Total applied</span>
            </article>
            <article className="metric-tile accent-amber">
              <Search size={18} />
              <strong>{Math.max(applications.stats.applied - applications.stats.interviews - applications.stats.actionNeeded, 0)}</strong>
              <span>Under review</span>
            </article>
            <article className="metric-tile accent-teal">
              <Calendar size={18} />
              <strong>{applications.stats.interviews}</strong>
              <span>Interviews</span>
            </article>
            <article className="metric-tile accent-rose">
              <AlertCircle size={18} />
              <strong>{applications.stats.actionNeeded}</strong>
              <span>Action needed</span>
            </article>
          </section>

          <nav className="ja-tracker-subnav" role="tablist" aria-label="Tracker views">
            {trackerTabConfig.map((tab) => {
              const Icon = tab.icon
              const count =
                tab.key === 'all' ? applications.all.length
                  : tab.key === 'interviews' ? applications.interviews.length
                    : tab.key === 'actionNeeded' ? applications.actionNeeded.length
                      : null

              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={trackerTab === tab.key}
                  className={`ja-tracker-subnav-item${trackerTab === tab.key ? ' active' : ''}`}
                  onClick={() => setTrackerTab(tab.key)}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{tab.label}</span>
                  {count != null ? <span className="ja-tracker-subnav-count">{count}</span> : null}
                </button>
              )
            })}
          </nav>

          {trackerTab === 'stats' ? (
            <article className="glass-card ja-tracker-stats-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Performance metrics</p>
                  <h4>Application statistics</h4>
                </div>
              </div>
              <div className="ja-tracker-stat-grid">
                <article className="ja-tracker-stat-box accent-cobalt">
                  <strong>{applications.stats.responseRate ?? applications.stats.conversion}%</strong>
                  <span>Response rate</span>
                </article>
                <article className="ja-tracker-stat-box accent-teal">
                  <strong>{applications.stats.avgMatchScore ?? avgMatchScore}%</strong>
                  <span>Avg match score</span>
                </article>
                <article className="ja-tracker-stat-box accent-amber">
                  <strong>{applications.stats.avgResponseTime ?? '—'}</strong>
                  <span>Avg response time</span>
                </article>
                <article className="ja-tracker-stat-box accent-violet">
                  <strong className="metric-text">{applications.stats.bestPlatform ?? '—'}</strong>
                  <span>Best platform</span>
                </article>
              </div>
            </article>
          ) : (
            <>
              {trackerTab === 'interviews' ? (
                <div className="ja-tracker-banner success" role="status">
                  <Calendar size={18} aria-hidden="true" />
                  <div>
                    <strong>{applications.interviews.length} upcoming interviews scheduled</strong>
                    <p>Check your email for confirmation links and calendar invites.</p>
                  </div>
                </div>
              ) : null}

              {trackerTab === 'actionNeeded' ? (
                <div className="ja-tracker-banner warning" role="status">
                  <AlertCircle size={18} aria-hidden="true" />
                  <div>
                    <strong>{applications.actionNeeded.length} applications need follow-up</strong>
                    <p>Last activity was more than 5 days ago on some roles — send a follow-up note.</p>
                  </div>
                </div>
              ) : null}

              {trackerTab === 'all' && applications.all.length ? (
                <div className="ja-tracker-inline-stats">
                  <article className="ja-stat-card">
                    <strong>{applications.all.length}</strong>
                    <span>Total tracked</span>
                  </article>
                  <article className="ja-stat-card">
                    <strong>{applications.stats.responseRate ?? applications.stats.conversion}%</strong>
                    <span>Response rate</span>
                  </article>
                </div>
              ) : null}

              {currentTrackerRows.length === 0 ? (
                <article className="glass-card ja-tracker-empty">
                  <FileSearch size={28} aria-hidden="true" />
                  <h4>No applications in this view</h4>
                  <p>Run a job search or apply from Results / LinkedIn to populate your tracker.</p>
                </article>
              ) : (
                <div className="ja-tracker-list">
                  {currentTrackerRows.map((item) => {
                    const statusTone = getTrackerStatusTone(item.status)
                    return (
                      <article
                        key={`${item.role}-${item.company}-${item.updated}`}
                        className="ja-tracker-card glass-card"
                      >
                        <div className="ja-tracker-card-header">
                          <div className="ja-tracker-card-title">
                            <h4>{item.role}</h4>
                            <p>{item.company}</p>
                          </div>
                          <div className="ja-tracker-card-status-block">
                            <span className={`ja-tracker-status ${statusTone}`}>{item.status}</span>
                            <time className="ja-tracker-date">{item.date || item.updated}</time>
                          </div>
                        </div>

                        {item.stage ? <p className="ja-tracker-stage">{item.stage}</p> : null}

                        <div className="ja-tracker-meta">
                          {item.portal ? (
                            <span className="ja-tracker-pill portal">
                              <Globe size={12} aria-hidden="true" />
                              {item.portal}
                            </span>
                          ) : null}
                          {item.match != null ? (
                            <span className="ja-tracker-pill match">
                              <TrendingUp size={12} aria-hidden="true" />
                              {item.match}% match
                            </span>
                          ) : null}
                        </div>

                        <div className="ja-tracker-footer">
                          <div className="ja-tracker-action-copy">
                            <span>Applied {item.date || item.updated}</span>
                            {item.action ? <span>{item.action}</span> : null}
                          </div>
                          <div className="button-row wrap-actions ja-tracker-actions">
                            <button className="secondary-button" type="button" onClick={() => followUpAction(item)}>
                              <MessageSquare size={15} />
                              Follow up
                            </button>
                            <button className="primary-button" type="button" onClick={() => viewPostingAction(item)}>
                              <ExternalLink size={15} />
                              View posting
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>
      ) : null}

      <section className="dual-grid">
        <article className="glass-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Job automation features</p>
              <h4>What you can do</h4>
            </div>
          </div>
          <ul className="check-list">
            <li>Manage your candidate profile with resume upload and AI parsing.</li>
            <li>Configure job search across multiple job boards and portals.</li>
            <li>Add and manage job portal credentials and automation settings.</li>
            <li>View and analyze job matches with automated scoring.</li>
            <li>Analyze your CV against job descriptions for fit scoring.</li>
            <li>Track LinkedIn jobs and application workflow status.</li>
            <li>Monitor applications, interviews, and follow-up actions.</li>
          </ul>
        </article>

        <article className="glass-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Automation best practices</p>
              <h4>Optimize your workflow</h4>
            </div>
          </div>
          <ul className="check-list">
            <li>Keep your resume updated and upload the active version regularly.</li>
            <li>Configure multiple job portals for maximum exposure and applications.</li>
            <li>Review AI-generated CV analysis and update your profile accordingly.</li>
            <li>Set realistic search criteria to avoid low-match applications.</li>
            <li>Track all applications and follow up within 3-5 days.</li>
            <li>Monitor interview pipeline and prepare for upcoming calls.</li>
            <li>Use automation settings to balance speed with quality matches.</li>
          </ul>
        </article>
      </section>
    </div>
  )
}