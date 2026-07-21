import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'

const ADMIN_USER_ID = '339b9f21-2842-4aec-8cbe-f04db5358ac2'

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function UpdatesView() {
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUpdates()
    getUserId().then(setCurrentUserId)
  }, [])

  async function fetchUpdates() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('app_updates').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setUpdates(data)
    setLoading(false)
  }

  async function handlePost(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const user_id = await getUserId()
    const { error } = await supabase.from('app_updates').insert({
      title: title.trim(), description: description.trim() || null, user_id,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setTitle('')
    setDescription('')
    setModalOpen(false)
    fetchUpdates()
  }

  async function handleDelete(id) {
    if (!confirm('Remove this update?')) return
    await supabase.from('app_updates').delete().eq('id', id)
    fetchUpdates()
  }

  const isAdmin = currentUserId === ADMIN_USER_ID

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Updates</h1>
          <p className="view-subtitle cake-club-subtitle">✨ What's new around here.</p>
        </div>
        {isAdmin && (
          <div className="toolbar">
            <button className="btn-primary" onClick={() => setModalOpen(true)}>+ Post update</button>
          </div>
        )}
      </div>

      {loading && <p className="loading">Checking what's new… 📣✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && updates.length === 0 && (
        <div className="empty-state">
          <h3>Nothing posted yet ✨</h3>
          <p>{isAdmin ? 'Post your first update to let everyone know what changed.' : 'Check back soon for the latest updates.'}</p>
        </div>
      )}

      {!loading && !error && updates.length > 0 && (
        <div className="todo-list">
          {updates.map((u) => (
            <div className="calendar-card" style={{ marginBottom: 10, padding: '16px 18px' }} key={u.id}>
              <div className="brain-dump-entry-header">
                <p className="journey-title">✨ {u.title}</p>
                {isAdmin && u.user_id === currentUserId && (
                  <button className="todo-delete" onClick={() => handleDelete(u.id)}>×</button>
                )}
              </div>
              <p className="journey-date">{formatDate(u.created_at)}</p>
              {u.description && <p className="brain-dump-content">{u.description}</p>}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Post an update</h2>
            <form onSubmit={handlePost}>
              <div className="field">
                <label>What's new?</label>
                <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Added a Weight Journey tracker" required />
              </div>
              <div className="field">
                <label>Details (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell everyone what changed…" />
              </div>
              <div className="modal-actions">
                <div />
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Posting…' : 'Post update'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
