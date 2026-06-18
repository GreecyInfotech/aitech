import { useState, useEffect, useCallback } from 'react'
import { Check, Linkedin, Mail, Zap, Send, Settings, AlertCircle, Loader, Save, KeyRound } from 'lucide-react'
import {
  loadLinkedInWorkspace,
  runLinkedInDiscovery,
  enrichLinkedInProfiles,
  sendLinkedInOutreach,
  generateLinkedInMessage,
  saveLinkedInSettings,
  saveLinkedInApiKeys
} from '../api/client'

const defaultDiscoveryForm = {
  seniority: 'Any',
  location: 'United States',
  connections: '1st & 2nd degree',
  resultsPerCompany: 20,
}

const defaultApiKeys = {
  apollo: '',
  hunter: '',
  rocketreach: '',
  lusha: '',
}

const LinkedInRecruiterPage = ({ currentUser, onRefresh }) => {
  // ════════════════ WORKSPACE STATE ════════════════
  const [workspace, setWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ════════════════ DISCOVERY STATE ════════════════
  const [activeTab, setActiveTab] = useState('discover')
  const [selectedRecs, setSelectedRecs] = useState(new Set())
  const [filteredRecs, setFilteredRecs] = useState([])
  const [activeCompanies, setActiveCompanies] = useState(new Set())
  const [activeTechs, setActiveTechs] = useState(new Set())
  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  const [discoveryForm, setDiscoveryForm] = useState(defaultDiscoveryForm)

  // ════════════════ PASTE PROFILES STATE ════════════════
  const [pasteUrl, setPasteUrl] = useState('')
  const [enrichLoading, setEnrichLoading] = useState(false)
  const [enrichedProfiles, setEnrichedProfiles] = useState([])

  // ════════════════ OUTREACH STATE ════════════════
  const [selectedForOutreach, setSelectedForOutreach] = useState(new Set())
  const [outreachTemplate, setOutreachTemplate] = useState('default')
  const [outreachLoading, setOutreachLoading] = useState(false)
  const [generatedMessage, setGeneratedMessage] = useState('')
  const [generatedSubject, setGeneratedSubject] = useState('')

  // ════════════════ TABS CONTEXT STATE ════════════════
  const [availableTabs, setAvailableTabs] = useState([])
  const [apiConnected, setApiConnected] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState(null)
  const [apiKeyDraft, setApiKeyDraft] = useState(defaultApiKeys)

  // ════════════════ TOAST STATE ════════════════
  const [toast, setToast] = useState(null)

  // ════════════════ LOAD WORKSPACE DATA ════════════════
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const data = await loadLinkedInWorkspace()
        setWorkspace(data)
        setApiConnected(data?.apiConnected ?? false)

        // ╔══ Dynamic Tab Context ══╗
        // Show tabs based on available data/features
        const tabs = [
          { key: 'discover', label: 'Discover', icon: '🔍' },
          data?.pasteProfilesEnabled !== false && { key: 'paste', label: 'Paste Profiles', icon: '🔗' },
          data?.apiSources?.length > 0 && { key: 'apis', label: 'API Sources', icon: '🔌' },
          data?.outreachEnabled !== false && { key: 'outreach', label: 'AI Outreach', icon: '✉️' },
          data?.sequences?.length > 0 && { key: 'tracker', label: 'Sequence Tracker', icon: '📅' },
          { key: 'settings', label: 'Settings', icon: '⚙️' },
        ].filter(Boolean)

        setAvailableTabs(tabs)

        if (data?.recruiters) {
          setFilteredRecs(data.recruiters)
        }

        if (data?.settings) {
          setSettingsDraft(data.settings)
        }

        setError(null)
      } catch (err) {
        console.error('Failed to load LinkedIn workspace:', err)
        setError(err.message || 'Failed to load workspace data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    if (workspace?.recruiters) {
      setFilteredRecs(workspace.recruiters)
    }
  }, [workspace])

  // ════════════════ HANDLERS ════════════════
  const showNotification = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleToggleRec = (id) => {
    const newSet = new Set(selectedRecs)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedRecs(newSet)
  }

  const handleToggleCompany = (company) => {
    const newSet = new Set(activeCompanies)
    if (newSet.has(company)) newSet.delete(company)
    else newSet.add(company)
    setActiveCompanies(newSet)
  }

  const handleToggleTech = (tech) => {
    const newSet = new Set(activeTechs)
    if (newSet.has(tech)) newSet.delete(tech)
    else newSet.add(tech)
    setActiveTechs(newSet)
  }

  const handleRunDiscovery = async () => {
    if (activeCompanies.size === 0) {
      showNotification('Select at least one target company', 'error')
      return
    }
    if (activeTechs.size === 0) {
      showNotification('Select at least one technology keyword', 'error')
      return
    }

    try {
      setDiscoveryLoading(true)
      showNotification(`Searching ${activeCompanies.size} companies...`, 'info')

      const response = await runLinkedInDiscovery({
        companies: Array.from(activeCompanies),
        technologies: Array.from(activeTechs),
        seniority: discoveryForm.seniority,
        location: discoveryForm.location,
        connections: discoveryForm.connections,
        resultsPerCompany: discoveryForm.resultsPerCompany,
      })

      setFilteredRecs(response.recruiters || [])
      showNotification(`Found ${response.recruiters?.length || 0} matching recruiters!`, 'success')
    } catch (err) {
      console.error('Discovery failed:', err)
      showNotification('Discovery search failed', 'error')
    } finally {
      setDiscoveryLoading(false)
    }
  }

  const handleEnrichProfiles = async () => {
    if (!pasteUrl.trim()) {
      showNotification('Enter profile URL or paste LinkedIn URLs', 'error')
      return
    }

    try {
      setEnrichLoading(true)
      showNotification('Enriching profiles...', 'info')

      const response = await enrichLinkedInProfiles({
        urls: [pasteUrl],
        techContext: Array.from(activeTechs).join(', '),
      })

      setEnrichedProfiles(response.profiles || [])
      showNotification('Profiles enriched successfully!', 'success')
      setPasteUrl('')
    } catch (err) {
      console.error('Enrichment failed:', err)
      showNotification('Profile enrichment failed', 'error')
    } finally {
      setEnrichLoading(false)
    }
  }

  const handleSendOutreach = async () => {
    if (selectedForOutreach.size === 0) {
      showNotification('Select at least one recruiter to contact', 'error')
      return
    }

    try {
      setOutreachLoading(true)
      showNotification('Sending outreach messages...', 'info')

      const response = await sendLinkedInOutreach({
        recruiterIds: Array.from(selectedForOutreach),
        subject: generatedSubject || 'Available Senior Java Developer | C2C | Immediate',
        body: generatedMessage || workspace?.templates?.[0]?.body || 'Hi {{recruiter_name}},\n\nI have a strong Java consultant available immediately for relevant openings.\n\nBest,\n{{candidate_name}}',
        channel: 'LinkedIn Message',
        scheduleAt: null,
      })

      showNotification(`Outreach sent to ${response.count || 0} recruiters!`, 'success')
      setSelectedForOutreach(new Set())
      if (typeof onRefresh === 'function') {
        onRefresh()
      }
    } catch (err) {
      console.error('Outreach failed:', err)
      showNotification('Failed to send outreach', 'error')
    } finally {
      setOutreachLoading(false)
    }
  }

  const handleGenerateMessage = async () => {
    if (selectedForOutreach.size === 0) {
      showNotification('Select recruiter(s) first', 'error')
      return
    }

    try {
      const response = await generateLinkedInMessage({
        prompt: `Generate a professional LinkedIn outreach message to ${selectedForOutreach.size} recruiter(s) about Java/Spring Boot opportunities`,
        messageType: 'cold_outreach',
        tone: 'professional',
        channel: 'LinkedIn Message',
      })

      setGeneratedSubject(response.subject || '')
      setGeneratedMessage(response.body || response.message || '')
      showNotification('Message generated!', 'success')
    } catch (err) {
      console.error('Message generation failed:', err)
      showNotification('Failed to generate message', 'error')
    }
  }

  const handleSaveSettings = async () => {
    if (!settingsDraft) {
      return
    }

    try {
      const response = await saveLinkedInSettings({ settings: settingsDraft })
      showNotification(response.message || 'LinkedIn settings saved.', 'success')
      if (typeof onRefresh === 'function') {
        onRefresh()
      }
    } catch (err) {
      console.error('Settings save failed:', err)
      showNotification('Failed to save LinkedIn settings', 'error')
    }
  }

  const handleSaveApiKeys = async () => {
    try {
      const response = await saveLinkedInApiKeys(apiKeyDraft)
      showNotification(response.message || 'API keys saved.', 'success')
      setApiConnected(Boolean(apiKeyDraft.apollo || apiKeyDraft.hunter || apiKeyDraft.rocketreach || apiKeyDraft.lusha))
      if (typeof onRefresh === 'function') {
        onRefresh()
      }
    } catch (err) {
      console.error('API key save failed:', err)
      showNotification('Failed to save API keys', 'error')
    }
  }

  // ════════════════ STATS CONTEXT ════════════════
  const stats = {
    totalFound: workspace?.stats?.recruitersFound || 0,
    contacted: workspace?.stats?.contacted || 0,
    replied: workspace?.stats?.replied || 0,
    pending: workspace?.stats?.followupsDue || 0,
  }

  const isReadOnly = currentUser?.role === 'user'

  // ════════════════ RENDER ════════════════
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8f9fa' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader size={48} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px', color: '#0066cc' }} />
          <p style={{ color: '#666', fontSize: '14px' }}>Loading LinkedIn Recruiter...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #F7FAFC 0%, #EDF2F7 100%)', minHeight: '100vh', padding: '24px' }}>
      {/* HEADER */}
      <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '2px solid rgba(44, 82, 130, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #2C5282 0%, #1F3A6E 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(44, 82, 130, 0.2)' }}>
            <Linkedin size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: '#1A202C', letterSpacing: '-0.5px' }}>LinkedIn Recruiter Discovery</h1>
            <p style={{ margin: '4px 0 0 0', color: '#718096', fontSize: '13px', fontWeight: '500' }}>
              Discover & engage talent through intelligent recruiter prospecting
            </p>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F7FAFC 100%)', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(31, 58, 110, 0.06)', transition: 'all 0.2s' }}>
          <div style={{ fontSize: '32px', fontWeight: '700', background: 'linear-gradient(135deg, #2C5282 0%, #1F3A6E 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '4px' }}>{stats.totalFound}</div>
          <div style={{ fontSize: '11px', color: '#718096', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Recruiters Found</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F7FAFC 100%)', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(31, 58, 110, 0.06)', transition: 'all 0.2s' }}>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#10B981', marginBottom: '4px' }}>{stats.contacted}</div>
          <div style={{ fontSize: '11px', color: '#718096', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Contacted</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F7FAFC 100%)', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(31, 58, 110, 0.06)', transition: 'all 0.2s' }}>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#7C3AED', marginBottom: '4px' }}>{stats.replied}</div>
          <div style={{ fontSize: '11px', color: '#718096', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Replied</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F7FAFC 100%)', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(31, 58, 110, 0.06)', transition: 'all 0.2s' }}>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#F59E0B', marginBottom: '4px' }}>{stats.pending}</div>
          <div style={{ fontSize: '11px', color: '#718096', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Follow-ups</div>
        </div>
      </div>

      {/* API STATUS */}
      {apiConnected && (
        <div style={{ background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)', border: '1px solid #6EE7B7', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#047857', fontWeight: '500' }}>
          <Check size={18} style={{ flexShrink: 0 }} />
          ✓ Apollo & Hunter APIs Connected Successfully
        </div>
      )}

      {error && (
        <div style={{ background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#991B1B' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* DYNAMIC TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '0', overflowX: 'auto' }}>
        {availableTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: activeTab === tab.key ? 'linear-gradient(135deg, #2C5282 0%, #1F3A6E 100%)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#4A5568',
              fontSize: '13px',
              fontWeight: activeTab === tab.key ? '600' : '500',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* DISCOVER TAB */}
      {activeTab === 'discover' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* FILTERS */}
          <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(31, 58, 110, 0.06)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: '#1A202C', letterSpacing: '-0.3px' }}>Search Filters</h3>

            {/* COMPANIES */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#2C5282', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Target Companies</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {workspace?.companies?.map((company) => (
                  <label key={company} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#4A5568', fontWeight: '500' }}>
                    <input
                      type="checkbox"
                      checked={activeCompanies.has(company)}
                      onChange={() => handleToggleCompany(company)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#00A8A8' }}
                    />
                    {company}
                  </label>
                ))}
              </div>
            </div>

            {/* TECHNOLOGIES */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#2C5282', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Technologies & Skills</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {workspace?.technologies?.map((tech) => (
                  <label key={tech} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#4A5568', fontWeight: '500' }}>
                    <input
                      type="checkbox"
                      checked={activeTechs.has(tech)}
                      onChange={() => handleToggleTech(tech)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#00A8A8' }}
                    />
                    {tech}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#4A5568' }}>
                Seniority
                <select
                  value={discoveryForm.seniority}
                  onChange={(e) => setDiscoveryForm((current) => ({ ...current, seniority: e.target.value }))}
                  style={{ width: '100%', marginTop: '4px', padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: '8px', fontSize: '12px' }}
                >
                  <option value="Any">Any</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead</option>
                </select>
              </label>
              <label style={{ fontSize: '12px', color: '#4A5568' }}>
                Results / company
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={discoveryForm.resultsPerCompany}
                  onChange={(e) => setDiscoveryForm((current) => ({ ...current, resultsPerCompany: Number(e.target.value) || 20 }))}
                  style={{ width: '100%', marginTop: '4px', padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: '8px', fontSize: '12px' }}
                />
              </label>
            </div>

            <label style={{ fontSize: '12px', color: '#4A5568', display: 'block', marginBottom: '10px' }}>
              Location
              <input
                value={discoveryForm.location}
                onChange={(e) => setDiscoveryForm((current) => ({ ...current, location: e.target.value }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: '8px', fontSize: '12px' }}
              />
            </label>

            <label style={{ fontSize: '12px', color: '#4A5568', display: 'block' }}>
              Connection scope
              <select
                value={discoveryForm.connections}
                onChange={(e) => setDiscoveryForm((current) => ({ ...current, connections: e.target.value }))}
                style={{ width: '100%', marginTop: '4px', padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: '8px', fontSize: '12px' }}
              >
                <option value="1st degree">1st degree</option>
                <option value="2nd degree">2nd degree</option>
                <option value="1st & 2nd degree">1st & 2nd degree</option>
                <option value="Any">Any</option>
              </select>
            </label>

            <button
              onClick={handleRunDiscovery}
              disabled={discoveryLoading || activeCompanies.size === 0 || activeTechs.size === 0}
              style={{
                width: '100%',
                marginTop: '18px',
                padding: '12px 16px',
                background: discoveryLoading ? 'rgba(44, 82, 130, 0.6)' : 'linear-gradient(135deg, #2C5282 0%, #1F3A6E 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: discoveryLoading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: discoveryLoading ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(44, 82, 130, 0.25)',
                transition: 'all 0.2s',
                letterSpacing: '0.3px',
              }}
            >
              {discoveryLoading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={16} />}
              {discoveryLoading ? 'Searching...' : 'Run Discovery'}
            </button>
          </div>

          {/* RESULTS */}
          <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(31, 58, 110, 0.06)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: '#1A202C', letterSpacing: '-0.3px' }}>
              Results ({filteredRecs.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredRecs.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#A0AEC0', textAlign: 'center', padding: '40px 20px', fontStyle: 'italic' }}>
                  Select filters and click "Run Discovery" to find recruiters
                </p>
              ) : (
                filteredRecs.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => handleToggleRec(rec.id)}
                    style={{
                      background: selectedRecs.has(rec.id) ? 'linear-gradient(135deg, rgba(0, 168, 168, 0.08) 0%, rgba(0, 212, 212, 0.04) 100%)' : '#F7FAFC',
                      border: selectedRecs.has(rec.id) ? '1.5px solid #00A8A8' : '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: selectedRecs.has(rec.id) ? '0 4px 12px rgba(0, 168, 168, 0.12)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={selectedRecs.has(rec.id)}
                        onChange={() => handleToggleRec(rec.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer', width: '18px', height: '18px', marginTop: '2px', accentColor: '#00A8A8' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A202C', marginBottom: '2px', letterSpacing: '-0.2px' }}>{rec.name}</div>
                        <div style={{ fontSize: '12px', color: '#718096', marginBottom: '2px' }}>{rec.title}</div>
                        <div style={{ fontSize: '11px', color: '#A0AEC0', marginBottom: '4px' }}>{rec.company} • {rec.location}</div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {rec.techs?.slice(0, 3).map((tech, idx) => (
                            <span key={idx} style={{ fontSize: '10px', background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)', color: '#2C5282', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)', color: '#2C5282', padding: '4px 8px', borderRadius: '6px', fontWeight: '600', flexShrink: 0 }}>
                        {rec.match}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PASTE PROFILES TAB */}
      {activeTab === 'paste' && (
        <div style={{ maxWidth: '700px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8ecf1', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1a1a1a' }}>Paste LinkedIn Profile URL</h3>
            <textarea
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/..."
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '7px',
                fontSize: '12px',
                fontFamily: 'inherit',
                minHeight: '100px',
                marginBottom: '12px',
              }}
            />
            <button
              onClick={handleEnrichProfiles}
              disabled={enrichLoading || !pasteUrl.trim()}
              style={{
                padding: '10px 16px',
                background: '#0066cc',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: enrichLoading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {enrichLoading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
              {enrichLoading ? 'Enriching...' : 'Enrich Profiles'}
            </button>
          </div>

          {enrichedProfiles.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e8ecf1', borderRadius: '10px', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1a1a1a' }}>Enriched Profiles</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {enrichedProfiles.map((profile, idx) => (
                  <div key={idx} style={{ background: '#fafbfc', border: '1px solid #e8ecf1', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>{profile.name}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{profile.title}</div>
                    <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>{profile.company}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* API SOURCES TAB */}
      {activeTab === 'apis' && (
        <div style={{ maxWidth: '700px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8ecf1', borderRadius: '10px', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1a1a1a' }}>Connected API Sources</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {workspace?.apiSources?.map((source) => (
                <div key={source.id} style={{ background: '#fafbfc', border: '1px solid #e8ecf1', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a1a1a' }}>{source.name}</div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{source.status}</div>
                  </div>
                  <div style={{ fontSize: '11px', background: source.status === 'connected' ? '#d1fae5' : '#fee2e2', color: source.status === 'connected' ? '#065f46' : '#991b1b', padding: '4px 8px', borderRadius: '4px', fontWeight: '500' }}>
                    {source.status === 'connected' ? '✓ Active' : '✗ Inactive'}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#1A202C' }}>API Keys</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {Object.keys(apiKeyDraft).map((key) => (
                  <label key={key} style={{ fontSize: '12px', color: '#4A5568' }}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                    <input
                      type="password"
                      value={apiKeyDraft[key]}
                      onChange={(e) => setApiKeyDraft((current) => ({ ...current, [key]: e.target.value }))}
                      placeholder={`Enter ${key} API key`}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={handleSaveApiKeys}
                disabled={isReadOnly}
                style={{
                  marginTop: '12px',
                  padding: '10px 16px',
                  background: isReadOnly ? '#94A3B8' : '#1F3A6E',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isReadOnly ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <KeyRound size={14} />
                Save API Keys
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI OUTREACH TAB */}
      {activeTab === 'outreach' && (
        <div style={{ maxWidth: '900px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8ecf1', borderRadius: '10px', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1a1a1a' }}>Select Recruiters</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {filteredRecs.map((rec) => (
                <label key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '6px', cursor: 'pointer', background: selectedForOutreach.has(rec.id) ? '#eff6ff' : 'transparent' }}>
                  <input
                    type="checkbox"
                    checked={selectedForOutreach.has(rec.id)}
                    onChange={() => {
                      const newSet = new Set(selectedForOutreach)
                      if (newSet.has(rec.id)) newSet.delete(rec.id)
                      else newSet.add(rec.id)
                      setSelectedForOutreach(newSet)
                    }}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '12px' }}>{rec.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8ecf1', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1a1a1a' }}>AI Message Generator</h3>
            <button
              onClick={handleGenerateMessage}
              disabled={selectedForOutreach.size === 0}
              style={{
                padding: '10px 16px',
                background: '#0066cc',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: selectedForOutreach.size === 0 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '12px',
              }}
            >
              <Zap size={14} />
              Generate Message
            </button>

            {generatedMessage && (
              <>
                <input
                  readOnly
                  value={generatedSubject}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    marginBottom: '8px',
                    background: '#f9fafb',
                  }}
                />
                <textarea
                  readOnly
                  value={generatedMessage}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    minHeight: '120px',
                    marginBottom: '12px',
                    background: '#f9fafb',
                  }}
                />
              </>
            )}

            <button
              onClick={handleSendOutreach}
              disabled={isReadOnly || outreachLoading || selectedForOutreach.size === 0}
              style={{
                padding: '10px 16px',
                background: isReadOnly ? '#94A3B8' : '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: outreachLoading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                opacity: outreachLoading ? 0.7 : 1,
              }}
            >
              {outreachLoading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
              {outreachLoading ? 'Sending...' : `Send to ${selectedForOutreach.size} Recruiter(s)`}
            </button>
          </div>
        </div>
      )}

      {/* SEQUENCE TRACKER TAB */}
      {activeTab === 'tracker' && (
        <div style={{ maxWidth: '900px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8ecf1', borderRadius: '10px', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1a1a1a' }}>Outreach Sequences</h3>
            {workspace?.sequences && workspace.sequences.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {workspace.sequences.map((seq) => (
                  <div key={seq.id} style={{ background: '#fafbfc', border: '1px solid #e8ecf1', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a1a1a' }}>{seq.name}</div>
                      <div style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                        {seq.steps?.some((step) => step.status === 'replied') ? 'replied' : seq.steps?.some((step) => step.status === 'pending' || step.status === 'scheduled') ? 'active' : 'sent'}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      {seq.steps?.length || 0} steps • {seq.steps?.filter((step) => step.status === 'sent').length || 0} sent • {seq.steps?.filter((step) => step.status === 'replied').length || 0} replies
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#999', textAlign: 'center', padding: '20px 0' }}>
                No sequences yet. Start an outreach campaign to create a sequence.
              </p>
            )}
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div style={{ maxWidth: '700px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8ecf1', borderRadius: '10px', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1a1a1a' }}>LinkedIn Settings</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
              Configure your LinkedIn integration and API preferences
            </p>
            {settingsDraft ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ fontSize: '12px', color: '#4A5568' }}>
                    Account email
                    <input
                      value={settingsDraft.accountEmail}
                      onChange={(e) => setSettingsDraft((current) => ({ ...current, accountEmail: e.target.value }))}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </label>
                  <label style={{ fontSize: '12px', color: '#4A5568' }}>
                    Max per day
                    <input
                      type="number"
                      value={settingsDraft.maxPerDay}
                      onChange={(e) => setSettingsDraft((current) => ({ ...current, maxPerDay: Number(e.target.value) || 0 }))}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </label>
                  <label style={{ fontSize: '12px', color: '#4A5568' }}>
                    Daily connections
                    <input
                      type="number"
                      value={settingsDraft.dailyConnections}
                      onChange={(e) => setSettingsDraft((current) => ({ ...current, dailyConnections: Number(e.target.value) || 0 }))}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </label>
                  <label style={{ fontSize: '12px', color: '#4A5568' }}>
                    Daily InMails
                    <input
                      type="number"
                      value={settingsDraft.dailyInmails}
                      onChange={(e) => setSettingsDraft((current) => ({ ...current, dailyInmails: Number(e.target.value) || 0 }))}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                  {[
                    ['autoRunDaily', 'Auto run daily'],
                    ['autoEnrich', 'Auto enrich'],
                    ['skipContacted', 'Skip contacted'],
                    ['autoFollowup', 'Auto follow-up'],
                    ['aiPersonalize', 'AI personalize'],
                    ['respectDnc', 'Respect DNC'],
                    ['honorUnsubscribes', 'Honor unsubscribes'],
                    ['usePermittedSources', 'Use permitted sources'],
                  ].map(([field, label]) => (
                    <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#4A5568' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(settingsDraft[field])}
                        onChange={(e) => setSettingsDraft((current) => ({ ...current, [field]: e.target.checked }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={isReadOnly}
                  style={{
                    marginTop: '16px',
                    padding: '10px 16px',
                    background: isReadOnly ? '#94A3B8' : '#0066cc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: isReadOnly ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Save size={14} />
                  Save Settings
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px 16px',
            background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#0066cc',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 999,
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          {toast.type === 'success' ? <Check size={14} /> : toast.type === 'error' ? <AlertCircle size={14} /> : <Mail size={14} />}
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default LinkedInRecruiterPage
