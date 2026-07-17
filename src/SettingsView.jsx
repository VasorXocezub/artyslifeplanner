import { useState } from 'react'
import { supabase } from './lib/supabase'
import { getHiddenFinanceTabs, setHiddenFinanceTabs } from './lib/localPrefs'

const SPACES = [
  { key: 'contacts', label: 'Cake Club', icon: '🎂' },
  { key: 'goals', label: 'Goals', icon: '🌱' },
  { key: 'habits', label: 'Habits', icon: '🔥' },
  { key: 'finances', label: 'Finances', icon: '💸' },
  { key: 'todos', label: 'To-Do', icon: '📋' },
  { key: 'shopping', label: 'Shopping List', icon: '🛍️' },
  { key: 'booknook', label: 'Book Nook', icon: '📚' },
]

const FINANCE_SUB_SPACES = [
  { key: 'overview', label: 'Overview' },
  { key: 'personal', label: 'Personal' },
  { key: 'business', label: 'Business' },
  { key: 'savings', label: 'Savings' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'converter', label: 'Converter' },
]

export default function SettingsView({ session, hiddenModules, onSaveModules, onLogout }) {
  const [nameInput, setNameInput] = useState(session.user.user_metadata?.full_name || '')
  const [nameSaved, setNameSaved] = useState(false)
  const [selectedSpaces, setSelectedSpaces] = useState(new Set(hiddenModules))
  const [selectedFinanceTabs, setSelectedFinanceTabs] = useState(new Set(getHiddenFinanceTabs()))
  const [spacesSaved, setSpacesSaved] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState(null)
  const [passwordError, setPasswordError] = useState(null)

  async function handleSaveName(e) {
    e.preventDefault()
    if (!nameInput.trim()) return
    const { error } = await supabase.auth.updateUser({ data: { full_name: nameInput.trim() } })
    if (!error) {
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
    }
  }

  function toggleSpace(key) {
    setSelectedSpaces((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleFinanceTab(key) {
    setSelectedFinanceTabs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleSaveSpaces() {
    onSaveModules(Array.from(selectedSpaces))
    setHiddenFinanceTabs(Array.from(selectedFinanceTabs))
    setSpacesSaved(true)
    setTimeout(() => setSpacesSaved(false), 2000)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordMessage(null)
    if (newPassword.length < 6) {
      setPasswordError('Password needs to be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.")
      return
    }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordMessage('Password updated ✓')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const financesHidden = selectedSpaces.has('finances')

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Settings</h1>
          <p className="view-subtitle">Your account, your Spaces, your rules ✨</p>
        </div>
      </div>

      <div className="settings-section">
        <p className="module-group-label">ACCOUNT</p>
        <div className="calendar-card">
          <form onSubmit={handleSaveName} className="settings-inline-form">
            <div className="field">
              <label>Display name</label>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="What should we call you?"
              />
            </div>
            <button className="btn-primary" type="submit">
              {nameSaved ? 'Saved ✓' : 'Save name'}
            </button>
          </form>
        </div>
      </div>

      <div className="settings-section">
        <p className="module-group-label">CHANGE PASSWORD</p>
        <div className="calendar-card">
          <form onSubmit={handleChangePassword}>
            <div className="field-row">
              <div className="field">
                <label>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="field">
                <label>Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Type it again"
                />
              </div>
            </div>
            {passwordError && <p className="error-msg">{passwordError}</p>}
            {passwordMessage && <p className="auth-success">{passwordMessage}</p>}
            <button className="btn-primary" type="submit" disabled={passwordSaving}>
              {passwordSaving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>

      <div className="settings-section">
        <p className="module-group-label">SPACES</p>
        <p className="field-hint">Turn off anything you don't want to see. You can always turn it back on.</p>
        <div className="settings-module-list">
          {SPACES.map((m) => {
            const isHidden = selectedSpaces.has(m.key)
            return (
              <button
                key={m.key}
                type="button"
                className={`settings-module-row ${isHidden ? 'settings-module-row-off' : ''}`}
                onClick={() => toggleSpace(m.key)}
              >
                <span className="settings-module-label">{m.icon} {m.label}</span>
                <span className={`settings-toggle ${isHidden ? '' : 'settings-toggle-on'}`}>
                  <span className="settings-toggle-knob" />
                </span>
              </button>
            )
          })}
        </div>

        {!financesHidden && (
          <>
            <p className="module-group-label settings-subspace-label">FINANCE SUB-SPACES</p>
            <div className="settings-module-list">
              {FINANCE_SUB_SPACES.map((t) => {
                const isHidden = selectedFinanceTabs.has(t.key)
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`settings-module-row ${isHidden ? 'settings-module-row-off' : ''}`}
                    onClick={() => toggleFinanceTab(t.key)}
                  >
                    <span className="settings-module-label">{t.label}</span>
                    <span className={`settings-toggle ${isHidden ? '' : 'settings-toggle-on'}`}>
                      <span className="settings-toggle-knob" />
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        <button className="btn-primary settings-save-spaces" onClick={handleSaveSpaces}>
          {spacesSaved ? 'Saved ✓' : 'Save Spaces'}
        </button>
      </div>

      <div className="settings-section">
        <button className="btn-cancel settings-logout-btn" onClick={onLogout}>Log out</button>
      </div>
    </div>
  )
}
