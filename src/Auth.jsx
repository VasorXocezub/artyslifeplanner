import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
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

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-subtitle">
          {mode === 'login' ? 'Log in to your own private space.' : 'Everything you add stays private to you.'}
        </p>

        <form onSubmit={handleSubmit}>
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
