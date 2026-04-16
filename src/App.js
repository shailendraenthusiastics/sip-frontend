import { useEffect, useMemo, useState } from 'react'
import client from './api/client'
import GrowthChart from './components/GrowthChart'

const AFFILIATE_URL = import.meta.env.VITE_AFFILIATE_URL || 'https://example.com/start-investing'
const TOKEN_KEY = 'stablemoney_access_token'

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

function App() {
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
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }, [token])

  const isAuthenticated = useMemo(() => Boolean(token), [token])

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

    if (!authForm.password || (!authForm.username && !authForm.email)) {
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
        setAuthMessage('Logged in successfully.')
        setAuthForm(emptyAuthForm)
      }
    } catch (error) {
      setAuthMessage(error?.response?.data?.detail || 'Authentication failed. Check your details.')
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
      await client.post('/track/', { source: 'sip-cta' })
      window.open(AFFILIATE_URL, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setCalcMessage(error?.response?.data?.detail || 'Tracking failed. Please try again.')
    } finally {
      setTracking(false)
    }
  }

  const submitLead = async (event) => {
    event.preventDefault()
    setLeadLoading(true)
    setLeadMessage('')

    try {
      await client.post('/lead/', { email: leadEmail })
      setLeadMessage('Thanks. Your email has been saved successfully.')
      setLeadEmail('')
    } catch (error) {
      setLeadMessage(error?.response?.data?.email?.[0] || 'Unable to save lead. Please use a valid email.')
    } finally {
      setLeadLoading(false)
    }
  }

  const logout = () => {
    setToken('')
    setResult(null)
    setChartData([])
    setCalcMessage('Logged out successfully.')
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <main className="page-grid">
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
          {leadMessage ? <p className="status-text">{leadMessage}</p> : null}
        </section>
      </main>
    </div>
  )
}

export default App
