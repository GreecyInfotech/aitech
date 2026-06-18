import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  Cpu,
  Download,
  FileSearch,
  Globe,
  Linkedin,
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
  applyToJobs,
  runJobSearch,
  saveJobItem,
  saveJobProfile,
} from '../api/client'
import { isEmail, isHttpUrl, isNonEmpty } from '../utils/validators'

const panelTabs = [
  { key: 'profile', label: 'My Profile', icon: UserCircle2 },
  { key: 'search', label: 'Job Search', icon: Search },
  { key: 'portals', label: 'Portals', icon: Globe },
  { key: 'results', label: 'Results', icon: Briefcase },
  { key: 'analyzer', label: 'CV Analyzer', icon: Cpu },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { key: 'tracker', label: 'Tracker', icon: FileSearch },
]

const trackerTabs = ['all', 'interviews', 'actionNeeded', 'stats']
const presetTitles = ['Java Developer', 'Python Developer', 'Data Engineer', 'Full Stack Developer']
const defaultNotice = { tone: 'success', message: '' }

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
    <button type="button" className="toggle-row toggle-button" onClick={onToggle}>
      <div>
        <strong>{label}</strong>
        <p>{hint}</p>
      </div>
      <span className={`toggle-indicator${enabled ? ' active' : ''}`} />
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
    action: 'Await response',
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
  const [resumeFileName, setResumeFileName] = useState('')
  const [selectedJobs, setSelectedJobs] = useState([])
  const [savedJobs, setSavedJobs] = useState([])
  const [appliedToday, setAppliedToday] = useState(0)
  const [resultsFilter, setResultsFilter] = useState({ query: '', type: 'all', postedWindow: 'all', minScore: 60, sort: 'match', excludeKeywords: [] })
  const [excludeKeywordsDraft, setExcludeKeywordsDraft] = useState('')
  const [analyzerDraft, setAnalyzerDraft] = useState('')
  const [linkedinQuery, setLinkedinQuery] = useState('')
  const [linkedinEasyApplyOnly, setLinkedinEasyApplyOnly] = useState(false)
  const [linkedinRows, setLinkedinRows] = useState([])
  const [notice, setNotice] = useState(defaultNotice)
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
    setAnalyzerDraft(workspace.analysis.summary ?? '')
    setSavedJobs(workspace.savedJobs ?? [])
    setAppliedToday(workspace.stats.appliedToday)
  }, [workspace])

  const deferredResultsFilter = useDeferredValue(resultsFilter)
  const deferredLinkedinQuery = useDeferredValue(linkedinQuery)

  const filteredResults = useMemo(
    () => getFilteredJobs(results, deferredResultsFilter),
    [results, deferredResultsFilter],
  )

  const filteredLinkedin = useMemo(
    () => getLinkedinResults(linkedinRows, deferredLinkedinQuery, linkedinEasyApplyOnly),
    [linkedinRows, deferredLinkedinQuery, linkedinEasyApplyOnly],
  )

  if (!workspace || !profile || !searchConfig || !automation || !applications || !analysisResult) {
    return null
  }

  const selectedJob = results.find((job) => job.id === analysisJobId) ?? results[0]
  const currentTrackerRows =
    trackerTab === 'interviews'
      ? applications.interviews
      : trackerTab === 'actionNeeded'
        ? applications.actionNeeded
        : applications.all

  const pushNotice = (message, tone = 'success') => {
    setNotice({ message, tone })
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
    if (!isNonEmpty(profile.phone, 6)) {
      pushNotice('Phone is required.', 'error')
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

  const addTag = (field, draft) => {
    const normalized = formatTitle(draft.trim())

    if (!normalized) {
      return
    }

    setSearchConfig((current) => {
      const currentItems = current[field] ?? []
      if (currentItems.some((item) => normalizeLabel(item) === normalizeLabel(normalized))) {
        return current
      }

      return { ...current, [field]: [...currentItems, normalized] }
    })
  }

  const removeTag = (field, value) => {
    setSearchConfig((current) => ({
      ...current,
      [field]: current[field].filter((item) => item !== value),
    }))
  }

  const addPresetSearchTitles = () => {
    setSearchConfig((current) => {
      const merged = [...current.titles]

      presetTitles.forEach((title) => {
        if (!merged.some((item) => normalizeLabel(item) === normalizeLabel(title))) {
          merged.push(title)
        }
      })

      return { ...current, titles: merged }
    })
    pushNotice('Preset job titles added to the search builder.')
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
      await saveJobProfile(profile)
      pushNotice('Profile saved successfully.')
    } catch {
      pushNotice('Profile save failed. Check the backend connection.', 'error')
    } finally {
      setBusyAction('')
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

    try {
      const response = await runJobSearch({
        titles: searchConfig.titles,
        requiredSkills: searchConfig.requiredSkills,
        optionalSkills: searchConfig.optionalSkills,
        location: searchConfig.location,
        radius: searchConfig.radius,
        filters: searchConfig.filters,
      })

      startTransition(() => {
        if (response.results?.length) {
          setResults(response.results)
        }
        setActiveTab('results')
      })

      pushNotice(response.message ?? 'Search completed with fresh matches.')
    } catch {
      pushNotice('Search failed. Verify the backend service and retry.', 'error')
    } finally {
      setBusyAction('')
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
      setPortals((current) => [...current, created.portal ?? { ...portalDraft, status: 'Active' }])
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
      setCarriers((current) => [...current, created.carrier ?? carrierDraft])
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

    if (!jobId) {
      pushNotice('Select a job before running CV analysis.', 'error')
      return
    }

    setBusyAction('analyze')

    try {
      const response = await analyzeJob(jobId)
      setAnalysisResult(response.analysis ?? response)
      setAnalysisJobId(jobId)
      const score = (response.analysis ?? response).score
      pushNotice(response.message ?? `CV analysis completed — ${score}% match.`)
    } catch {
      pushNotice('CV analysis failed. Check the backend service.', 'error')
    } finally {
      setBusyAction('')
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

  const removePortal = (indexToRemove) => {
    if (!ensureCanModify('Portal updates')) {
      return
    }
    setPortals((current) => current.filter((_, index) => index !== indexToRemove))
    pushNotice('Portal removed from the local working set.')
  }

  const removeCarrier = (indexToRemove) => {
    if (!ensureCanModify('Carrier updates')) {
      return
    }
    setCarriers((current) => current.filter((_, index) => index !== indexToRemove))
    pushNotice('Carrier removed from the local working set.')
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Job Automation</p>
          <h3>Profile, search, portals, results, analyzer, LinkedIn, and tracker.</h3>
          <p className="hero-copy">Automate job applications across multiple job boards and LinkedIn, with resume optimization and interview tracking.</p>
        </div>
        <div className="hero-grid">
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
        </div>
      </section>

      <div className="tab-strip wrap-tabs">
        {panelTabs.map((tab) => {
          const Icon = tab.icon

          return (
            <button
              key={tab.key}
              type="button"
              className={`tab-button${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {notice.message ? <div className={`banner ${notice.tone}`}>{notice.message}</div> : null}

      {activeTab === 'profile' ? (
        <section className="dual-grid align-start">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Candidate profile</p>
                <h4>Personal details, availability, and resume intake</h4>
              </div>
            </div>
            <div className="form-grid two-columns">
              <label>Full name<input value={profile.name} onChange={(event) => updateProfile('name', event.target.value)} /></label>
              <label>Email<input value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} /></label>
              <label>Phone<input value={profile.phone} onChange={(event) => updateProfile('phone', event.target.value)} /></label>
              <label>Location<input value={profile.location} onChange={(event) => updateProfile('location', event.target.value)} /></label>
              <label>LinkedIn<input value={profile.linkedin} onChange={(event) => updateProfile('linkedin', event.target.value)} /></label>
              <label>Experience<input value={profile.experience} onChange={(event) => updateProfile('experience', event.target.value)} /></label>
              <label>Employment type<input value={profile.employmentType} onChange={(event) => updateProfile('employmentType', event.target.value)} /></label>
              <label>Expected rate<input value={profile.rate} onChange={(event) => updateProfile('rate', event.target.value)} /></label>
              <label>Visa<input value={profile.visa} onChange={(event) => updateProfile('visa', event.target.value)} /></label>
              <label>Work mode<input value={profile.workMode} onChange={(event) => updateProfile('workMode', event.target.value)} /></label>
            </div>
            <div className="attachment-dropzone compact-dropzone">
              <strong>Resume upload / AI parse</strong>
              <span>{resumeFileName || 'Attach the active resume and stage it for parsing.'}</span>
              <div className="button-row">
                <label className="secondary-button file-trigger">
                  <Upload size={16} />
                  Upload resume
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(event) => setResumeFileName(event.target.files?.[0]?.name ?? '')}
                  />
                </label>
                <button className="secondary-button" type="button" onClick={() => pushNotice(`Resume preview opened for ${resumeFileName || 'current draft'}.`)}>Preview</button>
                <button className="secondary-button" type="button" onClick={() => pushNotice('Resume parsing queued for backend processing.')}>Parse with AI</button>
              </div>
            </div>
            <div className="button-row">
              <button className="primary-button" type="button" disabled={busyAction === 'saveProfile'} onClick={saveProfileAction}>Save profile</button>
              <button className="secondary-button" type="button" onClick={() => setActiveTab('search')}>Configure search</button>
            </div>
          </article>

          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Automation</p>
                <h4>Auto-apply settings and scheduling</h4>
              </div>
            </div>
            <AutomationToggle
              label="Auto-apply to matching jobs"
              hint="Run quick apply when the score clears the threshold."
              enabled={automation.autoApply}
              onToggle={() => updateAutomation('autoApply', !automation.autoApply)}
            />
            <label>
              Match threshold
              <input
                type="range"
                min="50"
                max="95"
                value={automation.matchThreshold}
                onChange={(event) => updateAutomation('matchThreshold', Number(event.target.value))}
              />
            </label>
            <label>
              Max applications per day
              <input value={automation.maxApplications} onChange={(event) => updateAutomation('maxApplications', Number(event.target.value))} />
            </label>
            <label>
              Search schedule
              <input value={automation.scheduleLabel} onChange={(event) => updateAutomation('scheduleLabel', event.target.value)} />
            </label>
            <AutomationToggle
              label="Scheduled discovery"
              hint="Run recurring searches through the day."
              enabled={automation.scheduleEnabled}
              onToggle={() => updateAutomation('scheduleEnabled', !automation.scheduleEnabled)}
            />
            <AutomationToggle
              label="Notifications"
              hint="Email and SMS status updates."
              enabled={automation.alerts}
              onToggle={() => updateAutomation('alerts', !automation.alerts)}
            />
            <AutomationToggle
              label="Tailor CV automatically"
              hint="Inject matching language for each high-priority role."
              enabled={automation.tailorCv}
              onToggle={() => updateAutomation('tailorCv', !automation.tailorCv)}
            />
          </article>
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
              <label>Radius<input value={searchConfig.radius} onChange={(event) => updateSearchConfig('radius', event.target.value)} /></label>
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
            <div className="button-row">
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
              <span>{portalUploadName || 'Stage a .xlsx or .csv source for batch ingestion.'}</span>
              <div className="button-row">
                <label className="secondary-button file-trigger">
                  <Upload size={16} />
                  Upload file
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(event) => setPortalUploadName(event.target.files?.[0]?.name ?? '')}
                  />
                </label>
                <button className="secondary-button" type="button" onClick={() => pushNotice(`Portal import staged from ${portalUploadName || 'the selected file'}.`)}>Preview import</button>
              </div>
            </div>
            <div className="card-list compact-list">
              {portals.map((portal, index) => (
                <div key={`${portal.name}-${portal.url}-${index}`} className="list-card list-card-inline">
                  <div>
                    <strong>{portal.name}</strong>
                    <p>{portal.url}</p>
                  </div>
                  <div className="button-row compact-actions">
                    <span className="metric-chip">{portal.status ?? 'Active'}</span>
                    <button className="secondary-button icon-button" type="button" onClick={() => removePortal(index)} aria-label={`Remove ${portal.name}`}>
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
            <div className="card-list compact-list">
              {carriers.map((carrier, index) => (
                <div key={`${carrier.name}-${carrier.url}-${index}`} className="list-card list-card-inline">
                  <div>
                    <strong>{carrier.name}</strong>
                    <p>{carrier.url}</p>
                  </div>
                  <div className="button-row compact-actions">
                    <Building2 size={18} />
                    <button className="secondary-button icon-button" type="button" onClick={() => removeCarrier(index)} aria-label={`Remove ${carrier.name}`}>
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
                <div className="module-header">
                  <div>
                    <h4>{job.role}{job.hot ? <span className="chip-button static hot" style={{ marginLeft: 8, fontSize: 11 }}>🔥 Hot</span> : null}</h4>
                    <p>{job.company} · {job.location}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="metric-chip">{job.match}% match</span>
                    {job.rate ? <p style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginTop: 4 }}>{job.rate}</p> : null}
                  </div>
                </div>
                <div className="chip-wrap inset">
                  <span className="chip-button static">{job.type}</span>
                  <span className="chip-button static">{job.posted}h ago</span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${job.match}%` }} /></div>
                <div className="chip-wrap inset">
                  {job.skills.map((skill) => <span key={skill} className="chip-button static soft">{skill}</span>)}
                </div>
                <div className="button-row wrap-actions">
                  <button className="secondary-button" type="button" onClick={() => toggleJob(job.id)}>{selectedJobs.includes(job.id) ? 'Unselect' : 'Select'}</button>
                  <button className="primary-button" type="button" disabled={busyAction === 'apply'} onClick={() => applyAction([job.id])}>Quick apply</button>
                  <button className="secondary-button" type="button" onClick={() => { setAnalysisJobId(job.id); setActiveTab('analyzer') }}>Analyze</button>
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
              Job selection
              <select value={analysisJobId ?? ''} onChange={(event) => setAnalysisJobId(Number(event.target.value))}>
                {results.map((job) => (
                  <option key={job.id} value={job.id}>{job.role} · {job.company}</option>
                ))}
              </select>
            </label>
            <div className="nested-card page-stack dense">
              <strong>{selectedJob.role}</strong>
              <p>{selectedJob.company} · {selectedJob.location}</p>
              <div className="chip-wrap inset">
                {selectedJob.skills.map((skill) => <span key={skill} className="chip-button static soft">{skill}</span>)}
              </div>
            </div>
            <label>
              Job description notes
              <textarea value={analyzerDraft} onChange={(event) => setAnalyzerDraft(event.target.value)} placeholder="Paste the job description or capture notes before analysis." />
            </label>
            <div className="button-row wrap-actions">
              <button className="primary-button" type="button" disabled={busyAction === 'analyze'} onClick={() => analyzeAction(analysisJobId)}>
                <Cpu size={16} />
                Analyze CV match
              </button>
              <button className="secondary-button" type="button" onClick={() => pushNotice(`${analysisResult.suggestions.length} suggestions applied to CV tailoring queue.`)}>Apply all suggestions</button>
              <button className="secondary-button" type="button" onClick={() => pushNotice(`Tailored CV for ${selectedJob.role} at ${selectedJob.company} prepared for download.`)}>
                <Download size={16} />
                Download tailored
              </button>
            </div>
          </article>

          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Analysis result</p>
                <h4>{analysisResult.score}% match score</h4>
              </div>
            </div>
            <div className="score-ring" style={{ '--score': `${analysisResult.score}%` }}>
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
            <div className="section-heading" style={{ marginTop: 12 }}>
              <strong>AI tailoring suggestions</strong>
            </div>
            <div className="card-list compact-list">
              {analysisResult.suggestions.map((item, idx) => (
                <div key={item} className="list-card">
                  <div>
                    <strong>Suggestion {idx + 1}</strong>
                    <p>{item}</p>
                  </div>
                  <button
                    className="secondary-button btn-sm"
                    type="button"
                    style={{ flexShrink: 0 }}
                    onClick={() => pushNotice(`Suggestion applied: ${item.slice(0, 50)}…`)}
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'linkedin' ? (
        <section className="page-stack dense">
          <article className="glass-card">
            <div className="form-grid linkedin-filter-grid">
              <label>Search LinkedIn roles<input value={linkedinQuery} onChange={(event) => setLinkedinQuery(event.target.value)} placeholder="Role, company, location" /></label>
              <div className="toggle-stack">
                <AutomationToggle
                  label="Easy Apply only"
                  hint="Filter to roles with one-click application."
                  enabled={linkedinEasyApplyOnly}
                  onToggle={() => setLinkedinEasyApplyOnly((current) => !current)}
                />
              </div>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={() => pushNotice('LinkedIn refresh queued for the saved search filters.')}>Refresh feed</button>
                <button className="secondary-button" type="button" onClick={() => pushNotice('LinkedIn filters saved to the working profile.')}>Save filters</button>
              </div>
            </div>
          </article>
          <section className="card-grid three-up">
            {filteredLinkedin.map((job) => (
              <article key={`${job.role}-${job.company}`} className="glass-card">
                <div className="module-header">
                  <div>
                    <h4>{job.role}</h4>
                    <p>{job.company}</p>
                  </div>
                  {job.match != null ? <span className="metric-chip">{job.match}%</span> : null}
                </div>
                <div className="chip-wrap inset">
                  {job.type ? <span className="chip-button static">{job.type}</span> : null}
                  <span className="chip-button static">{job.location}</span>
                  {job.posted ? <span className="chip-button static">{job.posted}</span> : null}
                  {job.easyApply ? <span className="chip-button static success">Easy Apply</span> : null}
                </div>
                <p className="support-copy">{job.insight}</p>
                <div className="mini-stats">
                  <span>{job.applicants} applicants</span>
                </div>
                <div className="button-row wrap-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      setAppliedToday((n) => n + 1)
                      pushNotice(`Applied via LinkedIn: ${job.role} at ${job.company}.`)
                    }}
                  >
                    {job.easyApply ? 'Easy Apply' : 'Apply'}
                  </button>
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
        <section className="page-stack dense">
          <section className="stat-row four-up">
            <article className="metric-card"><span>Total applied</span><strong>{applications.stats.applied}</strong></article>
            <article className="metric-card accent-amber"><span>Under review</span><strong>{applications.stats.applied - applications.stats.interviews - applications.stats.actionNeeded}</strong></article>
            <article className="metric-card accent-teal"><span>Interviews</span><strong>{applications.stats.interviews}</strong></article>
            <article className="metric-card accent-rose"><span>Action needed</span><strong>{applications.stats.actionNeeded}</strong></article>
          </section>
          <div className="tab-strip wrap-tabs">
            {trackerTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`tab-button${trackerTab === tab ? ' active' : ''}`}
                onClick={() => setTrackerTab(tab)}
              >
                {tab === 'actionNeeded' ? 'Action Needed' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {trackerTab === 'stats' ? (
            <section className="stat-row four-up">
              <article className="metric-card"><span>Total applied</span><strong>{applications.stats.applied}</strong></article>
              <article className="metric-card"><span>Interviews</span><strong>{applications.stats.interviews}</strong></article>
              <article className="metric-card"><span>Action needed</span><strong>{applications.stats.actionNeeded}</strong></article>
              <article className="metric-card"><span>Conversion</span><strong>{applications.stats.conversion}%</strong></article>
            </section>
          ) : (
            <div className="card-grid two-up">
              {currentTrackerRows.map((item) => (
                <article key={`${item.role}-${item.company}-${item.updated}`} className="glass-card">
                  <div className="module-header">
                    <div>
                      <h4>{item.role}</h4>
                      <p>{item.company}</p>
                    </div>
                    <span className="metric-chip">{item.status}</span>
                  </div>
                  <p className="support-copy">{item.stage}</p>
                  <div className="mini-stats">
                    <span>Updated {item.updated}</span>
                    <span>{item.action}</span>
                  </div>
                  <div className="button-row wrap-actions">
                    <button className="secondary-button" type="button" onClick={() => pushNotice(`Follow-up reminder created for ${item.company}.`)}>Follow up</button>
                    <button className="primary-button" type="button" onClick={() => pushNotice(`Opening ${item.role} at ${item.company} posting details.`)}>View posting</button>
                  </div>
                </article>
              ))}
            </div>
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