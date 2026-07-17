import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const ADMIN_USER_ID = '339b9f21-2842-4aec-8cbe-f04db5358ac2'

const TYPES = [
  { key: 'bug', label: '🐛 Bug' },
  { key: 'suggestion', label: '💡 Suggestion' },
]

const STATUSES = [
  { key: 'open', label: '🍵 Fresh' },
  { key: 'in_progress', label: '🔥 Brewing' },
  { key: 'done', label: '✅ Served' },
]

function typeInfo(key) {
  return TYPES.find((t) => t.key === key) || TYPES[1]
}
function statusInfo(key) {
  return STATUSES.find((s) => s.key === key) || STATUSES[0]
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function SpillTheTeaView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [type, setType] = useState('suggestion')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchItems()
    getUserId().then(setCurrentUserId)
  }, [])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('dev_feedback').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const user_id = await getUserId()
    const { data: userData } = await supabase.auth.getUser()
    const author_name = userData?.user?.user_metadata?.full_name || 'Someone'

    const { error } = await supabase.from('dev_feedback').insert({
      type, title: title.trim(), description: description.trim() || null, author_name, user_id,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setType('suggestion')
    setTitle('')
    setDescription('')
    setModalOpen(false)
    fetchItems()
  }

  async function changeStatus(item, status) {
    const { error } = await supabase.from('dev_feedback').update({ status }).eq('id', item.id)
    if (error) { setError(error.message); return }
    fetchItems()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this? No take-backs.')) return
    await supabase.from('dev_feedback').delete().eq('id', id)
    fetchItems()
  }

  const filtered = items.filter((i) => {
    const matchesType = typeFilter === 'all' || i.type === typeFilter
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter
    return matchesType && matchesStatus
  })

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Spill the Tea</h1>
          <p className="view-subtitle cake-club-subtitle">🫖 Found a bug? Got a genius idea? We're listening.</p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={() => setModalOpen(true)}>+ Spill something</button>
        </div>
      </div>

      <div className="filter-row">
        <button className={`filter-pill ${typeFilter === 'all' ? 'filter-pill-active' : ''}`} onClick={() => setTypeFilter('all')}>All</button>
        {TYPES.map((t) => (
          <button key={t.key} className={`filter-pill ${typeFilter === t.key ? 'filter-pill-active' : ''}`} onClick={() => setTypeFilter(t.key)}>{t.label}</button>
        ))}
        {STATUSES.map((s) => (
          <button key={s.key} className={`filter-pill ${statusFilter === s.key ? 'filter-pill-active' : ''}`} onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}>{s.label}</button>
        ))}
      </div>

      {loading && <p className="loading">Setting the kettle on… 🫖✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <h3>No tea yet ✨</h3>
          <p>Be the first to spill a bug or a brilliant idea.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="todo-list">
          {filtered.map((item) => {
            const tInfo = typeInfo(item.type)
            const isMine = item.user_id === currentUserId
            const isAdmin = currentUserId === ADMIN_USER_ID
            const sInfo = statusInfo(item.status)
            return (
              <div className="todo-item-wrap" key={item.id}>
                <div className="calendar-card" style={{ marginBottom: 10, padding: '16px 18px' }}>
                  <div className="brain-dump-entry-header">
                    <p className="journey-title">{tInfo.label} {item.title}</p>
                    {isMine && (
                      <button className="todo-delete" onClick={() => handleDelete(item.id)}>×</button>
                    )}
                  </div>
                  <p className="journey-date">{item.author_name} · {formatDate(item.created_at)}</p>
                  {item.description && <p className="brain-dump-content">{item.description}</p>}
                  {isAdmin ? (
                    <select
                      className="todo-priority-select"
                      style={{ marginTop: 10 }}
                      value={item.status || 'open'}
                      onChange={(e) => changeStatus(item, e.target.value)}
                    >
                      {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  ) : (
                    <span className="filter-pill" style={{ marginTop: 10, display: 'inline-block', cursor: 'default' }}>
                      {sInfo.label}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Spill it 🫖</h2>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>What kind of tea is this?</label>
                <div className="toggle-group">
                  {TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={`toggle-btn ${type === t.key ? 'toggle-btn-active' : ''}`}
                      onClick={() => setType(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Title</label>
                <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quick summary…" required />
              </div>
              <div className="field">
                <label>Details</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell us everything…" />
              </div>
              <div className="modal-actions">
                <div />
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Spilling…' : 'Spill it'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
