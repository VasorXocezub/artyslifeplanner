import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { getHiddenBraindumpTabs } from './lib/localPrefs'

const MOODS = [
  '👑 Main Character', '✨ Thriving', '💅 Gorgeous Regardless', '🌸 Soft & Unbothered',
  '🦋 Feeling Cute', '🎀 Delusionally Optimistic', '💼 CEO Mode', '🚀 Building The Empire',
  '☕ Existing Professionally', '📖 Romanticizing Everything', '🫠 Hanging On By A Thread',
  '🌧️ In My Feels', '🤡 Learning Lessons Against My Will', '🚨 The Lore Thickens',
  '💌 Going Through It, Fashionably', '🧸 Need A Little Treat',
]

const TABS = [
  { key: 'write', label: '💌 Today\'s Brain Dump' },
  { key: 'archive', label: '📖 Lore Archive' },
]

function formatDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function monthKey(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function BrainDumpView() {
  const hiddenTabs = getHiddenBraindumpTabs()
  const visibleTabs = TABS.filter((t) => !hiddenTabs.includes(t.key))
  const [tab, setTab] = useState(() => (visibleTabs[0] ? visibleTabs[0].key : 'write'))

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Brain Dump</h1>
          <p className="view-subtitle cake-club-subtitle">Because therapy is expensive. 💌</p>
        </div>
      </div>

      <div className="filter-row">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={`filter-pill ${tab === t.key ? 'filter-pill-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'write' && <WriteTab onSaved={() => setTab('archive')} />}
      {tab === 'archive' && <ArchiveTab />}
    </div>
  )
}

function WriteTab({ onSaved }) {
  const [mood, setMood] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    const user_id = await getUserId()
    const { error } = await supabase.from('brain_dump_entries').insert({
      title: title.trim() || null, content: content.trim(), mood: mood || null, user_id,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setMood('')
    setTitle('')
    setContent('')
    onSaved()
  }

  return (
    <div className="calendar-card">
      <p className="module-group-label">💖 HOW'S THE VIBE TODAY?</p>
      <select value={mood} onChange={(e) => setMood(e.target.value)} style={{ marginBottom: 18 }}>
        <option value="">Pick your energy…</option>
        {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>

      <form onSubmit={handleSave}>
        <div className="field">
          <label>Title (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give today a headline…" />
        </div>
        <div className="field">
          <label>What's on your mind?</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Let it all out, bestie. No judgment here. ✨"
            style={{ minHeight: 180 }}
          />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button className="btn-primary" type="submit" disabled={saving || !content.trim()}>
          {saving ? 'Saving…' : 'Save entry'}
        </button>
      </form>
    </div>
  )
}

function ArchiveTab() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [moodFilter, setMoodFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [favOnly, setFavOnly] = useState(false)

  useEffect(() => { fetchEntries() }, [])

  async function fetchEntries() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('brain_dump_entries').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setEntries(data)
    setLoading(false)
  }

  async function toggleFavorite(entry) {
    await supabase.from('brain_dump_entries').update({ favorite: !entry.favorite }).eq('id', entry.id)
    fetchEntries()
  }

  async function handleDelete(id) {
    if (!confirm("Delete this entry? It'll be gone for good.")) return
    await supabase.from('brain_dump_entries').delete().eq('id', id)
    fetchEntries()
  }

  const usedMoods = Array.from(new Set(entries.map((e) => e.mood).filter(Boolean)))

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase()
    const matchesSearch = !q || (e.title || '').toLowerCase().includes(q) || (e.content || '').toLowerCase().includes(q)
    const matchesMood = moodFilter === 'all' || e.mood === moodFilter
    const matchesDate = !dateFilter || e.created_at.startsWith(dateFilter)
    const matchesFav = !favOnly || e.favorite
    return matchesSearch && matchesMood && matchesDate && matchesFav
  })

  const grouped = []
  filtered.forEach((e) => {
    const key = monthKey(e.created_at)
    let group = grouped.find((g) => g.key === key)
    if (!group) { group = { key, entries: [] }; grouped.push(group) }
    group.entries.push(e)
  })

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <input
          className="search-box"
          placeholder="Search your lore…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={moodFilter} onChange={(e) => setMoodFilter(e.target.value)}>
          <option value="all">All moods</option>
          {usedMoods.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" className="todo-date-input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        <button
          className={`filter-pill ${favOnly ? 'filter-pill-active' : ''}`}
          onClick={() => setFavOnly(!favOnly)}
        >
          ⭐ Favorites
        </button>
      </div>

      {loading && <p className="loading">Digging through the archives… 📖✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <h3>No entries yet ✨</h3>
          <p>Head to "Today's Brain Dump" and get it all out.</p>
        </div>
      )}

      {!loading && !error && grouped.map((g) => (
        <div className="upnext-section" key={g.key}>
          <p className="module-group-label">{g.key.toUpperCase()}</p>
          <div className="reading-journey">
            {g.entries.map((e) => (
              <div className="journey-item" key={e.id}>
                <div className="journey-dot" />
                <div className="journey-content brain-dump-entry">
                  <div className="brain-dump-entry-header">
                    <p className="journey-title">{e.title || 'Untitled thought'}</p>
                    <button
                      className="todo-recurring-badge todo-recurring-badge-on"
                      style={{ opacity: e.favorite ? 1 : 0.25 }}
                      onClick={() => toggleFavorite(e)}
                    >
                      ⭐
                    </button>
                  </div>
                  <p className="journey-date">{formatDateTime(e.created_at)}{e.mood ? ` · ${e.mood}` : ''}</p>
                  <p className="quote-stationery brain-dump-content">{e.content}</p>
                  <button className="todo-delete brain-dump-delete" onClick={() => handleDelete(e.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
