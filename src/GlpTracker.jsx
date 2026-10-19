import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const SITES = ['Left abdomen', 'Right abdomen', 'Left thigh', 'Right thigh', 'Left upper arm', 'Right upper arm']
const MEDS = ['Ozempic (semaglutide)', 'Wegovy (semaglutide)', 'Mounjaro (tirzepatide)', 'Zepbound (tirzepatide)', 'Saxenda (liraglutide)', 'Victoza (liraglutide)', 'Trulicity (dulaglutide)', 'Other']

const todayStr = () => new Date().toISOString().split('T')[0]
const parse = (d) => new Date(d + 'T00:00:00')
const fmt = (d) => parse(d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const addDays = (d, n) => { const x = parse(d); x.setDate(x.getDate() + n); return x.toISOString().split('T')[0] }
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000)

export default function GlpTracker() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(null)
  const [injections, setInjections] = useState([])
  const [weights, setWeights] = useState([])
  const [unit, setUnit] = useState('kg')
  const [wSettings, setWSettings] = useState(null)
  const [editingSettings, setEditingSettings] = useState(false)
  const [sForm, setSForm] = useState({ medication: MEDS[0], dose: '', interval_days: 7 })
  const [form, setForm] = useState({ injected_on: todayStr(), dose: '', site: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const [s, i, w, ws] = await Promise.all([
      supabase.from('glp1_settings').select('*').limit(1).maybeSingle(),
      supabase.from('glp1_injections').select('*').order('injected_on', { ascending: false }),
      supabase.from('weight_logs').select('log_date, weight').order('log_date', { ascending: true }),
      supabase.from('weight_settings').select('unit, starting_weight, start_date').limit(1).maybeSingle(),
    ])
    if (s.error || i.error) {
      setError((s.error || i.error).message + ' — have you run the GLP-1 SQL in Supabase?')
      setLoading(false)
      return
    }
    setSettings(s.data)
    setInjections(i.data || [])
    setWeights(w.data || [])
    if (ws.data?.unit) setUnit(ws.data.unit)
    setWSettings(ws.data || null)
    if (s.data) {
      setForm(f => ({ ...f, dose: f.dose || s.data.dose || '' }))
      setSForm({ medication: s.data.medication, dose: s.data.dose || '', interval_days: s.data.interval_days })
    } else {
      setEditingSettings(true)
    }
    setLoading(false)
  }

  async function saveSettings(e) {
    e.preventDefault()
    const interval = parseInt(sForm.interval_days, 10)
    if (!interval || interval < 1) { setError('Days between injections must be at least 1.'); return }
    const payload = { medication: sForm.medication, dose: sForm.dose.trim() || null, interval_days: interval }
    let err
    if (settings) ({ error: err } = await supabase.from('glp1_settings').update(payload).eq('id', settings.id))
    else {
      const user_id = await getUserId()
      ;({ error: err } = await supabase.from('glp1_settings').insert({ ...payload, user_id }))
    }
    if (err) { setError(err.message); return }
    setEditingSettings(false)
    load()
  }

  async function logInjection(e) {
    e.preventDefault()
    if (!form.injected_on) return
    setSaving(true)
    const user_id = await getUserId()
    const { error: err } = await supabase.from('glp1_injections').insert({
      user_id, injected_on: form.injected_on, medication: settings?.medication || null,
      dose: form.dose.trim() || null, site: form.site || null, notes: form.notes.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ injected_on: todayStr(), dose: form.dose, site: '', notes: '' })
    load()
  }

  async function removeInjection(id) {
    if (!window.confirm('Delete this injection entry?')) return
    const { error: err } = await supabase.from('glp1_injections').delete().eq('id', id)
    if (err) setError(err.message)
    else setInjections(prev => prev.filter(i => i.id !== id))
  }

  const last = injections[0]
  const interval = settings?.interval_days || 7
  const nextDue = last ? addDays(last.injected_on, interval) : null
  const daysUntil = nextDue ? daysBetween(todayStr(), nextDue) : null
  const dueLabel = daysUntil === null ? null
    : daysUntil > 1 ? `in ${daysUntil} days`
    : daysUntil === 1 ? 'tomorrow'
    : daysUntil === 0 ? 'today'
    : `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} overdue`

  // Suggest rotating to the site not used most recently
  const lastSite = last?.site
  const suggestedSite = lastSite ? SITES[(SITES.indexOf(lastSite) + 1) % SITES.length] : null

  const first = injections[injections.length - 1]
  let weightLine = null
  if (first) {
    const before = [...weights].reverse().find(w => w.log_date <= first.injected_on)
    const startW = wSettings?.starting_weight != null && wSettings?.start_date && wSettings.start_date <= first.injected_on
      ? { log_date: wSettings.start_date, weight: wSettings.starting_weight } : null
    const atStart = before || startW || weights[0]
    const latest = weights[weights.length - 1]
    if (atStart && latest) weightLine = { start: atStart, latest, diff: Number(latest.weight) - Number(atStart.weight) }
  }

  if (loading) return <p className="loading">Checking your schedule… 💉</p>

  return (
    <div>
      {error && <p className="error-msg">{error}</p>}

      {editingSettings ? (
        <form className="calendar-card goals-summary-card" onSubmit={saveSettings}>
          <p className="module-group-label">Your medication</p>
          <div className="field">
            <label>Medication</label>
            <select value={sForm.medication} onChange={e => setSForm({ ...sForm, medication: e.target.value })}>
              {MEDS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Current dose (e.g. 0.5 mg)</label>
            <input value={sForm.dose} onChange={e => setSForm({ ...sForm, dose: e.target.value })} placeholder="0.25 mg" />
          </div>
          <div className="field">
            <label>Days between injections</label>
            <input type="number" min="1" value={sForm.interval_days} onChange={e => setSForm({ ...sForm, interval_days: e.target.value })} />
          </div>
          <div className="settings-danger-actions">
            {settings && <button type="button" className="btn-cancel" onClick={() => setEditingSettings(false)}>Cancel</button>}
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      ) : settings && (
        <div className="calendar-card goals-summary-card">
          <p className="module-group-label">Next injection</p>
          <div className="glp-next">
            {nextDue ? (
              <>
                <div className={`glp-next-when ${daysUntil < 0 ? 'total-negative' : ''}`}>{dueLabel}</div>
                <div>{fmt(nextDue)}</div>
              </>
            ) : <div>Log your first injection below and I'll track the next date.</div>}
          </div>
          <div className="goals-summary-row"><span className="goals-summary-label">💉 Medication</span><span className="goals-summary-value">{settings.medication}{settings.dose ? ` · ${settings.dose}` : ''}</span></div>
          <div className="goals-summary-row"><span className="goals-summary-label">🔁 Every</span><span className="goals-summary-value">{interval} days</span></div>
          <div className="goals-summary-row"><span className="goals-summary-label">📅 Total logged</span><span className="goals-summary-value">{injections.length}</span></div>
          {weightLine && (
            <div className="goals-summary-row">
              <span className="goals-summary-label">⚖️ Since starting</span>
              <span className="goals-summary-value">{weightLine.diff > 0 ? '+' : ''}{weightLine.diff.toFixed(1)} {unit} ({Number(weightLine.start.weight).toFixed(1)} → {Number(weightLine.latest.weight).toFixed(1)})</span>
            </div>
          )}
          <button className="btn-cancel" onClick={() => setEditingSettings(true)}>Edit medication</button>
        </div>
      )}

      {settings && !editingSettings && (
        <form className="calendar-card goals-summary-card" onSubmit={logInjection}>
          <p className="module-group-label">Log an injection</p>
          <div className="field"><label>Date</label><input type="date" value={form.injected_on} max={todayStr()} onChange={e => setForm({ ...form, injected_on: e.target.value })} /></div>
          <div className="field"><label>Dose</label><input value={form.dose} onChange={e => setForm({ ...form, dose: e.target.value })} placeholder="0.5 mg" /></div>
          <div className="field">
            <label>Injection site{suggestedSite ? ` (next in rotation: ${suggestedSite})` : ''}</label>
            <select value={form.site} onChange={e => setForm({ ...form, site: e.target.value })}>
              <option value="">Not recorded</option>
              {SITES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field"><label>Notes (side effects, appetite, how you felt)</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></div>
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log injection'}</button>
        </form>
      )}

      {injections.length > 0 && (
        <div className="calendar-card goals-summary-card">
          <p className="module-group-label">History</p>
          {injections.map((i, idx) => {
            const gap = idx < injections.length - 1 ? daysBetween(injections[idx + 1].injected_on, i.injected_on) : null
            return (
              <div key={i.id} className="glp-row">
                <div className="glp-row-main">
                  <strong>{fmt(i.injected_on)}</strong>
                  <span>{[i.dose, i.site].filter(Boolean).join(' · ') || '—'}{gap !== null ? ` · ${gap}d after previous` : ''}</span>
                  {i.notes && <span className="glp-note">{i.notes}</span>}
                </div>
                <button className="budget-remove" aria-label="Delete entry" onClick={() => removeInjection(i.id)}>✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
