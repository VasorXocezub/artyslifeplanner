import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const EMPTY_MESSAGES = [
  "💅 Hot girls don't remember everything... they have an Inbox.",
  "😂 You said \"I'll remember.\" We both know that's a lie.",
  '🧠 Girl... write it down before it joins the witness protection program.',
  "💖 Future you is already obsessed with the fact you wrote this down.",
  "📝 Your brain has approximately 73 tabs open. Let's close one.",
  "🌸 Messy thoughts welcome. We'll make them pretty later.",
  '🎀 Tiny thought? Big plan? Chaotic masterpiece? Throw it in here.',
  "📥 Inbox: because shouting \"DON'T FORGET!\" at yourself isn't a strategy.",
  '💭 Your brain deserves better than mental sticky notes.',
  "💕 No one's judging your random collection of thoughts. In fact... we love the lore.",
]

const TEMPLATES = [
  { key: 'blank', icon: '📋', name: 'Blank Note', content: '' },
  { key: 'call', icon: '📞', name: 'Call Notes', content: '<p><strong>Contact:</strong> </p><p><strong>Date:</strong> </p><p><strong>Summary:</strong> </p><p><strong>Action Items:</strong></p><ul><li></li></ul><p><strong>Follow-up:</strong> </p>' },
  { key: 'idea', icon: '💡', name: 'Idea', content: '<p><strong>The idea:</strong> </p><p><strong>Why it matters:</strong> </p><p><strong>Next step:</strong> </p>' },
  { key: 'shopping', icon: '🛍', name: 'Shopping List', content: '<ul><li></li></ul>' },
  { key: 'travel', icon: '✈️', name: 'Travel Planning', content: '<p><strong>Destination:</strong> </p><p><strong>Dates:</strong> </p><p><strong>Must-do:</strong></p><ul><li></li></ul><p><strong>Packing:</strong></p><ul><li></li></ul>' },
  { key: 'restaurant', icon: '🍽', name: 'Restaurant', content: '<p><strong>Name:</strong> </p><p><strong>Cuisine:</strong> </p><p><strong>What to order:</strong> </p><p><strong>Vibe:</strong> </p>' },
  { key: 'gift', icon: '🎁', name: 'Gift Idea', content: '<p><strong>For:</strong> </p><p><strong>Idea:</strong> </p><p><strong>Where to get it:</strong> </p><p><strong>Budget:</strong> </p>' },
  { key: 'home', icon: '🏡', name: 'Home', content: '<p><strong>Room:</strong> </p><p><strong>What needs doing:</strong> </p><p><strong>Budget / notes:</strong> </p>' },
  { key: 'finance', icon: '💰', name: 'Finance', content: '<p><strong>What:</strong> </p><p><strong>Amount:</strong> </p><p><strong>Due date:</strong> </p><p><strong>Notes:</strong> </p>' },
]

const CONVERT_TARGETS = [
  { key: 'todo', icon: '📝', label: 'To-Do Task' },
  { key: 'social', icon: '💌', label: 'Social Club Event' },
  { key: 'gift', icon: '🎁', label: 'Cake Club Gift Idea' },
  { key: 'book', icon: '📚', label: 'Book Nook Reading Note' },
  { key: 'recipe', icon: '🍓', label: 'Kitchen Club Recipe' },
  { key: 'goal', icon: '🌱', label: 'Dream Board Goal' },
]

const SORT_OPTIONS = [
  { key: 'recent', label: 'Recently Edited' },
  { key: 'created', label: 'Date Created' },
  { key: 'alpha', label: 'Alphabetical' },
  { key: 'pinned', label: 'Pinned First' },
]

function stripHtml(html) {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

function formatRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ---------------- Tag Input ---------------- */
function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('')

  function addTag(e) {
    e.preventDefault()
    const clean = input.trim().replace(/^#/, '')
    if (!clean) return
    if (!tags.includes(clean)) onChange([...tags, clean])
    setInput('')
  }

  return (
    <div className="inbox-tag-input">
      {tags.map((t) => (
        <span key={t} className="inbox-tag-chip">
          #{t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}>×</button>
        </span>
      ))}
      <form onSubmit={addTag} style={{ display: 'inline' }}>
        <input
          className="inbox-tag-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === ',' ) { e.preventDefault(); addTag(e) } }}
          placeholder="+ tag"
        />
      </form>
    </div>
  )
}

/* ---------------- Note Editor (rich text) ---------------- */
function NoteEditor({ note, onChange, onClose, titleInputRef }) {
  const editorRef = useRef(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (editorRef.current && !initialized) {
      editorRef.current.innerHTML = note.content || ''
      setInitialized(true)
    }
  }, [note.id])

  function exec(cmd, val) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    onChange({ ...note, content: editorRef.current.innerHTML })
  }

  function insertChecklist() {
    exec('insertHTML', '☐ ')
  }

  function handleEditorClick(e) {
    // toggle ☐/☑ if clicking directly on the character
    if (e.target.nodeType === undefined) return
  }

  function insertLink() {
    const url = prompt('Paste a link:')
    if (url) exec('createLink', url)
  }

  return (
    <div className="inbox-editor">
      <input
        ref={titleInputRef}
        className="inbox-editor-title"
        value={note.title}
        onChange={(e) => onChange({ ...note, title: e.target.value })}
        placeholder="Untitled Note"
      />
      <div className="inbox-toolbar">
        <button type="button" onClick={() => exec('bold')} title="Bold"><strong>B</strong></button>
        <button type="button" onClick={() => exec('italic')} title="Italic"><em>I</em></button>
        <button type="button" onClick={() => exec('underline')} title="Underline"><u>U</u></button>
        <button type="button" onClick={() => exec('insertUnorderedList')} title="Bullet list">•</button>
        <button type="button" onClick={() => exec('insertOrderedList')} title="Numbered list">1.</button>
        <button type="button" onClick={insertChecklist} title="Checklist">☐</button>
        <button type="button" onClick={insertLink} title="Link">🔗</button>
      </div>
      <div
        ref={editorRef}
        className="inbox-editor-content"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange({ ...note, content: editorRef.current.innerHTML })}
        onClick={handleEditorClick}
        data-placeholder="Start typing… it saves as you go."
      />
      <TagInput tags={note.tags || []} onChange={(tags) => onChange({ ...note, tags })} />
    </div>
  )
}

/* ---------------- Template Picker ---------------- */
function TemplatePicker({ onPick, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Start from…</h2>
        <div className="inbox-template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.key} type="button" className="inbox-template-btn" onClick={() => onPick(t)}>
              <span className="inbox-template-icon">{t.icon}</span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Note Card ---------------- */
function NoteCard({ note, onOpen, onPin, onArchive, onConvert }) {
  const preview = stripHtml(note.content).slice(0, 120)
  return (
    <div className="contact-card inbox-note-card" onClick={() => onOpen(note)}>
      <div className="inbox-card-top">
        <h3 className="contact-name" title={note.title}>
          {note.pinned && <span className="inbox-pin-icon">📌</span>}
          {note.title?.trim() || 'Untitled Note'}
        </h3>
      </div>
      {preview && <p className="inbox-card-preview">{preview}{stripHtml(note.content).length > 120 ? '…' : ''}</p>}
      {note.tags && note.tags.length > 0 && (
        <div className="inbox-card-tags">
          {note.tags.map((t) => <span key={t} className="inbox-tag-chip inbox-tag-chip-small">#{t}</span>)}
        </div>
      )}
      <p className="habit-schedule">{formatRelative(note.updated_at)}</p>
      <div className="log-value-row" onClick={(e) => e.stopPropagation()}>
        <button className="btn-delete-small" onClick={() => onPin(note)}>{note.pinned ? '📌 Unpin' : '📌 Pin'}</button>
        <button className="btn-delete-small" onClick={() => onArchive(note)}>🗄️ Archive</button>
        <button className="btn-delete-small" onClick={() => onConvert(note)}>🔄 Convert</button>
      </div>
    </div>
  )
}

/* ---------------- Search Bar ---------------- */
function SearchBar({ value, onChange }) {
  return (
    <input
      className="search-box inbox-search-input"
      placeholder="🔍 Search titles, content, tags…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/* ---------------- Filter Bar ---------------- */
function FilterBar({ filter, setFilter, sort, setSort }) {
  return (
    <div className="filter-row inbox-filter-row">
      {['all', 'pinned', 'archived'].map((f) => (
        <button
          key={f}
          className={`filter-pill ${filter === f ? 'filter-pill-active' : ''}`}
          onClick={() => setFilter(f)}
        >
          {f === 'all' ? '✨ All' : f === 'pinned' ? '📌 Pinned' : '🗄️ Archived'}
        </button>
      ))}
      <select className="inbox-sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
        {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </div>
  )
}

/* ---------------- Convert Modal ---------------- */
function ConvertModal({ note, onClose, onConverted }) {
  const [target, setTarget] = useState(null)
  const [afterAction, setAfterAction] = useState(null)
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target === 'gift') {
      supabase.from('contacts').select('id, name').then(({ data }) => setContacts(data || []))
    }
  }, [target])

  async function performConversion() {
    setSaving(true)
    const user_id = await getUserId()
    const title = note.title?.trim() || 'Untitled Note'
    const content = stripHtml(note.content)

    if (target === 'todo') {
      await supabase.from('todos').insert({ text: title, category: 'personal', energy: 'quick_win', user_id })
    } else if (target === 'social') {
      await supabase.from('social_events').insert({ title, event_date: new Date().toISOString().split('T')[0], event_type: 'reminder', user_id })
    } else if (target === 'gift' && selectedContact) {
      const { data: c } = await supabase.from('contacts').select('gift_ideas').eq('id', selectedContact).single()
      const merged = c?.gift_ideas ? `${c.gift_ideas}\n${content}` : content
      await supabase.from('contacts').update({ gift_ideas: merged }).eq('id', selectedContact)
    } else if (target === 'book') {
      await supabase.from('books').insert({ title, status: 'want_to_read', notes: content, user_id })
    } else if (target === 'recipe') {
      await supabase.from('recipes').insert({ name: title, category: 'dinner', instructions: content, user_id })
    } else if (target === 'goal') {
      await supabase.from('goals').insert({ title, goal_type: 'simple', status: 'not_started', notes: content, user_id })
    }

    if (afterAction === 'archive') {
      await supabase.from('inbox_notes').update({ archived: true }).eq('id', note.id)
    } else if (afterAction === 'delete') {
      await supabase.from('inbox_notes').delete().eq('id', note.id)
    }

    setSaving(false)
    onConverted()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Convert to…</h2>
        {!target ? (
          <div className="inbox-template-grid">
            {CONVERT_TARGETS.map((t) => (
              <button key={t.key} type="button" className="inbox-template-btn" onClick={() => setTarget(t.key)}>
                <span className="inbox-template-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {target === 'gift' && (
              <div className="field">
                <label>Which person?</label>
                <select value={selectedContact} onChange={(e) => setSelectedContact(e.target.value)}>
                  <option value="">Select…</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label>What should happen to the original note?</label>
              <div className="recur-pill-col">
                <button type="button" className={`filter-pill ${afterAction === 'keep' ? 'filter-pill-active' : ''}`} onClick={() => setAfterAction('keep')}>Keep it</button>
                <button type="button" className={`filter-pill ${afterAction === 'archive' ? 'filter-pill-active' : ''}`} onClick={() => setAfterAction('archive')}>Archive it</button>
                <button type="button" className={`filter-pill ${afterAction === 'delete' ? 'filter-pill-active' : ''}`} onClick={() => setAfterAction('delete')}>Delete it</button>
              </div>
            </div>
            <div className="modal-actions">
              <div>
                <button type="button" className="btn-cancel" onClick={() => setTarget(null)}>Back</button>
              </div>
              <div className="modal-actions-right">
                <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving || !afterAction || (target === 'gift' && !selectedContact)}
                  onClick={performConversion}
                >
                  {saving ? 'Converting…' : 'Convert'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------- Main Inbox Page ---------------- */
export default function InboxView() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [editingNote, setEditingNote] = useState(null)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [convertingNote, setConvertingNote] = useState(null)
  const [emptyMessage] = useState(() => EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)])
  const titleInputRef = useRef(null)
  const saveTimeout = useRef(null)

  useEffect(() => {
    fetchNotes()
  }, [])

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') {
        setEditingNote(null)
        setTemplatePickerOpen(false)
        setConvertingNote(null)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  async function fetchNotes() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('inbox_notes').select('*').order('updated_at', { ascending: false })
    if (error) setError(error.message)
    else setNotes(data || [])
    setLoading(false)
  }

  function openNew(template) {
    setEditingNote({
      id: null,
      title: '',
      content: template?.content || '',
      tags: [],
      pinned: false,
      archived: false,
    })
    setTemplatePickerOpen(false)
    setTimeout(() => titleInputRef.current?.focus(), 50)
  }

  function openNote(note) {
    setEditingNote({ ...note })
  }

  function scheduleAutoSave(updated) {
    setEditingNote(updated)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveNote(updated), 500)
  }

  async function saveNote(note) {
    const user_id = await getUserId()
    const payload = {
      title: note.title?.trim() || null,
      content: note.content || '',
      tags: note.tags || [],
      pinned: note.pinned,
      archived: note.archived,
      updated_at: new Date().toISOString(),
    }
    if (!note.title?.trim() && !stripHtml(note.content).trim()) return // don't save fully empty notes

    if (note.id) {
      const { error } = await supabase.from('inbox_notes').update(payload).eq('id', note.id)
      if (error) { setError(error.message); return }
    } else {
      const { data, error } = await supabase.from('inbox_notes').insert({ ...payload, user_id }).select().single()
      if (error) { setError(error.message); return }
      setEditingNote((cur) => (cur && !cur.id ? { ...cur, id: data.id } : cur))
    }
    fetchNotes()
  }

  function closeEditor() {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    if (editingNote) saveNote(editingNote)
    setEditingNote(null)
  }

  async function togglePin(note) {
    await supabase.from('inbox_notes').update({ pinned: !note.pinned }).eq('id', note.id)
    fetchNotes()
  }

  async function toggleArchive(note) {
    await supabase.from('inbox_notes').update({ archived: !note.archived }).eq('id', note.id)
    fetchNotes()
  }

  async function deleteNote(note) {
    if (!confirm('Delete this note for good?')) return
    await supabase.from('inbox_notes').delete().eq('id', note.id)
    setEditingNote(null)
    fetchNotes()
  }

  const filtered = useMemo(() => {
    let list = notes
    if (filter === 'pinned') list = list.filter((n) => n.pinned && !n.archived)
    else if (filter === 'archived') list = list.filter((n) => n.archived)
    else list = list.filter((n) => !n.archived)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((n) =>
        (n.title || '').toLowerCase().includes(q) ||
        stripHtml(n.content).toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
      )
    }

    const sorted = [...list].sort((a, b) => {
      if (sort === 'alpha') return (a.title || 'Untitled Note').localeCompare(b.title || 'Untitled Note')
      if (sort === 'created') return new Date(b.created_at) - new Date(a.created_at)
      if (sort === 'pinned') return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
      return new Date(b.updated_at) - new Date(a.updated_at)
    })

    if (sort !== 'pinned') {
      sorted.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
    }
    return sorted
  }, [notes, filter, search, sort])

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Inbox</h1>
          <p className="view-subtitle cake-club-subtitle">Your capture space — save it now, sort it later. 📥</p>
        </div>
        <div className="toolbar">
          <button className="btn-check" onClick={() => setTemplatePickerOpen(true)}>📋 From Template</button>
          <button className="btn-primary" onClick={() => openNew(null)}>+ New Note</button>
        </div>
      </div>

      <div className="inbox-search-row">
        <SearchBar value={search} onChange={setSearch} />
      </div>
      <FilterBar filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} />

      {loading && <p className="loading">Gathering your loose thoughts… 📥✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state inbox-empty-state">
          <span className="inbox-empty-emoji">📥</span>
          <p>{emptyMessage}</p>
          <button className="btn-primary" onClick={() => openNew(null)}>+ New Note</button>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="card-grid">
          {filtered.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onOpen={openNote}
              onPin={togglePin}
              onArchive={toggleArchive}
              onConvert={setConvertingNote}
            />
          ))}
        </div>
      )}

      {templatePickerOpen && (
        <TemplatePicker onPick={openNew} onClose={() => setTemplatePickerOpen(false)} />
      )}

      {editingNote && (
        <div className="modal-backdrop" onClick={closeEditor}>
          <div className="modal inbox-editor-modal" onClick={(e) => e.stopPropagation()}>
            <NoteEditor note={editingNote} onChange={scheduleAutoSave} titleInputRef={titleInputRef} />
            <div className="modal-actions">
              <div>
                {editingNote.id && (
                  <>
                    <button type="button" className="btn-delete-small" onClick={() => togglePin(editingNote)}>{editingNote.pinned ? '📌 Unpin' : '📌 Pin'}</button>
                    <button type="button" className="btn-delete-small" onClick={() => toggleArchive(editingNote)}>{editingNote.archived ? '↩️ Restore' : '🗄️ Archive'}</button>
                    <button type="button" className="btn-delete" onClick={() => deleteNote(editingNote)}>Delete</button>
                  </>
                )}
              </div>
              <div className="modal-actions-right">
                <button type="button" className="btn-primary" onClick={closeEditor}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {convertingNote && (
        <ConvertModal
          note={convertingNote}
          onClose={() => setConvertingNote(null)}
          onConverted={() => { setConvertingNote(null); fetchNotes() }}
        />
      )}
    </div>
  )
}
