import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CalendarClock,
  Check,
  Copy,
  Eye,
  Mail,
  Plus,
  Send,
  Settings2,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'

import {
  createCampaignList,
  launchCampaign,
  previewCampaign,
  saveCampaignSettings,
  sendCampaignTest,
} from '../api/client'
import { isEmail, isNonEmpty } from '../utils/validators'

const tabs = [
  { key: 'compose', label: 'Compose', icon: Mail },
  { key: 'contacts', label: 'Contacts', icon: Users },
  { key: 'campaigns', label: 'Campaigns', icon: Send },
  { key: 'templates', label: 'Templates', icon: Copy },
  { key: 'settings', label: 'Settings', icon: Settings2 },
]

const promptTemplates = {
  'Hotlist blast': 'Write a concise hotlist email for a Senior Java Developer available on C2C in Dallas with Spring Boot, AWS, and immediate availability.',
  'Candidate intro': 'Write a formal candidate introduction email for a Full Stack React + Java consultant with 6 years of experience.',
  'Follow-up': 'Write a short follow-up email for a profile shared 3 days ago. Keep it polite and action-oriented.',
  'Urgent placement': 'Write an urgent placement email for a DevOps engineer available immediately and open to remote projects.',
  'Bench sales': 'Write a bench sales email listing three available consultants in bullet format with skills and rate.',
  'Re-introduction': 'Write a re-introduction email to reconnect with vendors and share an available Python ML engineer.',
}

function ToggleRow({ label, hint, checked, onToggle }) {
  return (
    <button type="button" className="toggle-row toggle-button" onClick={onToggle}>
      <div>
        <strong>{label}</strong>
        <p>{hint}</p>
      </div>
      <span className={`toggle-indicator${checked ? ' active' : ''}`} />
    </button>
  )
}

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function statusClass(status) {
  const key = status.toLowerCase()

  if (key === 'opened') {
    return 'opened'
  }

  if (key === 'bounced') {
    return 'bounced'
  }

  if (key === 'sent') {
    return 'sent'
  }

  return 'queued'
}

export function CampaignStudioPage({ workspace, currentUser }) {
  const [activeTab, setActiveTab] = useState('compose')
  const [composer, setComposer] = useState(null)
  const [contacts, setContacts] = useState([])
  const [lists, setLists] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [settings, setSettings] = useState(null)
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [selectedContacts, setSelectedContacts] = useState(new Set())
  const [attachments, setAttachments] = useState([])
  const [message, setMessage] = useState({ tone: 'success', text: '' })
  const [previewResult, setPreviewResult] = useState(null)
  const [schedulerOpen, setSchedulerOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiTone, setAiTone] = useState('professional')
  const [aiLength, setAiLength] = useState('medium')
  const [aiBusy, setAiBusy] = useState(false)
  const [contactFilter, setContactFilter] = useState('')
  const [contactListFilter, setContactListFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [campaignSearch, setCampaignSearch] = useState('')
  const [scheduleModel, setScheduleModel] = useState({
    sendDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    sendTime: '09:00',
    sendNow: false,
    openTracking: true,
    autoFollowup: true,
  })
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState('')

  const editorRef = useRef(null)
  const isReadOnly = currentUser?.role === 'user'

  useEffect(() => {
    if (!workspace) {
      return
    }

    setComposer(workspace.composer)
    setContacts(workspace.contacts)
    setLists(workspace.lists)
    setCampaigns(workspace.campaigns)
    setSettings(workspace.settings)
    setActiveTemplate(workspace.templates[0] ?? null)
    setSelectedContacts(new Set(workspace.contacts.slice(0, 2).map((contact) => contact.email)))
    setAiPrompt(promptTemplates[workspace.composer.aiPrompts[0]] ?? '')
  }, [workspace])

  useEffect(() => {
    if (editorRef.current && composer && editorRef.current.innerHTML !== composer.body) {
      editorRef.current.innerHTML = composer.body
    }
  }, [composer])

  const setField = (field, value) => {
    setComposer((current) => ({ ...current, [field]: value }))
  }

  const pushMessage = (text, tone = 'success') => {
    setMessage({ text, tone })
  }

  const ensureCanModify = (actionLabel) => {
    if (!isReadOnly) {
      return true
    }
    pushMessage(`You have view-only access. ${actionLabel} requires admin access.`, 'error')
    return false
  }

  const validateComposerForSend = () => {
    if (!isNonEmpty(composer.campaignName, 3)) {
      pushMessage('Campaign name must be at least 3 characters.', 'error')
      return false
    }

    if (!isEmail(composer.replyTo) || !isEmail(composer.fromEmail)) {
      pushMessage('Reply-to and From email must be valid email addresses.', 'error')
      return false
    }

    if (!isNonEmpty(composer.fromName, 2)) {
      pushMessage('From name is required.', 'error')
      return false
    }

    if (!isNonEmpty(composer.subject, 3)) {
      pushMessage('Subject line must be at least 3 characters.', 'error')
      return false
    }

    if (!isNonEmpty(composer.body, 10)) {
      pushMessage('Email body must be at least 10 characters.', 'error')
      return false
    }

    if (!scheduleModel.sendNow) {
      if (!scheduleModel.sendDate || !scheduleModel.sendTime) {
        pushMessage('Select send date and time or enable send immediately.', 'error')
        return false
      }
    }

    return true
  }

  const execEditorCommand = (command, value = null) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    setField('body', editorRef.current?.innerHTML ?? composer.body)
  }

  const insertMergeTag = (tag) => {
    editorRef.current?.focus()
    document.execCommand('insertText', false, tag)
    setField('body', editorRef.current?.innerHTML ?? composer.body)
  }

  const filteredContacts = useMemo(() => {
    const text = contactFilter.trim().toLowerCase()

    return contacts.filter((contact) => {
      const matchesList = contactListFilter === 'all' || contact.list === contactListFilter
      const haystack = `${contact.name} ${contact.email} ${contact.company}`.toLowerCase()
      const matchesText = !text || haystack.includes(text)
      return matchesList && matchesText
    })
  }, [contacts, contactFilter, contactListFilter])

  const filteredCampaigns = useMemo(() => {
    const text = campaignSearch.trim().toLowerCase()

    return campaigns.filter((campaign) => {
      const matchesStatus = campaignFilter === 'all' || campaign.status.toLowerCase() === campaignFilter
      const matchesText = !text || campaign.name.toLowerCase().includes(text)
      return matchesStatus && matchesText
    })
  }, [campaignFilter, campaignSearch, campaigns])

  const listNames = useMemo(() => ['all', ...new Set(contacts.map((contact) => contact.list))], [contacts])

  if (!workspace || !composer || !settings) {
    return null
  }

  const toggleContact = (email) => {
    setSelectedContacts((current) => {
      const next = new Set(current)
      if (next.has(email)) {
        next.delete(email)
      } else {
        next.add(email)
      }
      return next
    })
  }

  const selectAllVisible = () => {
    setSelectedContacts((current) => {
      const next = new Set(current)
      filteredContacts.forEach((contact) => next.add(contact.email))
      return next
    })
  }

  const clearSelected = () => {
    setSelectedContacts(new Set())
  }

  const handleAttachmentChange = (event) => {
    if (!ensureCanModify('Attachment changes')) {
      event.target.value = ''
      return
    }

    const files = Array.from(event.target.files ?? [])

    if (!files.length) {
      return
    }

    const added = files.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}`,
      name: file.name,
      kb: Math.max(1, Math.round(file.size / 1024)),
    }))

    setAttachments((current) => [...current, ...added])
    pushMessage(`${added.length} attachment(s) added.`)
    event.target.value = ''
  }

  const removeAttachment = (id) => {
    if (!ensureCanModify('Attachment removal')) {
      return
    }
    setAttachments((current) => current.filter((item) => item.id !== id))
  }

  const handleContactsImport = (event) => {
    if (!ensureCanModify('Contact import')) {
      event.target.value = ''
      return
    }

    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const synthetic = [
      {
        name: 'Lisa Park',
        email: 'l.park@vendorco.com',
        company: 'VendorCo',
        status: 'Queued',
        list: 'Imported',
      },
      {
        name: 'Omar Shaikh',
        email: 'o.shaikh@primeplus.com',
        company: 'PrimePlus',
        status: 'Queued',
        list: 'Imported',
      },
    ]

    setContacts((current) => [...synthetic, ...current])
    setSelectedContacts((current) => {
      const next = new Set(current)
      synthetic.forEach((contact) => next.add(contact.email))
      return next
    })
    pushMessage(`Imported contacts from ${file.name}.`)
    event.target.value = ''
  }

  const parsePastedEmails = () => {
    if (!ensureCanModify('Pasted email import')) {
      return
    }

    const value = window.prompt('Paste comma or newline-separated emails')

    if (!value) {
      return
    }

    const emails = value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter((item) => isEmail(item))

    if (!emails.length) {
      pushMessage('No valid emails found in pasted text.', 'error')
      return
    }

    const generated = emails.map((email) => {
      const left = email.split('@')[0]
      const clean = left.replace(/[._-]+/g, ' ')
      const name = clean
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(' ')

      return {
        name: name || left,
        email,
        company: email.split('@')[1],
        status: 'Queued',
        list: 'Pasted',
      }
    })

    setContacts((current) => [...generated, ...current])
    setSelectedContacts((current) => {
      const next = new Set(current)
      generated.forEach((contact) => next.add(contact.email))
      return next
    })
    pushMessage(`${generated.length} email(s) added from pasted input.`)
  }

  const applyPresetPrompt = (presetLabel) => {
    setAiPrompt(promptTemplates[presetLabel] ?? '')
    pushMessage(`${presetLabel} prompt loaded.`)
  }

  const generateAI = () => {
    if (!aiPrompt.trim()) {
      pushMessage('Enter a prompt or choose a quick prompt first.', 'error')
      return
    }

    setAiBusy(true)
    const currentTone = aiTone
    const currentLength = aiLength

    window.setTimeout(() => {
      setAiBusy(false)
      const tonePrefix = currentTone === 'urgent'
        ? 'Urgent'
        : currentTone === 'friendly'
          ? 'Friendly'
          : 'Professional'

      const summary = currentLength === 'short' ? '2-3 lines' : currentLength === 'long' ? 'detailed format' : 'balanced format'

      const generatedBody = `
        <p>Hi {{recruiter_name}},</p>
        <p>${tonePrefix} outreach draft generated from your prompt in ${summary}.</p>
        <p><strong>Candidate:</strong> {{candidate_name}}<br/>
        <strong>Skills:</strong> {{skills}}<br/>
        <strong>Location:</strong> {{location}}<br/>
        <strong>Rate:</strong> {{rate}}</p>
        <p>Let me know if you have a matching role and I can share full details right away.</p>
        <p>Regards,<br/>{{recruiter_name}}<br/>{{company_name}}</p>
      `.trim()

      setField('body', generatedBody)
      if (editorRef.current) {
        editorRef.current.innerHTML = generatedBody
      }
      pushMessage('AI draft generated and inserted into composer.', 'success')
    }, 1500)
  }

  const improveDraft = () => {
    if (!composer.body.trim()) {
      pushMessage('No draft body available to improve.', 'error')
      return
    }

    const improved = `${composer.body}<p><em>PS: Happy to share references and schedule interviews this week.</em></p>`
    setField('body', improved)
    if (editorRef.current) {
      editorRef.current.innerHTML = improved
    }
    pushMessage('Draft improved with stronger CTA and close.', 'success')
  }

  const translateDraft = () => {
    const language = window.prompt('Translate to language', 'Spanish')
    if (!language) {
      return
    }
    pushMessage(`Translation to ${language} queued in test mode.`)
  }

  const previewEmail = async () => {
    if (!validateComposerForSend()) {
      return
    }

    setActionBusy('preview')
    try {
      const response = await previewCampaign({
        subject: composer.subject,
        body: composer.body,
        recipients: Array.from(selectedContacts),
      })
      setPreviewResult(response)
      pushMessage('Preview generated from backend endpoint.')
    } catch {
      pushMessage('Preview request failed. Verify backend availability.', 'error')
    } finally {
      setActionBusy('')
    }
  }

  const sendTestEmail = async () => {
    if (!ensureCanModify('Test send')) {
      return
    }

    if (!validateComposerForSend()) {
      return
    }

    const email = window.prompt('Send test email to', composer.replyTo)

    if (!email) {
      return
    }

    if (!isEmail(email)) {
      pushMessage('Enter a valid test email address.', 'error')
      return
    }

    setActionBusy('test')
    try {
      const response = await sendCampaignTest({
        email,
        subject: composer.subject,
        body: composer.body,
      })
      pushMessage(response.message)
    } catch {
      pushMessage('Test send failed. Verify backend availability.', 'error')
    } finally {
      setActionBusy('')
    }
  }

  const saveDraft = () => {
    if (!ensureCanModify('Save draft')) {
      return
    }

    if (!validateComposerForSend()) {
      return
    }

    pushMessage(`Campaign "${composer.campaignName}" saved as local draft.`)
  }

  const launchCampaignAction = async () => {
    if (!ensureCanModify('Campaign launch')) {
      return
    }

    if (!validateComposerForSend()) {
      return
    }

    const recipients = Array.from(selectedContacts)

    if (!recipients.length) {
      pushMessage('Select at least one recipient before launch.', 'error')
      return
    }

    setActionBusy('launch')

    try {
      const scheduledFor = `${scheduleModel.sendDate} ${scheduleModel.sendTime}`
      const response = await launchCampaign({
        campaignName: composer.campaignName,
        subject: composer.subject,
        body: composer.body,
        recipients,
        scheduledFor,
        sendNow: scheduleModel.sendNow,
      })

      const sentCount = recipients.length
      const estimatedOpened = Math.max(0, Math.round(sentCount * 0.38))
      const estimatedReplied = Math.max(0, Math.round(sentCount * 0.12))
      const fresh = {
        name: composer.campaignName,
        sent: sentCount,
        opened: estimatedOpened,
        replied: estimatedReplied,
        status: scheduleModel.sendNow ? 'Sent' : 'Scheduled',
        scheduledFor,
      }

      setCampaigns((current) => [fresh, ...current])
      setSchedulerOpen(false)
      pushMessage(response.message)
    } catch {
      pushMessage('Launch failed. Verify backend availability.', 'error')
    } finally {
      setActionBusy('')
    }
  }

  const createList = async () => {
    if (!ensureCanModify('List creation')) {
      return
    }

    const name = window.prompt('New list name', 'New Contact List')

    if (!name?.trim()) {
      return
    }

    if (!isNonEmpty(name, 2)) {
      pushMessage('List name must be at least 2 characters.', 'error')
      return
    }

    setActionBusy('newList')
    try {
      const response = await createCampaignList(name.trim())
      setLists((current) => [response, ...current])
      pushMessage(`List "${response.name}" created.`)
    } catch {
      pushMessage('Create list failed. Verify backend availability.', 'error')
    } finally {
      setActionBusy('')
    }
  }

  const useTemplate = (template) => {
    setActiveTemplate(template)
    setComposer((current) => ({
      ...current,
      subject: template.subject,
      body: template.body,
    }))
    if (editorRef.current) {
      editorRef.current.innerHTML = template.body
    }
    setActiveTab('compose')
    pushMessage(`Template "${template.name}" loaded into composer.`)
  }

  const saveSettingsAction = async () => {
    if (!ensureCanModify('Settings updates')) {
      return
    }

    if (!isNonEmpty(settings.smtpHost, 3)) {
      pushMessage('SMTP host is required.', 'error')
      return
    }

    if (!Number.isFinite(settings.smtpPort) || settings.smtpPort < 1 || settings.smtpPort > 65535) {
      pushMessage('SMTP port must be between 1 and 65535.', 'error')
      return
    }

    if (!Number.isFinite(settings.senderLimit) || settings.senderLimit < 1) {
      pushMessage('Daily send limit must be at least 1.', 'error')
      return
    }

    setSettingsBusy(true)
    try {
      const response = await saveCampaignSettings(settings)
      pushMessage(response.message)
    } catch {
      pushMessage('Settings save failed. Verify backend availability.', 'error')
    } finally {
      setSettingsBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Campaign Studio</p>
          <h3>Complete campaign operations with compose, contacts, templates, scheduling, and launch APIs.</h3>
          <p className="hero-copy">Mass email drafting, templates, contact lists, scheduling, and compliance for staffing campaigns.</p>
        </div>
        <div className="hero-grid">
          <div className="metric-tile accent-amber">
            <Mail size={18} />
            <strong>{workspace.metrics.emailsSent.toLocaleString()}</strong>
            <span>Emails sent</span>
          </div>
          <div className="metric-tile accent-teal">
            <TrendingUp size={18} />
            <strong>{workspace.metrics.openRate}%</strong>
            <span>Open rate</span>
          </div>
          <div className="metric-tile accent-cobalt">
            <Send size={18} />
            <strong>{workspace.metrics.replyRate}%</strong>
            <span>Reply rate</span>
          </div>
        </div>
      </section>

      <div className="tab-strip wrap-tabs">
        {tabs.map((tab) => {
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

      {message.text ? <div className={`banner ${message.tone}`}>{message.text}</div> : null}

      {activeTab === 'compose' ? (
        <section className="dual-grid align-start">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Email composer</p>
                <h4>Campaign details and rich body editor</h4>
              </div>
            </div>

            <div className="form-grid two-columns">
              <label>Campaign name<input value={composer.campaignName} onChange={(event) => setField('campaignName', event.target.value)} /></label>
              <label>Reply-to<input value={composer.replyTo} onChange={(event) => setField('replyTo', event.target.value)} /></label>
              <label>From name<input value={composer.fromName} onChange={(event) => setField('fromName', event.target.value)} /></label>
              <label>From email<input value={composer.fromEmail} onChange={(event) => setField('fromEmail', event.target.value)} /></label>
            </div>

            <label>
              Subject line
              <div className="inline-form-row">
                <input value={composer.subject} onChange={(event) => setField('subject', event.target.value)} />
                <button className="secondary-button" type="button" onClick={() => setField('subject', `🔥 ${composer.subject}`)}>
                  <Sparkles size={16} />
                </button>
              </div>
            </label>

            <div>
              <label>Merge tags</label>
              <div className="chip-wrap inset">
                {composer.mergeTags.map((tag) => (
                  <button key={tag} type="button" className="chip-button" onClick={() => insertMergeTag(tag)}>{tag}</button>
                ))}
              </div>
            </div>

            <div className="page-stack dense">
              <label>Email body</label>
              <div className="editor-toolbar">
                <button className="tb-btn" type="button" onClick={() => execEditorCommand('bold')}>B</button>
                <button className="tb-btn" type="button" onClick={() => execEditorCommand('italic')}><em>I</em></button>
                <button className="tb-btn" type="button" onClick={() => execEditorCommand('underline')}><u>U</u></button>
                <button className="tb-btn" type="button" onClick={() => execEditorCommand('insertUnorderedList')}>• List</button>
                <button className="tb-btn" type="button" onClick={() => execEditorCommand('insertOrderedList')}>1. List</button>
                <button className="tb-btn" type="button" onClick={() => {
                  const url = window.prompt('Enter URL', 'https://')
                  if (url) {
                    execEditorCommand('createLink', url)
                  }
                }}>Link</button>
                <button className="tb-btn" type="button" onClick={() => execEditorCommand('insertHorizontalRule')}>Rule</button>
              </div>
              <div
                ref={editorRef}
                className="rich-area"
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => setField('body', event.currentTarget.innerHTML)}
              />
            </div>

            <div className="attachment-dropzone compact-dropzone">
              <strong>Attachments</strong>
              <span>Attach hotlist, resume, or supporting files for this campaign.</span>
              <label className="secondary-button file-trigger">
                Add files
                <input type="file" multiple onChange={handleAttachmentChange} />
              </label>
              <div className="card-list compact-list">
                {attachments.map((item) => (
                  <div key={item.id} className="file-item-react">
                    <span>{item.name}</span>
                    <span>{item.kb} KB</span>
                    <button className="secondary-button" type="button" onClick={() => removeAttachment(item.id)}>Remove</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="button-row wrap-actions">
              <button className="secondary-button" type="button" disabled={actionBusy === 'preview'} onClick={previewEmail}>
                <Eye size={16} />
                Preview
              </button>
              <button className="secondary-button" type="button" disabled={actionBusy === 'test'} onClick={sendTestEmail}>
                <Send size={16} />
                Send test
              </button>
              <button className="secondary-button" type="button" onClick={saveDraft}>Save draft</button>
              <button className="primary-button" type="button" onClick={() => setSchedulerOpen((current) => !current)}>
                <CalendarClock size={16} />
                Schedule / send
              </button>
            </div>

            {schedulerOpen ? (
              <div className="nested-card">
                <div className="section-heading small-gap">
                  <div>
                    <p className="eyebrow">Schedule & send</p>
                    <h4>Launch controls</h4>
                  </div>
                </div>
                <div className="form-grid two-columns compact-gap">
                  <label>Send date<input type="date" value={scheduleModel.sendDate} onChange={(event) => setScheduleModel((current) => ({ ...current, sendDate: event.target.value }))} /></label>
                  <label>Send time<input type="time" value={scheduleModel.sendTime} onChange={(event) => setScheduleModel((current) => ({ ...current, sendTime: event.target.value }))} /></label>
                </div>
                <ToggleRow
                  label="Send immediately"
                  hint="Ignore schedule and send now."
                  checked={scheduleModel.sendNow}
                  onToggle={() => setScheduleModel((current) => ({ ...current, sendNow: !current.sendNow }))}
                />
                <ToggleRow
                  label="Track opens and clicks"
                  hint="Enable engagement tracking for analytics."
                  checked={scheduleModel.openTracking}
                  onToggle={() => setScheduleModel((current) => ({ ...current, openTracking: !current.openTracking }))}
                />
                <ToggleRow
                  label="Auto follow-up"
                  hint="Schedule follow-up for non-replies."
                  checked={scheduleModel.autoFollowup}
                  onToggle={() => setScheduleModel((current) => ({ ...current, autoFollowup: !current.autoFollowup }))}
                />
                <div className="button-row">
                  <button className="primary-button" type="button" disabled={actionBusy === 'launch'} onClick={launchCampaignAction}>
                    <Check size={16} />
                    Launch campaign
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          <div className="page-stack dense">
            <article className="glass-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">AI drafter</p>
                  <h4>Prompt-based campaign drafting</h4>
                </div>
                <Sparkles size={18} />
              </div>
              <div className="chip-wrap inset">
                {composer.aiPrompts.map((prompt) => (
                  <button key={prompt} type="button" className="chip-button soft" onClick={() => applyPresetPrompt(prompt)}>{prompt}</button>
                ))}
              </div>
              <label>Prompt brief<textarea rows={4} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} /></label>
              <div className="form-grid two-columns compact-gap">
                <label>
                  Tone
                  <select value={aiTone} onChange={(event) => setAiTone(event.target.value)}>
                    <option value="professional">Professional</option>
                    <option value="concise">Concise</option>
                    <option value="friendly">Friendly</option>
                    <option value="urgent">Urgent</option>
                    <option value="formal">Formal</option>
                  </select>
                </label>
                <label>
                  Length
                  <select value={aiLength} onChange={(event) => setAiLength(event.target.value)}>
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </label>
              </div>
              <div className="button-row wrap-actions">
                <button className="primary-button" type="button" disabled={aiBusy} onClick={generateAI}>
                  <Sparkles size={16} />
                  {aiBusy ? 'Generating...' : 'Generate with AI'}
                </button>
                <button className="secondary-button" type="button" onClick={improveDraft}>Improve existing</button>
                <button className="secondary-button" type="button" onClick={translateDraft}>Translate</button>
              </div>
            </article>

            <article className="glass-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Recipients</p>
                  <h4>{selectedContacts.size} selected contacts</h4>
                </div>
              </div>
              <div className="form-grid two-columns compact-gap">
                <label>
                  Contact list
                  <select value={contactListFilter} onChange={(event) => setContactListFilter(event.target.value)}>
                    {listNames.map((name) => <option key={name} value={name}>{name === 'all' ? 'All Contacts' : name}</option>)}
                  </select>
                </label>
                <label>
                  Search
                  <input value={contactFilter} onChange={(event) => setContactFilter(event.target.value)} placeholder="Name, company, email" />
                </label>
              </div>
              <div className="button-row wrap-actions">
                <button className="secondary-button" type="button" onClick={selectAllVisible}>Select all</button>
                <button className="secondary-button" type="button" onClick={clearSelected}>Clear</button>
              </div>
              <div className="selection-list">
                {filteredContacts.map((contact) => (
                  <label key={contact.email} className="selection-row">
                    <input type="checkbox" checked={selectedContacts.has(contact.email)} onChange={() => toggleContact(contact.email)} />
                    <div className="contact-avatar-react">{initials(contact.name)}</div>
                    <div>
                      <strong>{contact.name}</strong>
                      <p>{contact.company} · {contact.email}</p>
                    </div>
                    <span className={`tiny-pill ${statusClass(contact.status)}`}>{contact.status}</span>
                  </label>
                ))}
              </div>

              <div className="attachment-dropzone compact-dropzone">
                <strong>Import contacts from Excel</strong>
                <span>Parses incoming sheet in test mode and appends contacts to local state.</span>
                <label className="secondary-button file-trigger">
                  Import file
                  <input type="file" accept=".xls,.xlsx,.csv" onChange={handleContactsImport} />
                </label>
                <button className="secondary-button" type="button" onClick={parsePastedEmails}>Add from pasted emails</button>
              </div>
            </article>

            {previewResult ? (
              <article className="glass-card preview-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Preview</p>
                    <h4>{previewResult.subject}</h4>
                  </div>
                </div>
                <p className="support-copy">Recipients in preview: {previewResult.recipientCount}</p>
                <div className="preview-body" dangerouslySetInnerHTML={{ __html: previewResult.previewHtml }} />
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'contacts' ? (
        <section className="dual-grid align-start">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Contact lists</p>
                <h4>List inventory and import paths</h4>
              </div>
              <button className="primary-button" type="button" disabled={actionBusy === 'newList'} onClick={createList}>
                <Plus size={16} />
                New list
              </button>
            </div>
            <div className="card-list compact-list">
              {lists.map((list) => (
                <div key={list.name} className="list-card">
                  <div>
                    <strong>{list.name}</strong>
                    <p>{list.contacts} contacts</p>
                  </div>
                  <div className="list-metrics">
                    <span>{list.openRate}% open</span>
                    <span>{list.replyRate}% reply</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Directory</p>
                <h4>All campaign contacts</h4>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Company</th>
                    <th>List</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.email}>
                      <td>{contact.name}</td>
                      <td>{contact.email}</td>
                      <td>{contact.company}</td>
                      <td>{contact.list}</td>
                      <td>{contact.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'campaigns' ? (
        <section className="page-stack dense">
          <article className="glass-card">
            <div className="form-grid campaign-filter-grid">
              <label>
                Status
                <select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)}>
                  <option value="all">All Campaigns</option>
                  <option value="sent">Sent</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="draft">Draft</option>
                </select>
              </label>
              <label>
                Search campaigns
                <input value={campaignSearch} onChange={(event) => setCampaignSearch(event.target.value)} placeholder="Campaign name" />
              </label>
              <div className="button-row">
                <button className="primary-button" type="button" onClick={() => setActiveTab('compose')}>
                  <Plus size={16} />
                  New campaign
                </button>
              </div>
            </div>
          </article>
          <section className="card-grid three-up">
            {filteredCampaigns.map((campaign) => {
              const progress = campaign.sent > 0 ? Math.min(100, Math.round((campaign.opened / campaign.sent) * 100)) : 0
              return (
                <article key={`${campaign.name}-${campaign.scheduledFor}`} className="glass-card campaign-card">
                  <div className="module-header">
                    <div>
                      <h4>{campaign.name}</h4>
                      <p>{campaign.status} · {campaign.scheduledFor}</p>
                    </div>
                    <span className="metric-chip">{campaign.sent} sent</span>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                  <div className="mini-stats">
                    <span>{campaign.opened} opens</span>
                    <span>{campaign.replied} replies</span>
                  </div>
                  <div className="button-row wrap-actions">
                    <button className="secondary-button" type="button" onClick={() => pushMessage(`Viewing campaign "${campaign.name}".`)}>View</button>
                    <button className="secondary-button" type="button" onClick={() => pushMessage(`Duplicated campaign "${campaign.name}".`)}>Duplicate</button>
                    <button className="primary-button" type="button" onClick={() => pushMessage(`Analytics loaded for "${campaign.name}".`)}>Analytics</button>
                  </div>
                </article>
              )
            })}
          </section>
        </section>
      ) : null}

      {activeTab === 'templates' ? (
        <section className="dual-grid align-start">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Template library</p>
                <h4>Preview and apply templates</h4>
              </div>
            </div>
            <div className="card-list compact-list">
              {workspace.templates.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  className={`list-card selectable${activeTemplate?.name === template.name ? ' selected' : ''}`}
                  onClick={() => setActiveTemplate(template)}
                >
                  <div>
                    <strong>{template.name}</strong>
                    <p>{template.category}</p>
                  </div>
                  <span className="metric-chip">Preview</span>
                </button>
              ))}
            </div>
          </article>
          <article className="glass-card preview-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Template preview</p>
                <h4>{activeTemplate?.subject ?? 'Select a template'}</h4>
              </div>
              {activeTemplate ? <button className="primary-button" type="button" onClick={() => useTemplate(activeTemplate)}>Use template</button> : null}
            </div>
            <div className="preview-body" dangerouslySetInnerHTML={{ __html: activeTemplate?.body ?? '' }} />
          </article>
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <section className="dual-grid align-start">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SMTP configuration</p>
                <h4>Delivery and safety settings</h4>
              </div>
              <Shield size={18} />
            </div>
            <div className="form-grid two-columns">
              <label>SMTP host<input value={settings.smtpHost} onChange={(event) => setSettings((current) => ({ ...current, smtpHost: event.target.value }))} /></label>
              <label>SMTP port<input type="number" value={settings.smtpPort} onChange={(event) => setSettings((current) => ({ ...current, smtpPort: Number(event.target.value) }))} /></label>
              <label>Daily send limit<input type="number" value={settings.senderLimit} onChange={(event) => setSettings((current) => ({ ...current, senderLimit: Number(event.target.value) }))} /></label>
              <label>Environment<input value="production-ready seed mode" readOnly /></label>
            </div>
            <div className="button-row wrap-actions">
              <button className="secondary-button" type="button" onClick={() => pushMessage('SMTP test executed in simulated mode.')}>Test connection</button>
              <button className="primary-button" type="button" disabled={settingsBusy} onClick={saveSettingsAction}>{settingsBusy ? 'Saving...' : 'Save settings'}</button>
            </div>
          </article>
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Integrations</p>
                <h4>Compliance and AI policy toggles</h4>
              </div>
            </div>
            <ToggleRow label="Gmail sync" hint="Mirror campaign activities in Gmail." checked={settings.gmailSync} onToggle={() => setSettings((current) => ({ ...current, gmailSync: !current.gmailSync }))} />
            <ToggleRow label="Outlook sync" hint="Mirror campaign activities in Outlook." checked={settings.outlookSync} onToggle={() => setSettings((current) => ({ ...current, outlookSync: !current.outlookSync }))} />
            <ToggleRow label="Spam guard" hint="Protect deliverability with pacing controls." checked={settings.spamGuard} onToggle={() => setSettings((current) => ({ ...current, spamGuard: !current.spamGuard }))} />
            <ToggleRow label="Open tracking" hint="Track opens and clicks." checked={settings.openTracking} onToggle={() => setSettings((current) => ({ ...current, openTracking: !current.openTracking }))} />
            <ToggleRow label="Unsubscribe footer" hint="Auto-append compliance footer." checked={settings.unsubscribeFooter} onToggle={() => setSettings((current) => ({ ...current, unsubscribeFooter: !current.unsubscribeFooter }))} />
            <ToggleRow label="AI subject assist" hint="Suggest high-performing subject lines." checked={settings.aiSubjectAssist} onToggle={() => setSettings((current) => ({ ...current, aiSubjectAssist: !current.aiSubjectAssist }))} />
          </article>
        </section>
      ) : null}

      <section className="dual-grid">
        <article className="glass-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Campaign features</p>
              <h4>What you can do</h4>
            </div>
          </div>
          <ul className="check-list">
            <li>Design rich HTML emails with merge tags and formatting.</li>
            <li>Import contact lists and segment by company, status, or role.</li>
            <li>Select from templates or create custom email templates.</li>
            <li>Schedule campaigns for future delivery or send immediately.</li>
            <li>Track opens, clicks, and replies in real-time.</li>
            <li>Manage SMTP settings, compliance, and email integrations.</li>
          </ul>
        </article>

        <article className="glass-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Best practices</p>
              <h4>Campaign optimization</h4>
            </div>
          </div>
          <ul className="check-list">
            <li>Test subject lines with A/B send splits for higher open rates.</li>
            <li>Use merge tags to personalize each email with candidate/company names.</li>
            <li>Start with a warmup period to establish sender reputation.</li>
            <li>Monitor bounce rates and remove invalid addresses promptly.</li>
            <li>Schedule sends during business hours for better engagement.</li>
            <li>Follow up with non-responders after 3-5 days.</li>
          </ul>
        </article>
      </section>
    </div>
  )
}