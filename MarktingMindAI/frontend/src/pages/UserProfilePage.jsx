import { useEffect, useState } from 'react'
import { Bell, Lock, LogOut, Mail, MapPin, Phone, Save, Smartphone } from 'lucide-react'

import {
  changeUserPassword,
  getUserProfile,
  getUserSettings,
  updateUserProfile,
  updateUserSettings,
  logoutUser,
} from '../api/client'

const tabs = [
  { key: 'profile', label: 'Profile', icon: Mail },
  { key: 'settings', label: 'Settings', icon: Smartphone },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'password', label: 'Password', icon: Lock },
]

export function UserProfilePage({ currentUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ tone: 'success', text: '' })
  const [busy, setBusy] = useState(false)

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    company: '',
    title: '',
    department: '',
    location: '',
    timezone: '',
    bio: '',
  })

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Notifications form state
  const [notificationsForm, setNotificationsForm] = useState({
    emailNotifications: true,
    campaignAlerts: true,
    jobAlerts: true,
    dailyReport: false,
    weeklyDigest: true,
  })

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    theme: 'light',
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [profileData, settingsData] = await Promise.all([
          getUserProfile(),
          getUserSettings(),
        ])

        setProfile(profileData.user)
        setSettings(settingsData)

        setProfileForm({
          name: profileData.user.name || '',
          phone: profileData.user.phone || '',
          company: profileData.user.company || '',
          title: profileData.user.title || '',
          department: profileData.user.department || '',
          location: profileData.user.location || '',
          timezone: profileData.user.timezone || '',
          bio: profileData.user.bio || '',
        })

        setNotificationsForm(settingsData.notifications)
        setSettingsForm({
          language: settingsData.language,
          dateFormat: settingsData.dateFormat,
          theme: settingsData.theme,
        })
      } catch (error) {
        pushMessage('Failed to load profile data.', 'error')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const pushMessage = (text, tone = 'success') => {
    setMessage({ text, tone })
    setTimeout(() => setMessage({ tone: 'success', text: '' }), 4000)
  }

  const saveProfile = async () => {
    setBusy(true)
    try {
      await updateUserProfile(profileForm)
      pushMessage('Profile updated successfully.')
    } catch {
      pushMessage('Failed to update profile.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const savePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      pushMessage('New passwords do not match.', 'error')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      pushMessage('Password must be at least 6 characters.', 'error')
      return
    }

    setBusy(true)
    try {
      await changeUserPassword(passwordForm)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      pushMessage('Password changed successfully.')
    } catch {
      pushMessage('Failed to change password.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveSettings = async () => {
    setBusy(true)
    try {
      await updateUserSettings({
        notifications: notificationsForm,
        language: settingsForm.language,
        dateFormat: settingsForm.dateFormat,
        theme: settingsForm.theme,
      })
      pushMessage('Settings updated successfully.')
    } catch {
      pushMessage('Failed to update settings.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logoutUser()
      onLogout()
    }
  }

  if (loading) {
    return (
      <div className="page-stack">
        <section className="hero-panel compact">
          <div>
            <p className="eyebrow">Loading Profile</p>
            <h3>Retrieving your profile data...</h3>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="hero-panel compact">
        <div>
          <div className="profile-header">
            <div className="profile-avatar-large">{profile?.name?.split(' ').map(n => n[0]).join('')}</div>
            <div>
              <h3>{profile?.name}</h3>
              <p className="eyebrow">{profile?.role?.replace('_', ' ').toUpperCase()}</p>
              <p className="hero-copy">{profile?.title} at {profile?.company}</p>
            </div>
          </div>
        </div>
        <div className="stat-row two-up">
          <article className="metric-card"><span>Account Status</span><strong>Active</strong></article>
          <article className="metric-card"><span>Last Login</span><strong>{profile?.lastLogin ? new Date(profile.lastLogin).toLocaleDateString() : 'Never'}</strong></article>
        </div>
      </section>

      {message.text ? <div className={`banner ${message.tone}`}>{message.text}</div> : null}

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

      {activeTab === 'profile' ? (
        <section className="page-stack dense">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Personal Information</p>
                <h4>Manage your profile details</h4>
              </div>
            </div>

            <div className="form-grid two-columns">
              <label>Full Name<input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} /></label>
              <label>Email<input value={profile?.email} disabled /></label>
              <label>Phone<input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></label>
              <label>Company<input value={profileForm.company} onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })} /></label>
              <label>Title<input value={profileForm.title} onChange={(e) => setProfileForm({ ...profileForm, title: e.target.value })} /></label>
              <label>Department<input value={profileForm.department} onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })} /></label>
              <label>Location<input value={profileForm.location} onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })} /></label>
              <label>Timezone<input value={profileForm.timezone} onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })} /></label>
            </div>

            <label>
              Bio
              <textarea value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="Tell us about yourself" rows={4} />
            </label>

            <div className="button-row">
              <button className="primary-button" onClick={saveProfile} disabled={busy}>
                <Save size={16} />
                Save Profile
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <section className="page-stack dense">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Application Settings</p>
                <h4>Customize your experience</h4>
              </div>
            </div>

            <div className="form-grid two-columns">
              <label>
                Language
                <select value={settingsForm.language} onChange={(e) => setSettingsForm({ ...settingsForm, language: e.target.value })}>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
              </label>
              <label>
                Date Format
                <select value={settingsForm.dateFormat} onChange={(e) => setSettingsForm({ ...settingsForm, dateFormat: e.target.value })}>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </label>
              <label>
                Theme
                <select value={settingsForm.theme} onChange={(e) => setSettingsForm({ ...settingsForm, theme: e.target.value })}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </select>
              </label>
            </div>

            <div className="button-row">
              <button className="primary-button" onClick={saveSettings} disabled={busy}>
                <Save size={16} />
                Save Settings
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'notifications' ? (
        <section className="page-stack dense">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Notification Preferences</p>
                <h4>Control how you stay informed</h4>
              </div>
            </div>

            <div className="notification-settings">
              <label className="toggle-row toggle-button">
                <div>
                  <strong>Email Notifications</strong>
                  <p>Receive email notifications for important updates</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsForm.emailNotifications}
                  onChange={(e) => setNotificationsForm({ ...notificationsForm, emailNotifications: e.target.checked })}
                />
              </label>

              <label className="toggle-row toggle-button">
                <div>
                  <strong>Campaign Alerts</strong>
                  <p>Get notified when campaigns are sent or completed</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsForm.campaignAlerts}
                  onChange={(e) => setNotificationsForm({ ...notificationsForm, campaignAlerts: e.target.checked })}
                />
              </label>

              <label className="toggle-row toggle-button">
                <div>
                  <strong>Job Alerts</strong>
                  <p>Notifications about job automation matches</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsForm.jobAlerts}
                  onChange={(e) => setNotificationsForm({ ...notificationsForm, jobAlerts: e.target.checked })}
                />
              </label>

              <label className="toggle-row toggle-button">
                <div>
                  <strong>Daily Report</strong>
                  <p>Receive daily performance reports</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsForm.dailyReport}
                  onChange={(e) => setNotificationsForm({ ...notificationsForm, dailyReport: e.target.checked })}
                />
              </label>

              <label className="toggle-row toggle-button">
                <div>
                  <strong>Weekly Digest</strong>
                  <p>Summary of weekly activities and metrics</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsForm.weeklyDigest}
                  onChange={(e) => setNotificationsForm({ ...notificationsForm, weeklyDigest: e.target.checked })}
                />
              </label>
            </div>

            <div className="button-row">
              <button className="primary-button" onClick={saveSettings} disabled={busy}>
                <Save size={16} />
                Save Preferences
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'password' ? (
        <section className="page-stack dense">
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Security</p>
                <h4>Change your password</h4>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Current Password
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                />
              </label>
              <label>
                New Password
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
              </label>
              <label>
                Confirm Password
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
              </label>
            </div>

            <p className="hint-text">Password must be at least 6 characters long.</p>

            <div className="button-row">
              <button className="primary-button" onClick={savePassword} disabled={busy}>
                <Lock size={16} />
                Change Password
              </button>
            </div>
          </article>

          <article className="glass-card warning-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Session Management</p>
                <h4>Logout and manage your session</h4>
              </div>
            </div>

            <p>You are currently logged in as <strong>{currentUser?.email}</strong>.</p>

            <div className="button-row">
              <button className="secondary-button" onClick={handleLogout}>
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </div>
  )
}
