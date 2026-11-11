import { useEffect, useState } from 'react'
import { loadRules, addRule, deleteRule } from '../lib/budgetRules'

export default function RulesModal({ onClose, knownCats }) {
  const [rules, setRules] = useState([])
  const [pattern, setPattern] = useState('')
  const [category, setCategory] = useState('')
  const [err, setErr] = useState(null)
  const refresh = async () => setRules(await loadRules(true))
  useEffect(() => { refresh() }, [])

  async function add(e) {
    e.preventDefault()
    const { error } = await addRule(pattern, category)
    if (error) { setErr(error.message + (/relation|schema cache/i.test(error.message) ? ' — run budget-v5.sql in Supabase first.' : '')); return }
    setErr(null); setPattern(''); refresh()
  }
  async function del(id) { const { error } = await deleteRule(id); if (error) setErr(error.message); else refresh() }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Auto-categorise rules">
        <h2>Auto-categorise rules</h2>
        <p className="bd-dim">If a description contains the text, it gets that category automatically — when you log a transaction and when you import a statement.</p>
        {err && <p className="error-msg" role="alert">{err}</p>}
        <form onSubmit={add} className="bd-rule-form">
          <input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="Description contains… e.g. Woolworths" aria-label="Text to match" />
          <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
            <option value="">Category…</option>
            {knownCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn-primary" type="submit">Add</button>
        </form>
        <ul className="bd-rule-list">
          {rules.length === 0 && <li className="bd-dim">No rules yet.</li>}
          {rules.map(r => <li key={r.id}><span>“{r.pattern}” → <strong>{r.category}</strong></span><button type="button" className="budget-remove" aria-label={`Delete rule ${r.pattern}`} onClick={() => del(r.id)}>✕</button></li>)}
        </ul>
        <div className="modal-actions"><span /><div className="modal-actions-right"><button type="button" className="btn-cancel" onClick={onClose}>Close</button></div></div>
      </div>
    </div>
  )
}
