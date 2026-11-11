import { useMemo, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { parseLines, parseVcf } from './lib/birthdayImport'
import { formatMonthDay, parseLocalDate, missingColumnHint } from './lib/social'

export default function ImportBirthdaysModal({ existing, onClose, onDone }) {
  const [text, setText] = useState('')
  const [fileRows, setFileRows] = useState([])
  const [skipped, setSkipped] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const parsed = useMemo(() => parseLines(text), [text])
  const rows = useMemo(() => [...fileRows, ...parsed.rows], [fileRows, parsed])
  const dupKey = (r) => { const p = parseLocalDate(r.birthday); return `${r.name.toLowerCase()}|${p.month}|${p.day}` }
  const known = useMemo(() => new Set(existing.map(dupKey)), [existing]) // eslint-disable-line react-hooks/exhaustive-deps
  const seen = new Set()
  const view = rows.map((r, i) => {
    const k = dupKey(r)
    const dup = known.has(k) || seen.has(k)
    seen.add(k)
    return { ...r, i, dup }
  })
  const toAdd = view.filter((r) => !r.dup && !skipped.has(r.i))

  async function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const t = await f.text()
    if (/BEGIN:VCARD/i.test(t)) setFileRows(parseVcf(t))
    else { setFileRows([]); setText((prev) => `${prev}${prev ? '\n' : ''}${t}`) }
    e.target.value = ''
  }

  async function save() {
    if (!toAdd.length) return
    setSaving(true)
    setError(null)
    const user_id = await getUserId()
    const payload = toAdd.map(({ i, dup, birth_year, ...r }) => ({ ...r, ...(birth_year ? { birth_year } : {}), icon: '🎂', user_id })) // eslint-disable-line no-unused-vars
    const { error } = await supabase.from('contacts').insert(payload)
    setSaving(false)
    if (error) { setError(missingColumnHint(error.message)); return }
    onDone(payload.length)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Import birthdays</h2>
        <p className="field-hint">Paste one per line as “Name, date” (add a relationship or phone if you like), or upload a contacts file (.vcf) or .csv. Dates like 14/11/1990, 14 Nov or 1990-11-14 all work.</p>
        <div className="field">
          <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Mom, 14 Nov 1965, family\nLindi, 20/11, friends, +27 82 000 0000'} />
        </div>
        <div className="field">
          <input type="file" accept=".vcf,.csv,.txt,text/vcard,text/csv,text/plain" onChange={onFile} />
        </div>
        {parsed.bad.length > 0 && <p className="error-msg">Couldn't read {parsed.bad.length} line{parsed.bad.length > 1 ? 's' : ''}: {parsed.bad.slice(0, 3).join(' | ')}{parsed.bad.length > 3 ? '…' : ''}</p>}
        {view.length > 0 && (
          <div className="upcoming-list" style={{ maxHeight: 240, overflowY: 'auto' }}>
            {view.map((r) => {
              const p = parseLocalDate(r.birthday)
              const off = r.dup || skipped.has(r.i)
              return (
                <label key={r.i} className="upcoming-row" style={{ opacity: off ? 0.5 : 1, cursor: r.dup ? 'default' : 'pointer' }}>
                  <span className="upcoming-name">
                    <input type="checkbox" disabled={r.dup} checked={!off}
                      onChange={() => setSkipped((s) => { const n = new Set(s); if (n.has(r.i)) n.delete(r.i); else n.add(r.i); return n })} />
                    {' '}{r.name}
                  </span>
                  <span className="upcoming-date">{formatMonthDay(p.month, p.day)}{r.birth_year ? ` ${r.birth_year}` : ''}{r.dup ? ' · already added' : ''}</span>
                </label>
              )
            })}
          </div>
        )}
        {error && <p className="error-msg">{error}</p>}
        <div className="modal-actions">
          <div />
          <div className="modal-actions-right">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" disabled={saving || !toAdd.length} onClick={save}>
              {saving ? 'Importing…' : `Import ${toAdd.length || ''}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
