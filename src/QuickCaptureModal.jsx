import { useEffect, useRef, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

export default function QuickCaptureModal({ onClose }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    textareaRef.current?.focus()
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  async function handleSave() {
    if (!text.trim()) { onClose(); return }
    setSaving(true)
    const user_id = await getUserId()
    await supabase.from('inbox_notes').insert({
      title: null,
      content: `<p>${text.trim().replace(/\n/g, '</p><p>')}</p>`,
      tags: [],
      user_id,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleSave}>
      <div className="modal inbox-quick-capture" onClick={(e) => e.stopPropagation()}>
        <p className="cake-section-heading" style={{ marginBottom: 10 }}>📥 Quick Capture</p>
        <textarea
          ref={textareaRef}
          className="inbox-quick-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type it before you forget it…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
          }}
        />
        <div className="modal-actions">
          <div />
          <div className="modal-actions-right">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save to Inbox'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
