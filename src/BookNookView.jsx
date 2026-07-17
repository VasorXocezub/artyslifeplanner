import { useEffect, useMemo, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { getReadingGoal, setReadingGoal } from './lib/localPrefs'

const emptyForm = {
  title: '', author: '', genre: '', pages: '', status: 'want_to_read',
  rating: '', start_date: '', finish_date: '', favorite_quote: '', notes: '',
  series_name: '', series_number: '',
}

function formatDate(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function mostCommon(arr) {
  if (arr.length === 0) return null
  const counts = {}
  arr.forEach((v) => { counts[v] = (counts[v] || 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function seriesLabel(book) {
  if (!book.series_name) return null
  return book.series_number ? `${book.series_name} #${book.series_number}` : book.series_name
}

export default function BookNookView() {
  const [books, setBooks] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [pageInputs, setPageInputs] = useState({})
  const [goal, setGoalState] = useState(getReadingGoal())
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState(String(goal))

  const [checkinPages, setCheckinPages] = useState('')
  const [checkinBookId, setCheckinBookId] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    const { data: booksData, error: booksError } = await supabase
      .from('books').select('*').order('created_at', { ascending: false })
    if (booksError) { setError(booksError.message); setLoading(false); return }
    const { data: logsData } = await supabase.from('reading_logs').select('*')
    setBooks(booksData)
    setLogs(logsData || [])
    setLoading(false)
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(book) {
    setEditingId(book.id)
    setForm({
      title: book.title || '', author: book.author || '', genre: book.genre || '',
      pages: book.pages != null ? String(book.pages) : '', status: book.status || 'want_to_read',
      rating: book.rating != null ? String(book.rating) : '',
      start_date: book.start_date || '', finish_date: book.finish_date || '',
      favorite_quote: book.favorite_quote || '', notes: book.notes || '',
      series_name: book.series_name || '', series_number: book.series_number != null ? String(book.series_number) : '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)

    const payload = {
      title: form.title.trim(),
      author: form.author.trim() || null,
      genre: form.genre.trim() || null,
      pages: form.pages ? parseInt(form.pages, 10) : null,
      status: form.status,
      rating: form.rating ? parseFloat(form.rating) : null,
      start_date: form.start_date || null,
      finish_date: form.finish_date || null,
      favorite_quote: form.favorite_quote.trim() || null,
      notes: form.notes.trim() || null,
      series_name: form.series_name.trim() || null,
      series_number: form.series_number ? parseInt(form.series_number, 10) : null,
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('books').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('books').insert({ ...payload, user_id }))
    }

    setSaving(false)
    if (error) { setError(error.message); return }
    closeModal()
    fetchAll()
  }

  async function handleDelete() {
    if (!editingId) return
    if (!confirm('Remove this book from your shelf?')) return
    const { error } = await supabase.from('books').delete().eq('id', editingId)
    if (error) { setError(error.message); return }
    closeModal()
    fetchAll()
  }

  async function logPages(book, explicitPages) {
    const raw = explicitPages !== undefined ? explicitPages : pageInputs[book.id]
    const pages = parseInt(raw, 10)
    if (!raw || isNaN(pages) || pages <= 0) return
    const user_id = await getUserId()
    const todayStr = new Date().toISOString().split('T')[0]
    const newCurrent = Math.min((book.pages || Infinity), Number(book.current_page || 0) + pages)

    await supabase.from('reading_logs').insert({ book_id: book.id, logged_date: todayStr, pages, user_id })
    await supabase.from('books').update({ current_page: newCurrent }).eq('id', book.id)

    setPageInputs((v) => ({ ...v, [book.id]: '' }))
    fetchAll()
  }

  async function handleCheckin() {
    const book = books.find((b) => b.id === checkinBookId)
    if (!book) return
    await logPages(book, checkinPages)
    setCheckinPages('')
  }

  async function startReading(book) {
    await supabase.from('books').update({
      status: 'reading',
      start_date: book.start_date || new Date().toISOString().split('T')[0],
    }).eq('id', book.id)
    fetchAll()
  }

  async function markFinished(book) {
    const ratingInput = prompt(`Finished "${book.title}"! Rate it 1-5 ⭐ (optional):`)
    const rating = ratingInput ? parseFloat(ratingInput) : null
    await supabase.from('books').update({
      status: 'finished',
      finish_date: new Date().toISOString().split('T')[0],
      current_page: book.pages || book.current_page,
      rating: rating && !isNaN(rating) ? rating : book.rating,
    }).eq('id', book.id)
    fetchAll()
  }

  function handleSaveGoal() {
    const n = parseInt(goalInput, 10)
    if (isNaN(n) || n <= 0) return
    setReadingGoal(n)
    setGoalState(n)
    setEditingGoal(false)
  }

  const now = new Date()
  const thisYear = now.getFullYear()

  const finishedBooks = useMemo(
    () => books.filter((b) => b.status === 'finished' && b.finish_date),
    [books]
  )
  const finishedThisYear = finishedBooks.filter((b) => new Date(b.finish_date + 'T00:00:00').getFullYear() === thisYear)
  const currentlyReading = books.filter((b) => b.status === 'reading')
  const toBeRead = books.filter((b) => b.status === 'want_to_read')
  const todayStr = now.toISOString().split('T')[0]
  const readToday = logs.some((l) => l.logged_date === todayStr)

  useEffect(() => {
    if (!checkinBookId && currentlyReading.length > 0) {
      setCheckinBookId(currentlyReading[0].id)
    }
  }, [currentlyReading, checkinBookId])

  const readThisYear = finishedThisYear.length
  const avgRating = (() => {
    const rated = finishedBooks.filter((b) => b.rating != null)
    if (rated.length === 0) return null
    return (rated.reduce((s, b) => s + Number(b.rating), 0) / rated.length).toFixed(1)
  })()
  const pagesReadThisYear = finishedThisYear.reduce((s, b) => s + Number(b.pages || 0), 0)
    + logs.filter((l) => new Date(l.logged_date + 'T00:00:00').getFullYear() === thisYear)
      .reduce((s, l) => s + Number(l.pages || 0), 0)

  const readingStreak = useMemo(() => {
    const dateSet = new Set(logs.map((l) => l.logged_date))
    let streak = 0
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const todayStr = cursor.toISOString().split('T')[0]
    if (!dateSet.has(todayStr)) cursor.setDate(cursor.getDate() - 1)
    while (dateSet.has(cursor.toISOString().split('T')[0])) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    return streak
  }, [logs])

  const goalPct = Math.min(100, Math.round((readThisYear / goal) * 100))

  const now_month = now.getMonth()
  const monthName = now.toLocaleDateString('en-US', { month: 'long' })
  const finishedThisMonth = finishedBooks.filter((b) => {
    const d = new Date(b.finish_date + 'T00:00:00')
    return d.getMonth() === now_month && d.getFullYear() === thisYear
  })
  const pagesThisMonth = finishedThisMonth.reduce((s, b) => s + Number(b.pages || 0), 0)
  const favoriteThisMonth = [...finishedThisMonth].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0]
  const avgRatingThisMonth = (() => {
    const rated = finishedThisMonth.filter((b) => b.rating != null)
    if (rated.length === 0) return null
    return (rated.reduce((s, b) => s + Number(b.rating), 0) / rated.length).toFixed(1)
  })()

  const longestBook = [...finishedBooks].sort((a, b) => (b.pages || 0) - (a.pages || 0))[0]
  const shortestBook = [...finishedBooks].filter((b) => b.pages).sort((a, b) => (a.pages || 0) - (b.pages || 0))[0]
  const avgPages = finishedBooks.length
    ? Math.round(finishedBooks.reduce((s, b) => s + Number(b.pages || 0), 0) / finishedBooks.length)
    : null
  const mostGenre = mostCommon(finishedBooks.map((b) => b.genre).filter(Boolean))
  const mostAuthor = mostCommon(finishedBooks.map((b) => b.author).filter(Boolean))
  const fastestRead = [...finishedBooks]
    .filter((b) => b.start_date && b.finish_date)
    .map((b) => ({
      book: b,
      days: Math.round((new Date(b.finish_date) - new Date(b.start_date)) / 86400000),
    }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days)[0]
  const totalReadingDays = [...finishedBooks]
    .filter((b) => b.start_date && b.finish_date)
    .reduce((s, b) => s + Math.max(1, Math.round((new Date(b.finish_date) - new Date(b.start_date)) / 86400000)), 0)

  const journey = [...finishedBooks].sort((a, b) => new Date(a.finish_date) - new Date(b.finish_date))

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Book Nook</h1>
          <p className="view-subtitle cake-club-subtitle">I'd rather be reading. 📖</p>
        </div>
        <div className="toolbar">
          <button className="btn-primary" onClick={openAdd}>+ Add a book</button>
        </div>
      </div>

      {loading && <p className="loading">Settling in with a cup of tea… ☕</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <>
          <div className="calendar-card booknook-progress-card">
            <div className="booknook-stats-grid">
              <div className="booknook-stat">
                <span className="booknook-stat-label">📚 Read This Year</span>
                <span className="booknook-stat-value">{readThisYear}</span>
              </div>
              <div className="booknook-stat">
                <span className="booknook-stat-label">⭐ Average Rating</span>
                <span className="booknook-stat-value">{avgRating || '—'}</span>
              </div>
              <div className="booknook-stat">
                <span className="booknook-stat-label">📄 Pages Read</span>
                <span className="booknook-stat-value">{pagesReadThisYear.toLocaleString()}</span>
              </div>
              <div className="booknook-stat">
                <span className="booknook-stat-label">🔥 Reading Streak</span>
                <span className="booknook-stat-value">{readingStreak}d</span>
              </div>
              <div className="booknook-stat">
                <span className="booknook-stat-label">📖 Currently Reading</span>
                <span className="booknook-stat-value booknook-stat-small">
                  {currentlyReading[0]?.title || 'Nothing yet'}
                </span>
              </div>
              <div className="booknook-stat">
                <span className="booknook-stat-label">🎯 Goal</span>
                {editingGoal ? (
                  <span className="booknook-goal-edit">
                    <input
                      type="number"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      className="log-value-input"
                    />
                    <button className="btn-check log-value-btn" onClick={handleSaveGoal}>Set</button>
                  </span>
                ) : (
                  <span className="booknook-stat-value booknook-stat-small">
                    {readThisYear} / {goal} books{' '}
                    <button className="weather-location-link" onClick={() => { setGoalInput(String(goal)); setEditingGoal(true) }}>edit</button>
                  </span>
                )}
              </div>
            </div>

            <div className="shelf-bar">
              {Array.from({ length: goal }, (_, i) => (
                <span key={i} className={`shelf-book ${i < readThisYear ? 'shelf-book-filled' : ''}`}>📖</span>
              ))}
            </div>
            <p className="progress-label">{goalPct}% of your {thisYear} goal</p>
          </div>

          {currentlyReading.length > 0 && (
            <div className="calendar-card booknook-checkin-card">
              <p className="module-group-label">DID YOU READ TODAY?</p>
              <div className="booknook-checkin-row">
                <button
                  className={`btn-check ${readToday ? 'btn-check-done' : ''}`}
                  disabled={readToday}
                  onClick={handleCheckin}
                >
                  {readToday ? '✓ Logged for today' : '✓ I read today'}
                </button>
                {currentlyReading.length > 1 && (
                  <select value={checkinBookId} onChange={(e) => setCheckinBookId(e.target.value)}>
                    {currentlyReading.map((b) => (
                      <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                  </select>
                )}
                <input
                  type="number"
                  className="log-value-input"
                  placeholder="pages read"
                  value={checkinPages}
                  onChange={(e) => setCheckinPages(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheckin()}
                  disabled={readToday}
                />
              </div>
            </div>
          )}

          {currentlyReading.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">CURRENTLY READING</p>
              <div className="card-grid">
                {currentlyReading.map((b) => {
                  const pct = b.pages ? Math.min(100, Math.round((Number(b.current_page || 0) / b.pages) * 100)) : 0
                  return (
                    <div className="library-card" key={b.id}>
                      <div className="bookmark-ribbon" style={{ height: `${Math.max(12, pct)}%` }} />
                      <h3 className="contact-name" title={b.title}>{b.title}</h3>
                      {b.author && <p className="contact-relationship">{b.author}</p>}
                      {seriesLabel(b) && <p className="habit-schedule">📖 {seriesLabel(b)}</p>}
                      <div className="progress-row">
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${pct}%`, background: '#1E5C57' }} />
                        </div>
                        <span className="progress-label">
                          {b.pages ? `${b.current_page || 0} / ${b.pages} pages (${pct}%)` : `${b.current_page || 0} pages read`}
                        </span>
                      </div>
                      <div className="log-value-row">
                        <input
                          type="number"
                          className="log-value-input"
                          placeholder="+ pages today"
                          value={pageInputs[b.id] || ''}
                          onChange={(e) => setPageInputs((v) => ({ ...v, [b.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && logPages(b)}
                        />
                        <button className="btn-check log-value-btn" onClick={() => logPages(b)}>Log</button>
                      </div>
                      <div className="habit-actions">
                        <button className="btn-check btn-check-done" onClick={() => markFinished(b)}>✓ Mark finished</button>
                        <button className="btn-delete-small" onClick={() => openEdit(b)}>Edit</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {toBeRead.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">TO BE READ</p>
              <div className="finished-shelf">
                {toBeRead.map((b) => (
                  <div className="library-card library-card-small tbr-card" key={b.id}>
                    <h3 className="contact-name" title={b.title} onClick={() => openEdit(b)}>{b.title}</h3>
                    {b.author && <p className="contact-relationship">{b.author}</p>}
                    {seriesLabel(b) && <p className="habit-schedule">📖 {seriesLabel(b)}</p>}
                    {b.pages && <p className="habit-dates">{b.pages} pages</p>}
                    <button className="btn-check tbr-start-btn" onClick={() => startReading(b)}>Start reading</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {finishedBooks.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">RECENTLY FINISHED</p>
              <div className="finished-shelf">
                {[...finishedBooks].sort((a, b) => new Date(b.finish_date) - new Date(a.finish_date)).slice(0, 8).map((b) => (
                  <div className="library-card library-card-small" key={b.id} onClick={() => openEdit(b)}>
                    <h3 className="contact-name" title={b.title}>{b.title}</h3>
                    {b.author && <p className="contact-relationship">{b.author}</p>}
                      {seriesLabel(b) && <p className="habit-schedule">📖 {seriesLabel(b)}</p>}
                    {b.rating != null && <p className="booknook-rating">{'⭐'.repeat(Math.round(b.rating))}</p>}
                    <p className="habit-dates">Finished {formatDate(b.finish_date)}</p>
                    {b.favorite_quote && (
                      <p className="quote-stationery">"{b.favorite_quote}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {finishedThisMonth.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">{monthName.toUpperCase()} WRAP-UP</p>
              <div className="calendar-card">
                <div className="goals-summary-row">
                  <span className="goals-summary-label">Books Read</span>
                  <span className="goals-summary-value">{finishedThisMonth.length}</span>
                </div>
                <div className="goals-summary-row">
                  <span className="goals-summary-label">Pages</span>
                  <span className="goals-summary-value">{pagesThisMonth.toLocaleString()}</span>
                </div>
                {favoriteThisMonth && (
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">Favourite</span>
                    <span className="goals-summary-value">{favoriteThisMonth.title}</span>
                  </div>
                )}
                {avgRatingThisMonth && (
                  <div className="goals-summary-row">
                    <span className="goals-summary-label">Average Rating</span>
                    <span className="goals-summary-value">⭐{avgRatingThisMonth}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {finishedBooks.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">STATISTICS</p>
              <p className="field-hint">Because numbers are fun.</p>
              <div className="calendar-card">
                {mostGenre && (
                  <div className="goals-summary-row"><span className="goals-summary-label">Most Read Genre</span><span className="goals-summary-value">{mostGenre}</span></div>
                )}
                {longestBook && (
                  <div className="goals-summary-row"><span className="goals-summary-label">Longest Book</span><span className="goals-summary-value">{longestBook.title} ({longestBook.pages}p)</span></div>
                )}
                {shortestBook && (
                  <div className="goals-summary-row"><span className="goals-summary-label">Shortest Book</span><span className="goals-summary-value">{shortestBook.title} ({shortestBook.pages}p)</span></div>
                )}
                {avgRating && (
                  <div className="goals-summary-row"><span className="goals-summary-label">Average Rating</span><span className="goals-summary-value">⭐{avgRating}</span></div>
                )}
                {avgPages && (
                  <div className="goals-summary-row"><span className="goals-summary-label">Average Pages</span><span className="goals-summary-value">{avgPages}</span></div>
                )}
                {fastestRead && (
                  <div className="goals-summary-row"><span className="goals-summary-label">Fastest Read</span><span className="goals-summary-value">{fastestRead.book.title} ({fastestRead.days}d)</span></div>
                )}
                {mostAuthor && (
                  <div className="goals-summary-row"><span className="goals-summary-label">Favourite Author</span><span className="goals-summary-value">{mostAuthor}</span></div>
                )}
                <div className="goals-summary-row"><span className="goals-summary-label">Reading Time</span><span className="goals-summary-value">~{totalReadingDays} days</span></div>
              </div>
            </div>
          )}

          {finishedThisYear.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">{thisYear} SHELF</p>
              <div className="calendar-card year-shelf-card">
                <div className="year-shelf-row">
                  {finishedThisYear.map((b) => (
                    <span key={b.id} title={b.title} className="year-shelf-book">📚</span>
                  ))}
                </div>
                <p className="progress-label">{finishedThisYear.length} book{finishedThisYear.length === 1 ? '' : 's'}</p>
              </div>
            </div>
          )}

          {journey.length > 0 && (
            <div className="upnext-section">
              <p className="module-group-label">YOUR READING JOURNEY</p>
              <div className="reading-journey">
                {journey.map((b) => (
                  <div className="journey-item" key={b.id}>
                    <div className="journey-dot" />
                    <div className="journey-content">
                      <p className="journey-title">{b.title}{b.author ? ` — ${b.author}` : ''}</p>
                      <p className="journey-date">{formatDate(b.finish_date)}{b.rating != null ? ` · ${'⭐'.repeat(Math.round(b.rating))}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {books.length === 0 && (
            <div className="empty-state">
              <h3>Your shelf is empty ✨</h3>
              <p>Add the first book you're reading, or one you've already finished.</p>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit book' : 'New book'}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Title</label>
                <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Book title" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Author</label>
                  <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Author name" />
                </div>
                <div className="field">
                  <label>Genre</label>
                  <input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Fiction, romance…" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Series (optional)</label>
                  <input value={form.series_name} onChange={(e) => setForm({ ...form, series_name: e.target.value })} placeholder="e.g. Harry Potter" />
                </div>
                <div className="field">
                  <label>Book #</label>
                  <input type="number" min="1" value={form.series_number} onChange={(e) => setForm({ ...form, series_number: e.target.value })} placeholder="e.g. 3" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Pages</label>
                  <input type="number" value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} placeholder="e.g. 320" />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="want_to_read">Want to read</option>
                    <option value="reading">Reading</option>
                    <option value="finished">Finished</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Start date</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="field">
                  <label>Finish date</label>
                  <input type="date" value={form.finish_date} onChange={(e) => setForm({ ...form, finish_date: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Rating (1-5)</label>
                <input type="number" min="1" max="5" step="0.5" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
              </div>
              <div className="field">
                <label>Favourite quote</label>
                <textarea value={form.favorite_quote} onChange={(e) => setForm({ ...form, favorite_quote: e.target.value })} placeholder="A line worth remembering…" />
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Thoughts, recommendations…" />
              </div>
              <div className="modal-actions">
                <div>
                  {editingId && <button type="button" className="btn-delete" onClick={handleDelete} disabled={saving}>Delete</button>}
                </div>
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
