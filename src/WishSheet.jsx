import { useState } from 'react'
import { TONES, wishFor, wishCount, smsHref } from './lib/wishes'

export default function WishSheet({ contact, onClose }) {
  const [tone, setTone] = useState('cheeky')
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState(() => wishFor('cheeky', contact.name, 0))
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(null)

  function regen(nextTone, nextIdx) {
    setTone(nextTone); setIdx(nextIdx); setText(wishFor(nextTone, contact.name, nextIdx)); setCopied(false)
  }

  async function copy() {
    setCopyError(null)
    try { await navigator.clipboard.writeText(text); setCopied(true) } catch { setCopyError('Couldn’t copy automatically — select the text and copy it.') }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sc-confirm" onClick={(e) => e.stopPropagation()}>
        <h2>Birthday wish for {contact.name.split(' ')[0]} 🎂</h2>
        <div className="filter-row sc-wrap">
          {TONES.map((t) => (
            <button key={t.key} className={`filter-pill ${tone === t.key ? 'filter-pill-active' : ''}`} onClick={() => regen(t.key, 0)}>{t.label}</button>
          ))}
        </div>
        <div className="field">
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="sc-card-actions">
          <button className="sc-chip-btn" onClick={() => regen(tone, (idx + 1) % wishCount(tone))}>🔀 Another</button>
          <button className="sc-chip-btn" onClick={copy}>{copied ? '✓ Copied' : '📋 Copy'}</button>
          {contact.phone && <a className="sc-chip-btn" href={smsHref(contact.phone, text)}>💬 Open in messages</a>}
        </div>
        {copyError && <p className="error-msg">{copyError}</p>}
        {!contact.phone && <p className="field-hint">Add a phone number to open this straight in your messages.</p>}
        <div className="modal-actions"><div /><div className="modal-actions-right"><button className="btn-cancel" onClick={onClose}>Close</button></div></div>
      </div>
    </div>
  )
}
