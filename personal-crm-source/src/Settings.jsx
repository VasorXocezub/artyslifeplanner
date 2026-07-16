import { useState } from 'react'
import { supabase } from './lib/supabase'

const TOGGLEABLE_MODULES = [
  { key: 'contacts', label: 'Birthdays', icon: '🎂' },
  { key: 'goals', label: 'Goals', icon: '🌱' },
  { key: 'habits', label: 'Habits', icon: '🔥' },
  { key: 'finances', label: 'Finances', icon: '💸' },
  { key: 'todos', label: 'To-Do', icon: '📋' },
]

export default function Settings({ hiddenModules, onSave, onClose }) {
  const [selected, setSelected] = useState(new Set(hiddenModules))
  const [saving, setSaving] = useState(false)

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    const hidden_modules = Array.from(selected)
    const { error } = await supabase.auth.updateUser({ data: { hidden_modules } })
    setSaving(false)
    if (!error) {
      onSave(hidden_modules)
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Modules</h2>
        <p className="auth-subtitle">Turn off anything you don't want to see. You can always turn it back on.</p>

        <div className="settings-module-list">
          {TOGGLEABLE_MODULES.map((m) => {
            const isHidden = selected.has(m.key)
            return (
              <button
                key={m.key}
                type="button"
                className={`settings-module-row ${isHidden ? 'settings-module-row-off' : ''}`}
                onClick={() => toggle(m.key)}
              >
                <span className="settings-module-label">{m.icon} {m.label}</span>
                <span className={`settings-toggle ${isHidden ? '' : 'settings-toggle-on'}`}>
                  <span className="settings-toggle-knob" />
                </span>
              </button>
            )
          })}
        </div>

        <div className="modal-actions">
          <div />
          <div className="modal-actions-right">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
