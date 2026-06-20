import { lazy, Suspense, startTransition, useCallback, useEffect, useState } from 'react'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { Route, Routes } from 'react-router-dom'

import {
  clearStoredAuth,
  getCurrentSession,
  getStoredAuth,
  loadWorkspaceData,
  logoutUser,
  setStoredAuth,
} from './api/client'
import { AuthPanel } from './components/AuthPanel'
import { AppShell } from './components/AppShell'

const OverviewPage = lazy(() => import('./pages/OverviewPage').then((module) => ({ default: module.OverviewPage })))
const CampaignStudioPage = lazy(() => import('./pages/CampaignStudioPage').then((module) => ({ default: module.CampaignStudioPage })))
const JobAutomationPage = lazy(() => import('./pages/JobAutomationPage').then((module) => ({ default: module.JobAutomationPage })))
const DayReportPage = lazy(() => import('./pages/DayReportPage').then((module) => ({ default: module.DayReportPage })))
const SubmissionProgressPage = lazy(() => import('./pages/SubmissionProgressPage').then((module) => ({ default: module.SubmissionProgressPage })))
const ApiExplorerPage = lazy(() => import('./pages/ApiExplorerPage').then((module) => ({ default: module.ApiExplorerPage })))
const LinkedInRecruiterPage = lazy(() => import('./pages/LinkedInRecruiterPage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then((module) => ({ default: module.UserProfilePage })))

function LoadingState({ title, description }) {
  return (
    <div className="empty-state" role="status" aria-live="polite" aria-busy="true">
      <LoaderCircle size={20} className="spin" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  )
}

function App() {
  const [auth, setAuth] = useState(() => getStoredAuth())
  const [workspace, setWorkspace] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const token = auth?.token

  const clearSession = useCallback((message = '') => {
    clearStoredAuth()
    setAuth(null)
    setWorkspace(null)
    setError(message)
  }, [])

  const refreshWorkspace = useCallback(async () => {
    if (!token) {
      setLoading(false)
      setWorkspace(null)
      return
    }

    setRefreshing(true)
    setError('')

    try {
      const data = await loadWorkspaceData()
      startTransition(() => {
        setWorkspace(data)
      })
    } catch (fetchError) {
      if (fetchError?.response?.status === 401) {
        clearSession('Session expired. Please login again.')
        return
      }

      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load workspace data.',
      )
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [clearSession, token])

  useEffect(() => {
    const hydrateSession = async () => {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const session = await getCurrentSession()
        setAuth((previousAuth) => {
          if (
            previousAuth?.token === session.token
            && previousAuth?.user?.id === session.user.id
            && previousAuth?.user?.role === session.user.role
          ) {
            return previousAuth
          }
          return session
        })
        setStoredAuth(session)
        await refreshWorkspace()
      } catch {
        clearSession('Session expired. Please login again.')
        setLoading(false)
      }
    }

    hydrateSession()
  }, [token, clearSession, refreshWorkspace])

  const handleAuthenticated = useCallback(async (authPayload) => {
    setStoredAuth(authPayload)
    setAuth(authPayload)
    setLoading(true)
    setError('')
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser()
    } catch {
      // Clear local session regardless of backend availability.
    }
    clearStoredAuth()
    setAuth(null)
    setWorkspace(null)
    setError('')
    setLoading(false)
  }, [])

  return (
    <>
      {!auth ? <AuthPanel onAuthenticated={handleAuthenticated} /> : null}

      {auth ? (
      <AppShell
      health={workspace?.health}
      onRefresh={refreshWorkspace}
      refreshing={refreshing}
      currentUser={auth?.user}
      onLogout={handleLogout}
    >

      {loading ? (
        <LoadingState
          title="Loading operational data"
          description="Fetching workspace data."
        />
      ) : null}

      {error ? (
        <div className="banner error" role="alert" aria-live="assertive">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && workspace && auth ? (
        <Suspense
          fallback={
            <LoadingState
              title="Loading route"
              description="Splitting the bundle by workspace module."
            />
          }
        >
          <Routes>
            <Route
              path="/"
              element={
                <OverviewPage overview={workspace.overview} />
              }
            />
            <Route
              path="/campaigns"
              element={<CampaignStudioPage workspace={workspace.campaigns} currentUser={auth.user} onRefresh={refreshWorkspace} />}
            />
            <Route
              path="/job-automation"
              element={<JobAutomationPage workspace={workspace.jobAutomation} currentUser={auth.user} onRefresh={refreshWorkspace} />}
            />
            <Route
              path="/day-report"
              element={<DayReportPage workspace={workspace.dayReport} currentUser={auth.user} />}
            />
            <Route
              path="/submissions"
              element={<SubmissionProgressPage workspace={workspace.submissions} currentUser={auth.user} />}
            />
            <Route path="/api-explorer" element={<ApiExplorerPage />} />
            <Route path="/linkedin" element={<LinkedInRecruiterPage currentUser={auth.user} onRefresh={refreshWorkspace} />} />
            <Route path="/profile" element={<UserProfilePage currentUser={auth.user} onLogout={handleLogout} />} />
          </Routes>
        </Suspense>
      ) : null}
    </AppShell>
      ) : null}
    </>
  )
}

export default App
