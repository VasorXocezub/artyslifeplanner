import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function Auth({ initialMode = 'login', onResetDone }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  async function handleLoginOrSignup(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Account created! Check your email to confirm, then log in.')
        setMode('login')
      }
    }
    setLoading(false)
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMessage("If that email has an account, we've sent a reset link. Check your inbox.")
    }
  }

  async function handleSetNewPassword(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMessage('Password updated! Taking you in…')
      setTimeout(() => onResetDone && onResetDone(), 1200)
    }
  }

  if (mode === 'reset') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">Set a new password</h1>
          <p className="auth-subtitle">Choose something you'll remember this time.</p>
          <form onSubmit={handleSetNewPassword}>
            <div className="field">
              <label>New password</label>
              <input
                type="password"
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </div>
            {error && <p className="error-msg">{error}</p>}
            {message && <p className="auth-success">{message}</p>}
            <button className="btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (mode === 'forgot') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-subtitle">We'll email you a link to set a new one.</p>
          <form onSubmit={handleForgotPassword}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            {error && <p className="error-msg">{error}</p>}
            {message && <p className="auth-success">{message}</p>}
            <button className="btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <button
            type="button"
            className="auth-toggle"
            onClick={() => { setMode('login'); setError(null); setMessage(null) }}
          >
            Back to log in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-subtitle">
          {mode === 'login' ? 'Log in to your own private space.' : 'Everything you add stays private to you.'}
        </p>

        <form onSubmit={handleLoginOrSignup}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>

          {error && <p className="error-msg">{error}</p>}
          {message && <p className="auth-success">{message}</p>}

          <button className="btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        {mode === 'login' && (
          <button
            type="button"
            className="auth-toggle"
            onClick={() => { setMode('forgot'); setError(null); setMessage(null) }}
          >
            Forgot password?
          </button>
        )}

        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError(null)
            setMessage(null)
          }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}
