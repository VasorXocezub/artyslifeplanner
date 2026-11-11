import { useMemo, useState } from 'react'
import { supabase, getUserId } from '../lib/supabase'
import { saveFinanceCategory } from '../lib/financeCategories'
import { parseCSV, parseAmount, parseDate, guessColumns, matchRule, addRule, loadRules } from '../lib/budgetRules'

// Bank statement CSV → review → import. Rules fill in categories; your choices can become new rules.
export default function ImportModal({ onClose, onDone, knownCats, rules, money, currency }) {
  const [raw, setRaw] = useState(null) // string[][]
  const [cols, setCols] = useState(null)
  const [hasHeader, setHasHeader] = useState(true)
  const [positiveSpend, setPositiveSpend] = useState(false)
  const [edits, setEdits] = useState({}) // row index -> { cat, skip }
  const [dupes, setDupes] = useState(new Set())
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      const rows = parseCSV(String(r.result || ''))
      if (rows.length < 2) { setErr('That file looks empty — is it a CSV export from your bank?'); return }
      setErr(null); setRaw(rows); setCols(guessColumns(rows[0])); setEdits({}); setDupes(new Set())
    }
    r.onerror = () => setErr('Could not read that file.')
    r.readAsText(f)
  }

  const header = raw ? raw[0] : []
  const parsed = useMemo(() => {
    if (!raw || !cols) return []
    return raw.slice(hasHeader ? 1 : 0).map((r, i) => {
      const date = parseDate(r[cols.date])
      let amt = cols.amount >= 0 ? parseAmount(r[cols.amount]) : null
      if (cols.amount < 0 || amt === null) {
        const d = cols.debit >= 0 ? parseAmount(r[cols.debit]) : null, c = cols.credit >= 0 ? parseAmount(r[cols.credit]) : null
        if (d) amt = -Math.abs(d); else if (c) amt = Math.abs(c)
      }
      if (amt !== null && positiveSpend) amt = -amt
      const desc = (r[cols.desc] || '').trim()
      const rule = matchRule(desc, rules)
      return { i, date, amt, desc, type: amt !== null && amt < 0 ? 'expense' : 'income', ruleCat: rule?.category || '', bad: !date || amt === null || amt === 0 }
    })
  }, [raw, cols, hasHeader, positiveSpend, rules])

  async function checkDupes() {
    const ok = parsed.filter(p => !p.bad)
    if (!ok.length) return
    const dates = ok.map(p => p.date).sort()
    const { data } = await supabase.from('transactions').select('date, amount, notes').gte('date', dates[0]).lte('date', dates[dates.length - 1])
    const have = new Set((data || []).map(t => `${t.date}|${Number(t.amount).toFixed(2)}|${(t.notes || '').toLowerCase()}`))
    const dup = new Set(ok.filter(p => have.has(`${p.date}|${Math.abs(p.amt).toFixed(2)}|${p.desc.toLowerCase()}`)).map(p => p.i))
    setDupes(dup)
    setEdits(prev => { const n = { ...prev }; dup.forEach(i => { n[i] = { ...n[i], skip: true } }); return n })
  }

  const chosen = (p) => (edits[p.i]?.cat ?? p.ruleCat)
  const rowsToImport = parsed.filter(p => !p.bad && !edits[p.i]?.skip)

  async function doImport() {
    if (!rowsToImport.length) { setErr('Nothing selected to import.'); return }
    setBusy(true); setErr(null)
    const user_id = await getUserId()
    const payload = rowsToImport.map(p => ({ user_id, date: p.date, amount: Math.abs(p.amt), type: p.type, category: chosen(p).trim() || null, notes: p.desc || null }))
    const { error } = await supabase.from('transactions').insert(payload)
    if (error) { setBusy(false); setErr(error.message); return }
    const cats = [...new Set(payload.map(x => x.category).filter(Boolean))]
    for (const c of cats) await saveFinanceCategory(c)
    if (remember) {
      const known = new Set(rules.map(r => r.pattern.toLowerCase()))
      const learned = new Map()
      rowsToImport.forEach(p => {
        const c = edits[p.i]?.cat
        const key = p.desc.replace(/[\d*#/]+/g, ' ').trim().split(/\s+/).slice(0, 2).join(' ')
        if (c && key.length >= 3 && !known.has(key.toLowerCase())) learned.set(key, c)
      })
      for (const [k, c] of learned) await addRule(k, c)
    }
    await loadRules(true)
    setBusy(false)
    onDone(payload.length)
  }

  const colSelect = (key, label, optional) => (
    <div className="field"><label>{label}</label>
      <select value={cols[key]} onChange={e => setCols({ ...cols, [key]: Number(e.target.value) })}>
        {optional && <option value={-1}>— none —</option>}
        {header.map((h, i) => <option key={i} value={i}>{hasHeader ? (h || `Column ${i + 1}`) : `Column ${i + 1}`}</option>)}
      </select>
    </div>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal bd-modal bd-import" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Import bank statement">
        <h2>Import a bank statement</h2>
        {err && <p className="error-msg" role="alert">{err}</p>}
        {!raw && (
          <>
            <p className="bd-dim">Export a CSV from your banking app and choose it here. You'll review everything before anything is saved.</p>
            <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} aria-label="Choose CSV file" />
          </>
        )}
        {raw && cols && (
          <>
            <div className="field-row">
              {colSelect('date', 'Date column')}
              {colSelect('desc', 'Description column')}
            </div>
            <div className="field-row">
              {colSelect('amount', 'Amount column', true)}
              {colSelect('debit', 'Debit column (if separate)', true)}
              {colSelect('credit', 'Credit column (if separate)', true)}
            </div>
            <label className="bd-check"><input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} /><span>First row is a header</span></label>
            <label className="bd-check"><input type="checkbox" checked={positiveSpend} onChange={e => setPositiveSpend(e.target.checked)} /><span>Positive amounts are spending (some card statements)</span></label>
            <div className="bd-import-actions">
              <button type="button" className="bd-mini" onClick={checkDupes}>Skip ones I already have</button>
              <span className="bd-dim">{rowsToImport.length} of {parsed.length} will import{dupes.size ? ` · ${dupes.size} duplicates skipped` : ''}</span>
            </div>
            <div className="bd-import-list">
              {parsed.slice(0, 200).map(p => (
                <div key={p.i} className={`bd-import-row ${p.bad || edits[p.i]?.skip ? 'bd-import-off' : ''}`}>
                  <input type="checkbox" aria-label="Include" checked={!p.bad && !edits[p.i]?.skip} disabled={p.bad} onChange={e => setEdits({ ...edits, [p.i]: { ...edits[p.i], skip: !e.target.checked } })} />
                  <span className="bd-import-main"><strong>{p.desc || '(no description)'}</strong><span className="bd-dim">{p.bad ? 'Could not read this row' : `${p.date} · ${p.type === 'income' ? '+' : '−'}${money(Math.abs(p.amt))}`}</span></span>
                  {!p.bad && (
                    <select value={chosen(p)} onChange={e => setEdits({ ...edits, [p.i]: { ...edits[p.i], cat: e.target.value } })} aria-label="Category">
                      <option value="">Uncategorized</option>
                      {[...new Set([...knownCats, p.ruleCat].filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
              ))}
              {parsed.length > 200 && <p className="bd-dim">Showing the first 200 rows only — import in smaller batches.</p>}
            </div>
            <label className="bd-check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span>Remember the categories I choose as rules for next time</span></label>
          </>
        )}
        <div className="modal-actions"><span />
          <div className="modal-actions-right">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            {raw && <button type="button" className="btn-primary" disabled={busy || !rowsToImport.length} onClick={doImport}>{busy ? 'Importing…' : `Import ${rowsToImport.length} (${currency})`}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
