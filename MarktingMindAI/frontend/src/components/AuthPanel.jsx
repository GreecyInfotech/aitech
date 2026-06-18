import { useEffect, useState } from 'react'

import { fetchAuthOptions, loginUser, registerUser } from '../api/client'
import { isEmail, isNonEmpty } from '../utils/validators'

export function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [options, setOptions] = useState({ roles: ['super_admin', 'admin', 'user'], demoUsers: [] })

  const [loginPayload, setLoginPayload] = useState({
    email: 'superadmin@marketingmind.ai',
    password: 'Super@123',
  })

  const [registerPayload, setRegisterPayload] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
  })

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await fetchAuthOptions()
        setOptions(response)
      } catch {
        // Keep fallback options for offline/backend-down states.
      }
    }

    loadOptions()
  }, [])

  const submitLogin = async (event) => {
    event.preventDefault()

    if (!isEmail(loginPayload.email)) {
      setError('Enter a valid email for login.')
      return
    }

    if (!isNonEmpty(loginPayload.password, 6)) {
      setError('Password must be at least 6 characters.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const auth = await loginUser(loginPayload)
      onAuthenticated(auth)
    } catch (requestError) {
      setError(requestError?.response?.data?.detail ?? 'Login failed. Check credentials and backend status.')
    } finally {
      setBusy(false)
    }
  }

  const submitRegister = async (event) => {
    event.preventDefault()

    if (!isNonEmpty(registerPayload.name, 2)) {
      setError('Name must be at least 2 characters.')
      return
    }

    if (!isEmail(registerPayload.email)) {
      setError('Enter a valid email for registration.')
      return
    }

    if (!isNonEmpty(registerPayload.password, 6)) {
      setError('Password must be at least 6 characters.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const auth = await registerUser(registerPayload)
      onAuthenticated(auth)
    } catch (requestError) {
      setError(requestError?.response?.data?.detail ?? 'Registration failed. Try a different email.')
    } finally {
      setBusy(false)
    }
  }

  const useDemoCredentials = (demoUser) => {
    setMode('login')
    setLoginPayload({
      email: demoUser.email,
      password: demoUser.password,
    })
  }

  return (
    <div className="page-stack auth-screen-shell">
      <section className="hero-panel compact auth-hero">
        <div>
          <p className="eyebrow">Access Control</p>
          <h3>Sign in to continue</h3>
          <p className="hero-copy">Role-based access is enforced by backend endpoints for Super Admin, Admin, and User roles.</p>
        </div>
        <div className="tab-strip">
          <button type="button" className={`tab-button${mode === 'login' ? ' active' : ''}`} onClick={() => setMode('login')}>Login</button>
          <button type="button" className={`tab-button${mode === 'register' ? ' active' : ''}`} onClick={() => setMode('register')}>Register</button>
        </div>
      </section>

      {error ? <div className="banner error">{error}</div> : null}

      <section className="dual-grid auth-grid">
        {mode === 'login' ? (
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Login</p>
                <h4>Existing account</h4>
              </div>
            </div>
            <form className="form-grid compact-gap" onSubmit={submitLogin}>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={loginPayload.email}
                  onChange={(event) => setLoginPayload((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  value={loginPayload.password}
                  onChange={(event) => setLoginPayload((prev) => ({ ...prev, password: event.target.value }))}
                />
              </label>
              <div className="button-row compact-actions">
                <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Login'}</button>
              </div>
            </form>
          </article>
        ) : (
          <article className="glass-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Register</p>
                <h4>Create account</h4>
              </div>
            </div>
            <form className="form-grid compact-gap" onSubmit={submitRegister}>
              <label>
                Name
                <input
                  required
                  value={registerPayload.name}
                  onChange={(event) => setRegisterPayload((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={registerPayload.email}
                  onChange={(event) => setRegisterPayload((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={registerPayload.password}
                  onChange={(event) => setRegisterPayload((prev) => ({ ...prev, password: event.target.value }))}
                />
              </label>
              <label>
                Role
                <select
                  value={registerPayload.role}
                  onChange={(event) => setRegisterPayload((prev) => ({ ...prev, role: event.target.value }))}
                >
                  {options.roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>
              <div className="button-row compact-actions">
                <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Registering...' : 'Register & Login'}</button>
              </div>
            </form>
          </article>
        )}

        <article className="glass-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Demo Users</p>
              <h4>Hard-coded backend accounts</h4>
            </div>
          </div>
          <div className="page-stack dense">
            {options.demoUsers.map((demo) => (
              <button key={demo.email} type="button" className="list-card selectable" onClick={() => useDemoCredentials(demo)}>
                <strong>{demo.name}</strong>
                <p>{demo.email}</p>
                <p>Role: {demo.role}</p>
              </button>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
