import { useEffect, useMemo, useState } from 'react'
import client from './api/client'
import GrowthChart from './components/GrowthChart'

const AFFILIATE_URL = import.meta.env.VITE_AFFILIATE_URL || 'https://example.com/start-investing'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000/api' : 'not configured')
const TOKEN_KEY = 'stablemoney_access_token'
const USER_KEY = 'stablemoney_user'

const emptyAuthForm = {
  username: '',
  email: '',
  password: '',
}

const emptySipForm = {
  monthly_investment: '5000',
  annual_interest_rate: '12',
  years: '10',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function extractApiErrorMessage(error, fallbackMessage) {
  const payload = error?.response?.data
  if (!error?.response) {
    return `Backend API is not reachable. Check VITE_API_BASE_URL (${API_BASE_URL}) and confirm backend is deployed and running.`
  }
  if (!payload) {
    return fallbackMessage
  }

  if (typeof payload === 'string') {
    return payload
  }

  if (payload.detail && typeof payload.detail === 'string') {
    return payload.detail
  }

  const flatMessages = Object.values(payload)
    .flat()
    .filter(Boolean)
    .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))

  return flatMessages.length > 0 ? flatMessages.join(' ') : fallbackMessage
}

function App() {
  const getInitialPage = () => (window.location.hash === '#/admin' ? 'admin' : 'home')

  const [activePage, setActivePage] = useState(getInitialPage)
  const [mode, setMode] = useState('login')
  const [authForm, setAuthForm] = useState(emptyAuthForm)
  const [sipForm, setSipForm] = useState(emptySipForm)
  const [leadEmail, setLeadEmail] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [calcMessage, setCalcMessage] = useState('')
  const [leadMessage, setLeadMessage] = useState('')
  const [result, setResult] = useState(null)
  const [chartData, setChartData] = useState([])
  const [authLoading, setAuthLoading] = useState(false)
  const [calcLoading, setCalcLoading] = useState(false)
  const [leadLoading, setLeadLoading] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [leadConsent, setLeadConsent] = useState(false)
  const [utm, setUtm] = useState({
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
  })
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsMessage, setAnalyticsMessage] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setCurrentUser(null)
    }
  }, [token])

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
    }
  }, [currentUser])

  useEffect(() => {
    const syncCurrentUser = async () => {
      if (!token) {
        return
      }

      try {
        const response = await client.get('/users/me/')
        setCurrentUser(response.data)
      } catch {
        setToken('')
        setCurrentUser(null)
      }
    }

    syncCurrentUser()
  }, [token])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setUtm({
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
    })
  }, [])

  const isAuthenticated = useMemo(() => Boolean(token), [token])
  const isAdmin = useMemo(() => Boolean(currentUser?.is_staff), [currentUser])

  const navigateTo = (page) => {
    const hash = page === 'admin' ? '#/admin' : '#/home'
    window.location.hash = hash
    setActivePage(page)
  }

  useEffect(() => {
    const onHashChange = () => {
      const page = window.location.hash === '#/admin' ? 'admin' : 'home'
      setActivePage(page)
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (activePage === 'admin' && !isAdmin) {
      setAnalyticsMessage('Admin panel is visible only to admin users.')
      navigateTo('home')
    }
  }, [activePage, isAdmin])

  const fetchAnalytics = async () => {
    if (!isAuthenticated || !isAdmin) {
      return
    }

    setAnalyticsLoading(true)
    setAnalyticsMessage('')
    try {
      const response = await client.get('/analytics/summary/')
      setAnalytics(response.data)
    } catch (error) {
      setAnalyticsMessage(extractApiErrorMessage(error, 'Unable to fetch analytics summary.'))
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const downloadCsvReport = async (endpoint, defaultName) => {
    if (!isAuthenticated || !isAdmin) {
      setAnalyticsMessage('Only admin users can export reports.')
      return
    }

    try {
      const response = await client.get(endpoint, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'text/csv' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = defaultName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(link.href)
    } catch (error) {
      setAnalyticsMessage(extractApiErrorMessage(error, 'Unable to export CSV report.'))
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [isAuthenticated])

  const handleAuthChange = (event) => {
    const { name, value } = event.target
    setAuthForm((current) => ({ ...current, [name]: value }))
  }

  const handleSipChange = (event) => {
    const { name, value } = event.target
    setSipForm((current) => ({ ...current, [name]: value }))
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthMessage('')

    if (mode === 'signup') {
      if (!authForm.username || !authForm.email || !authForm.password) {
        setAuthMessage('For signup, username, email, and password are required.')
        setAuthLoading(false)
        return
      }
    } else if (!authForm.password || (!authForm.username && !authForm.email)) {
      setAuthMessage('Enter your login details before submitting.')
      setAuthLoading(false)
      return
    }

    try {
      if (mode === 'signup') {
        await client.post('/users/signup/', {
          username: authForm.username,
          email: authForm.email,
          password: authForm.password,
        })
        setAuthMessage('Signup successful. Log in to continue.')
        setMode('login')
        setAuthForm(emptyAuthForm)
      } else {
        const response = await client.post('/token/', {
          username_or_email: authForm.username || authForm.email,
          password: authForm.password,
        })
        setToken(response.data.access)
        setCurrentUser(response.data.user || null)
        setAuthMessage(response.data?.user?.is_staff ? 'Logged in as admin.' : 'Logged in successfully.')
        setAuthForm(emptyAuthForm)
      }
    } catch (error) {
      setAuthMessage(extractApiErrorMessage(error, 'Authentication failed. Check your details.'))
    } finally {
      setAuthLoading(false)
    }
  }

  const calculateSip = async (event) => {
    event.preventDefault()
    if (!isAuthenticated) {
      setCalcMessage('Please log in first to calculate and save SIP results.')
      return
    }

    setCalcLoading(true)
    setCalcMessage('')

    try {
      const response = await client.post('/sip/', {
        monthly_investment: Number(sipForm.monthly_investment),
        annual_interest_rate: Number(sipForm.annual_interest_rate),
        years: Number(sipForm.years),
      })
      setResult(response.data)
      setChartData(response.data.chart_data || [])
      setCalcMessage('SIP result saved to your account.')
      fetchAnalytics()
    } catch (error) {
      const apiErrors = error?.response?.data
      setCalcMessage(
        apiErrors?.detail ||
          Object.values(apiErrors || {})
            .flat()
            .join(' ') ||
          'Unable to calculate SIP. Check your values and try again.',
      )
    } finally {
      setCalcLoading(false)
    }
  }

  const trackAndRedirect = async () => {
    if (!isAuthenticated) {
      setCalcMessage('Log in before using the affiliate CTA so clicks can be tracked.')
      return
    }

    setTracking(true)
    setCalcMessage('')

    try {
      await client.post('/track/', {
        source: 'sip-cta-web',
        ...utm,
      })
      fetchAnalytics()
      window.open(AFFILIATE_URL, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setCalcMessage(error?.response?.data?.detail || 'Tracking failed. Please try again.')
    } finally {
      setTracking(false)
    }
  }

  const submitLead = async (event) => {
    event.preventDefault()
    if (!leadConsent) {
      setLeadMessage('Please consent to data usage before submitting your email.')
      return
    }

    setLeadLoading(true)
    setLeadMessage('')

    try {
      await client.post('/lead/', {
        email: leadEmail,
        source: 'lead-widget',
        consent_given: leadConsent,
        ...utm,
      })
      setLeadMessage('Thanks. Your email has been saved successfully.')
      setLeadEmail('')
      setLeadConsent(false)
      fetchAnalytics()
    } catch (error) {
      setLeadMessage(extractApiErrorMessage(error, 'Unable to save lead. Please use a valid email.'))
    } finally {
      setLeadLoading(false)
    }
  }

  const logout = () => {
    setToken('')
    setCurrentUser(null)
    setResult(null)
    setChartData([])
    setAnalytics(null)
    setAnalyticsMessage('')
    setCalcMessage('Logged out successfully.')
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="view-switcher">
        <button type="button" className={activePage === 'home' ? 'active' : ''} onClick={() => navigateTo('home')}>
          Home
        </button>
        {isAdmin ? (
          <button type="button" className={activePage === 'admin' ? 'active' : ''} onClick={() => navigateTo('admin')}>
            Admin Panel
          </button>
        ) : null}
      </div>

      <main className="page-grid">
        {activePage === 'home' ? (
          <>
        <section className="hero-card glass-card">
          <div className="brand-row">
            <div className="brand-badge">SM</div>
            <div>
              <p className="eyebrow">StableMoney SIP App</p>
              <h1>Plan long-term wealth with a fast SIP calculator.</h1>
            </div>
          </div>
          <p className="hero-copy">
            Calculate future value, capture leads, and track affiliate clicks from one production-ready finance app.
          </p>

          <div className="hero-stats">
            <div>
              <span>Protected API</span>
              <strong>JWT secured</strong>
            </div>
            <div>
              <span>Growth chart</span>
              <strong>Chart.js insights</strong>
            </div>
            <div>
              <span>Lead capture</span>
              <strong>Revenue ready</strong>
            </div>
          </div>
        </section>

        <section className="auth-card glass-card">
          <div className="section-heading">
            <p className="eyebrow">Authentication</p>
            <h2>{mode === 'signup' ? 'Create account' : 'Welcome back'}</h2>
          </div>

          <div className="segmented-control">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Signup</button>
          </div>

          <form className="stack" onSubmit={handleAuthSubmit}>
            <label>
              Username or email
              <input name="username" value={authForm.username} onChange={handleAuthChange} placeholder="yourname or you@example.com" />
            </label>
            {mode === 'signup' && (
              <label>
                Email
                <input name="email" type="email" value={authForm.email} onChange={handleAuthChange} placeholder="you@example.com" />
              </label>
            )}
            <label>
              Password
              <input name="password" type="password" value={authForm.password} onChange={handleAuthChange} placeholder="Minimum 8 characters" />
            </label>
            <button className="primary-btn" type="submit" disabled={authLoading}>
              {authLoading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Login'}
            </button>
          </form>

          {authMessage ? <p className="status-text">{authMessage}</p> : null}
          <div className="session-row">
            <span>{isAuthenticated ? 'Authenticated' : 'Not logged in'}</span>
            <span>{isAuthenticated ? (isAdmin ? 'Admin user' : 'Standard user') : ''}</span>
            {isAuthenticated ? <button type="button" className="text-btn" onClick={logout}>Logout</button> : null}
          </div>
        </section>

        <section className="calculator-card glass-card wide-card">
          <div className="section-heading">
            <p className="eyebrow">SIP calculator</p>
            <h2>Project your investment growth</h2>
          </div>

          <form className="calculator-form" onSubmit={calculateSip}>
            <label>
              Monthly Investment Amount
              <input name="monthly_investment" type="number" min="1" value={sipForm.monthly_investment} onChange={handleSipChange} />
            </label>
            <label>
              Annual Interest Rate (%)
              <input name="annual_interest_rate" type="number" min="0" step="0.01" value={sipForm.annual_interest_rate} onChange={handleSipChange} />
            </label>
            <label>
              Time (Years)
              <input name="years" type="number" min="1" step="1" value={sipForm.years} onChange={handleSipChange} />
            </label>
            <button className="primary-btn" type="submit" disabled={calcLoading}>
              {calcLoading ? 'Calculating...' : 'Calculate SIP'}
            </button>
          </form>

          {calcMessage ? <p className="status-text">{calcMessage}</p> : null}

          {result ? (
            <div className="results-grid">
              <div className="metric-card">
                <span>Future Value</span>
                <strong>{formatCurrency(result.future_value)}</strong>
              </div>
              <div className="metric-card">
                <span>Total Invested</span>
                <strong>{formatCurrency(result.total_invested)}</strong>
              </div>
              <div className="metric-card accent">
                <span>Total Profit</span>
                <strong>{formatCurrency(result.total_profit)}</strong>
              </div>
            </div>
          ) : null}

          <div className="cta-panel">
            <div>
              <p className="eyebrow">Monetization</p>
              <h3>Start SIP today to reach your goal</h3>
            </div>
            <button type="button" className="secondary-btn" onClick={trackAndRedirect} disabled={tracking}>
              {tracking ? 'Opening offer...' : 'Start Investing Now 🚀'}
            </button>
          </div>
        </section>

        <section className="glass-card wide-card">
          <div className="section-heading">
            <p className="eyebrow">Growth visualization</p>
            <h2>Investment growth over the years</h2>
          </div>
          <GrowthChart chartData={chartData} />
        </section>
          </>
        ) : null}

        {activePage === 'admin' ? (
        <section className="glass-card wide-card admin-only-panel">
          <div className="section-heading analytics-head">
            <div>
              <p className="eyebrow">Admin panel</p>
              <h2>Revenue analytics dashboard</h2>
            </div>
            <button type="button" className="secondary-btn" onClick={fetchAnalytics} disabled={!isAdmin || analyticsLoading}>
              {analyticsLoading ? 'Refreshing...' : 'Refresh metrics'}
            </button>
          </div>
          <div className="export-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => downloadCsvReport('/analytics/export/clicks/', 'affiliate_clicks_report.csv')}
              disabled={!isAdmin}
            >
              Export Clicks CSV
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => downloadCsvReport('/analytics/export/leads/', 'lead_report.csv')}
              disabled={!isAdmin}
            >
              Export Leads CSV
            </button>
          </div>
          {!isAuthenticated ? <p className="status-text">Login to access the dashboard.</p> : null}
          {analyticsMessage ? <p className="status-text">{analyticsMessage}</p> : null}
          {isAdmin && analytics ? (
            <>
              <div className="results-grid">
                <div className="metric-card">
                  <span>Total Calculations</span>
                  <strong>{analytics.totals.calculations}</strong>
                </div>
                <div className="metric-card">
                  <span>Affiliate Clicks</span>
                  <strong>{analytics.totals.affiliate_clicks}</strong>
                </div>
                <div className="metric-card">
                  <span>Total Leads</span>
                  <strong>{analytics.totals.leads}</strong>
                </div>
              </div>
              <div className="results-grid compact-grid">
                <div className="metric-card accent">
                  <span>Click to Calculation %</span>
                  <strong>{analytics.rates.click_to_calculation_percent}%</strong>
                </div>
                <div className="metric-card accent">
                  <span>Lead to Click %</span>
                  <strong>{analytics.rates.lead_to_click_percent}%</strong>
                </div>
                <div className="metric-card accent">
                  <span>30-Day Clicks</span>
                  <strong>{analytics.last_30_days.affiliate_clicks}</strong>
                </div>
              </div>
            </>
          ) : null}
        </section>
        ) : null}

        {activePage === 'home' ? (
          <>
        <section className="glass-card lead-card">
          <div className="section-heading">
            <p className="eyebrow">Lead capture</p>
            <h2>Save interested prospects</h2>
          </div>
          <form className="lead-form" onSubmit={submitLead}>
            <input
              type="email"
              value={leadEmail}
              onChange={(event) => setLeadEmail(event.target.value)}
              placeholder="Enter email address"
              required
            />
            <button className="primary-btn" type="submit" disabled={leadLoading}>
              {leadLoading ? 'Saving...' : 'Subscribe'}
            </button>
          </form>
          <label className="consent-row">
            <input type="checkbox" checked={leadConsent} onChange={(event) => setLeadConsent(event.target.checked)} />
            <span>I consent to data usage for investment offers and communication.</span>
          </label>
          {leadMessage ? <p className="status-text">{leadMessage}</p> : null}
        </section>

        <section className="glass-card lead-card legal-card" id="legal">
          <div className="section-heading">
            <p className="eyebrow">Compliance</p>
            <h2>Privacy, disclosure, and risk information</h2>
          </div>
          <div className="legal-links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#disclosure">Affiliate Disclosure</a>
            <a href="#risk">Investment Disclaimer</a>
          </div>
          <article id="privacy" className="legal-block">
            <h3>Privacy Policy</h3>
            <p>
              We collect basic details such as email and campaign metadata to provide updates and improve conversion quality.
              We do not sell sensitive personal information. You can request deletion of your lead data at any time.
            </p>
          </article>
          <article id="disclosure" className="legal-block">
            <h3>Affiliate Disclosure</h3>
            <p>
              StableMoney SIP App may earn a commission when you click partner links and complete eligible actions. This does
              not increase your cost and helps keep this tool free.
            </p>
          </article>
          <article id="risk" className="legal-block">
            <h3>Investment Disclaimer</h3>
            <p>
              SIP projections are estimates based on entered assumptions and do not guarantee returns. This platform is
              educational and not financial advice. Consult a licensed advisor before investing.
            </p>
          </article>
        </section>
          </>
        ) : null}
      </main>
    </div>
  )
}

export default App