import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { getEra, setEra as saveEra, getReadingGoal } from './lib/localPrefs'
import WeatherWidget from './WeatherWidget'

const ERAS = [
  { key: 'rich_girl', label: '💅 Rich Girl Era' },
  { key: 'soft_life', label: '✨ Soft Life Era' },
  { key: 'revenge_body', label: '🔥 Revenge Body Era' },
  { key: 'passport', label: '🌍 Passport Era' },
  { key: 'peace', label: '🧘 Peace Era' },
  { key: 'empire', label: '🚀 Empire Era' },
]

const ROTATING_MESSAGES = [
  "I'm literally just a girl.",
  "Keepin' It Cute Today.",
  'You Can Do Great Things!',
  'Romanticise Your Everyday.',
  'Be a little kinder to yourself.',
  'Make your heart the prettiest thing about you.',
  'I refuse to lose my whimsy.',
  'Manifest Your Dreams!',
  'Strong Girls Club',
  'Keep On Smiling',
  'In My Happy Girl Era',
  'Girl, you already have what it takes!',
  "Don't forget to celebrate the little wins!",
  'You are capable of amazing things!',
]

const MODULES = [
  {
    group: 'PEOPLE',
    items: [
      { key: 'contacts', title: 'Cake Club', desc: 'Never miss a cake day 🎂', enabled: true, accent: '#B896C9', tint: '#F0E8F5' },
    ],
  },
  {
    group: 'GROWTH',
    items: [
      { key: 'goals', title: 'Goals', desc: 'Big dreams, tiny steps ✨', enabled: true, accent: '#1E5C57', tint: '#E3F0EE' },
      { key: 'habits', title: 'Habits', desc: 'Streaks worth bragging about 🔥', enabled: true, accent: '#1E5C57', tint: '#EAF5F3' },
      { key: 'todos', title: 'To-Do', desc: 'One thing at a time, bestie 📋', enabled: true, accent: '#8FC2BE', tint: '#EAF5F3' },
    ],
  },
  {
    group: 'READING',
    items: [
      { key: 'booknook', title: 'Book Nook', desc: 'I\'d rather be reading 📖', enabled: true, accent: '#1E5C57', tint: '#E3F0EE' },
    ],
  },
  {
    group: 'MONEY',
    items: [
      { key: 'finances', title: 'Finances', desc: 'Where your money runs off to 💸', enabled: true, accent: '#1E5C57', tint: '#F7EFDF' },
      { key: 'shopping', title: 'Shopping List', desc: 'Groceries + wishlist, cutely 🛍️', enabled: true, accent: '#B896C9', tint: '#F0E8F5' },
    ],
  },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Rise and shine'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard({ onNavigate, user, hiddenModules = [] }) {
  const [era, setEraState] = useState(getEra())
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % ROTATING_MESSAGES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  function handleEraChange(e) {
    const value = e.target.value
    setEraState(value)
    saveEra(value)
  }

  const [stats, setStats] = useState({
    nextBirthday: null,
    birthdaysThisMonth: [],
    goalsInProgress: 0,
    habitsDoneToday: 0,
    habitsTotal: 0,
    netBalance: 0,
    hasTransactions: false,
    totalSaved: 0,
    hasSavings: false,
    todosOpen: 0,
    shoppingOpen: 0,
    currentlyReadingBook: null,
    booksReadThisYear: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    const { data, error } = await supabase.from('contacts').select('*')
    const { data: goalsData } = await supabase.from('goals').select('*')
    const { data: habitsData } = await supabase.from('habits').select('*')
    const { data: habitLogsData } = await supabase.from('habit_logs').select('*')
    const { data: transactionsData } = await supabase.from('transactions').select('*')
    const { data: savingsData } = await supabase.from('savings_goals').select('*')
    const { data: todosData } = await supabase.from('todos').select('*').eq('completed', false)
    const { data: shoppingData } = await supabase.from('shopping_items').select('*').eq('completed', false)
    const { data: booksData } = await supabase.from('books').select('*')

    if (error || !data) {
      setLoading(false)
      return
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisMonth = now.getMonth()

    const birthdaysThisMonth = data.filter((c) => {
      if (!c.birthday) return false
      const bd = new Date(c.birthday + 'T00:00:00')
      return bd.getMonth() === thisMonth
    })

    const withBirthdays = data
      .filter((c) => c.birthday)
      .map((c) => {
        const bd = new Date(c.birthday + 'T00:00:00')
        let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
        if (next < today) next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate())
        const daysAway = Math.round((next - today) / (1000 * 60 * 60 * 24))
        return { name: c.name, daysAway }
      })
      .sort((a, b) => a.daysAway - b.daysAway)

    const nextBirthday = withBirthdays[0] || null

    const goalsInProgress = (goalsData || []).filter((g) => g.status === 'in_progress').length

    const todayStr = now.toISOString().split('T')[0]
    const habitsDoneToday = (habitLogsData || []).filter((l) => l.logged_date === todayStr).length
    const habitsTotal = (habitsData || []).length

    const netBalance = (transactionsData || []).reduce((acc, t) => {
      return t.type === 'income' ? acc + Number(t.amount) : acc - Number(t.amount)
    }, 0)
    const hasTransactions = (transactionsData || []).length > 0

    const totalSaved = (savingsData || []).reduce((acc, g) => acc + Number(g.current_amount || 0), 0)
    const hasSavings = (savingsData || []).length > 0
    const todosOpen = (todosData || []).length
    const shoppingOpen = (shoppingData || []).length

    const readingBook = (booksData || []).find((b) => b.status === 'reading')
    const currentlyReadingBook = readingBook
      ? { title: readingBook.title, pct: readingBook.pages ? Math.min(100, Math.round((Number(readingBook.current_page || 0) / readingBook.pages) * 100)) : 0 }
      : null
    const booksReadThisYear = (booksData || []).filter(
      (b) => b.status === 'finished' && b.finish_date && new Date(b.finish_date + 'T00:00:00').getFullYear() === now.getFullYear()
    ).length

    setStats({ nextBirthday, birthdaysThisMonth, goalsInProgress, habitsDoneToday, habitsTotal, netBalance, hasTransactions, totalSaved, hasSavings, todosOpen, shoppingOpen, currentlyReadingBook, booksReadThisYear })
    setLoading(false)
  }

  function birthdayLabel() {
    if (!stats.nextBirthday) return '🎂 No birthdays saved yet'
    const { name, daysAway } = stats.nextBirthday
    if (daysAway === 0) return `🎂 It's ${name}'s birthday today!`
    if (daysAway === 1) return `🎂 ${name}'s birthday is tomorrow`
    return `🎂 ${name}'s birthday in ${daysAway} days`
  }

  return (
    <div>
      <div className="hero-panel">
        <h1 className="hero-title">{getGreeting()}, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'}.</h1>
        <WeatherWidget />
        <div className="era-picker">
          <label>Current era</label>
          <select value={era} onChange={handleEraChange}>
            {ERAS.map((e) => (
              <option key={e.key} value={e.key}>{e.label}</option>
            ))}
          </select>
        </div>
        <p className="hero-rotating-msg" key={msgIndex}>{ROTATING_MESSAGES[msgIndex]}</p>
      </div>

      {!loading && (
        <div className="stat-strip">
          {!hiddenModules.includes('contacts') && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#B896C9' }} />
              {birthdayLabel()}
            </div>
          )}
          {!hiddenModules.includes('contacts') && stats.birthdaysThisMonth.length > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#8FC2BE' }} />
              🎉 {stats.birthdaysThisMonth.length} birthday{stats.birthdaysThisMonth.length > 1 ? 's' : ''} this month
            </div>
          )}
          {!hiddenModules.includes('goals') && stats.goalsInProgress > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#1E5C57' }} />
              🚀 {stats.goalsInProgress} goal{stats.goalsInProgress > 1 ? 's' : ''} in motion
            </div>
          )}
          {!hiddenModules.includes('habits') && stats.habitsTotal > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#1E5C57' }} />
              🔥 {stats.habitsDoneToday}/{stats.habitsTotal} habits done today
            </div>
          )}
          {!hiddenModules.includes('finances') && stats.hasTransactions && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: stats.netBalance >= 0 ? '#164641' : '#1E5C57' }} />
              💸 {formatMoney(stats.netBalance, user?.user_metadata?.currency)} net
            </div>
          )}
          {!hiddenModules.includes('finances') && stats.hasSavings && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#1E5C57' }} />
              🐷 {formatMoney(stats.totalSaved, user?.user_metadata?.currency)} saved
            </div>
          )}
          {!hiddenModules.includes('todos') && stats.todosOpen > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#1E5C57' }} />
              📋 {stats.todosOpen} to-do{stats.todosOpen > 1 ? 's' : ''} open
            </div>
          )}
          {!hiddenModules.includes('shopping') && stats.shoppingOpen > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#B896C9' }} />
              🛍️ {stats.shoppingOpen} on your list
            </div>
          )}
        </div>
      )}

      {MODULES.map((group) => {
        const visibleItems = group.items.filter((m) => !hiddenModules.includes(m.key))
        if (visibleItems.length === 0) return null
        return (
          <div key={group.group} className="module-section">
            <p className="module-group-label">{group.group}</p>
            <div className="module-grid">
              {visibleItems.map((m) => (
                <button
                  key={m.key}
                  className={`module-card ${!m.enabled ? 'module-card-disabled' : ''}`}
                  style={{ '--card-accent': m.accent, background: m.tint || 'var(--surface)' }}
                  onClick={() => m.enabled && onNavigate(m.key)}
                  disabled={!m.enabled}
                >
                  <span className="module-accent-bar" />
                  <h3>{m.title}</h3>
                  {m.key === 'booknook' ? (
                    <div className="booknook-preview">
                      {stats.currentlyReadingBook ? (
                        <>
                          <p className="booknook-preview-label">Currently Reading</p>
                          <p className="booknook-preview-title">{stats.currentlyReadingBook.title}</p>
                          <p className="booknook-preview-pct">{stats.currentlyReadingBook.pct}%</p>
                        </>
                      ) : (
                        <p className="booknook-preview-title">{m.desc}</p>
                      )}
                      <p className="booknook-preview-label">Goal</p>
                      <p className="booknook-preview-goal">{stats.booksReadThisYear} / {getReadingGoal()} Books</p>
                    </div>
                  ) : (
                    <p>{m.desc}</p>
                  )}
                  <span className="module-link">{m.enabled ? 'Open →' : 'Coming soon'}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
