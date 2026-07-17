import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { getEra, setEra as saveEra } from './lib/localPrefs'
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
  'Make your energy the prettiest thing about you.',
  'The Plot Twist? She became everything she said she would.',
  'Girl, date yourself.',
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
    group: 'WELLNESS',
    items: [
      { key: 'glowup', title: 'Glow Up Hub', desc: 'Hydrated, moved, glowing ✨', enabled: true, accent: '#D9A8B8', tint: '#FBF3F6' },
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

  const dayNumber = Math.floor(Date.now() / 86400000)
  const msgIndex = ((dayNumber % ROTATING_MESSAGES.length) + ROTATING_MESSAGES.length) % ROTATING_MESSAGES.length

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
    shoppingPlanned: 0,
    shoppingGroceries: 0,
    currentlyReadingBook: null,
    booksReadThisYear: 0,
    wellness: null,
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
    const todayIso = new Date().toISOString().split('T')[0]
    const { data: wellnessData } = await supabase.from('wellness_logs').select('*').eq('log_date', todayIso).maybeSingle()

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
    const shoppingPlanned = (shoppingData || []).filter((s) => s.category === 'planned').length
    const shoppingGroceries = (shoppingData || []).filter((s) => s.category === 'groceries').length

    const readingBook = (booksData || []).find((b) => b.status === 'reading')
    const currentlyReadingBook = readingBook
      ? { title: readingBook.title, pct: readingBook.pages ? Math.min(100, Math.round((Number(readingBook.current_page || 0) / readingBook.pages) * 100)) : 0 }
      : null
    const booksReadThisYear = (booksData || []).filter(
      (b) => b.status === 'finished' && b.finish_date && new Date(b.finish_date + 'T00:00:00').getFullYear() === now.getFullYear()
    ).length

    setStats({ nextBirthday, birthdaysThisMonth, goalsInProgress, habitsDoneToday, habitsTotal, netBalance, hasTransactions, totalSaved, hasSavings, todosOpen, shoppingOpen, shoppingPlanned, shoppingGroceries, currentlyReadingBook, booksReadThisYear, wellness: wellnessData || null })
    setLoading(false)
  }

  function birthdayLabel() {
    if (!stats.nextBirthday) return '🎂 No birthdays saved yet'
    const { name, daysAway } = stats.nextBirthday
    if (daysAway === 0) return `🎂 It's ${name}'s birthday today!`
    if (daysAway === 1) return `🎂 ${name}'s birthday is tomorrow`
    return `🎂 ${name}'s birthday in ${daysAway} days`
  }

  const currentEraLabel = ERAS.find((e) => e.key === era)?.label || '✨ Your Era'
  const currency = user?.user_metadata?.currency

  const statCandidates = []
  if (!hiddenModules.includes('contacts') && stats.nextBirthday) {
    statCandidates.push({ key: 'birthday', icon: '🎂', text: birthdayLabel().replace('🎂 ', ''), color: '#B896C9' })
  }
  if (!hiddenModules.includes('habits') && stats.habitsDoneToday > 0) {
    statCandidates.push({ key: 'habits', icon: '🌸', text: `${stats.habitsDoneToday} habit${stats.habitsDoneToday > 1 ? 's' : ''} checked off, bestie`, color: '#1E5C57' })
  }
  if (!hiddenModules.includes('finances') && stats.hasTransactions) {
    statCandidates.push({ key: 'net', icon: '🎀', text: `Spending power: ${formatMoney(stats.netBalance, currency)}`, color: '#164641' })
  }
  if (!hiddenModules.includes('finances') && stats.hasSavings) {
    statCandidates.push({ key: 'savings', icon: '✨', text: `${currentEraLabel}: ${formatMoney(stats.totalSaved, currency)} saved`, color: '#B896C9' })
  }
  if (!hiddenModules.includes('goals') && stats.goalsInProgress > 0) {
    statCandidates.push({ key: 'goals', icon: '🎯', text: `${stats.goalsInProgress} win${stats.goalsInProgress > 1 ? 's' : ''} waiting for you`, color: '#1E5C57' })
  }
  if (!hiddenModules.includes('glowup') && stats.wellness?.steps > 0) {
    statCandidates.push({ key: 'steps', icon: '🚶', text: `Walking Queen: ${Number(stats.wellness.steps).toLocaleString()} steps`, color: '#1E5C57' })
  }
  if (!hiddenModules.includes('booknook') && stats.currentlyReadingBook) {
    statCandidates.push({ key: 'reading', icon: '📚', text: `${stats.currentlyReadingBook.pct}% into "${stats.currentlyReadingBook.title}"`, color: '#8FC2BE' })
  }
  if (!hiddenModules.includes('shopping') && stats.shoppingPlanned > 0) {
    statCandidates.push({ key: 'wishlist', icon: '💖', text: `${stats.shoppingPlanned} wish${stats.shoppingPlanned > 1 ? 'es' : ''} on your list`, color: '#D9A8B8' })
  }
  if (!hiddenModules.includes('shopping') && stats.shoppingGroceries > 0) {
    statCandidates.push({ key: 'groceries', icon: '🍓', text: `${stats.shoppingGroceries} goodie${stats.shoppingGroceries > 1 ? 's' : ''} to grab`, color: '#C98A72' })
  }
  if (!hiddenModules.includes('todos') && stats.todosOpen > 0) {
    statCandidates.push({ key: 'todos', icon: '📋', text: `${stats.todosOpen} thing${stats.todosOpen > 1 ? 's' : ''} on your to-do list`, color: '#1E5C57' })
  }
  if (!hiddenModules.includes('contacts') && stats.birthdaysThisMonth.length > 0) {
    statCandidates.push({ key: 'birthdays-month', icon: '🎉', text: `${stats.birthdaysThisMonth.length} birthday${stats.birthdaysThisMonth.length > 1 ? 's' : ''} this month`, color: '#8FC2BE' })
  }

  const heroStat = statCandidates[0]
  const secondaryStats = statCandidates.slice(1)

  return (
    <div>
      <div className="hero-panel">
        <div className="hero-panel-main">
          <h1 className="hero-title">{getGreeting()}, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'}.</h1>
          <div className="era-picker era-picker-inline">
            <span>In My</span>
            <select value={era} onChange={handleEraChange}>
              {ERAS.map((e) => (
                <option key={e.key} value={e.key}>{e.label}</option>
              ))}
            </select>
          </div>
          <div className="hero-divider" />
          <WeatherWidget user={user} />
        </div>
        <div className="hero-quote-card" key={msgIndex}>
          <p className="hero-quote-label">💌 Today's Note</p>
          <p className="hero-quote-text">"{ROTATING_MESSAGES[msgIndex]}"</p>
        </div>
      </div>

      {!loading && statCandidates.length > 0 && (
        <div className="hero-stat-section">
          {heroStat && (
            <div className="hero-stat-card" style={{ '--hero-accent': heroStat.color }}>
              <span className="hero-stat-icon">{heroStat.icon}</span>
              <p className="hero-stat-text">{heroStat.text}</p>
            </div>
          )}
          {secondaryStats.length > 0 && (
            <div className="stat-strip">
              {secondaryStats.map((s) => (
                <div className="stat-pill" key={s.key}>
                  <span className="stat-dot" style={{ background: s.color }} />
                  {s.icon} {s.text}
                </div>
              ))}
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
                  <p>{m.desc}</p>
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
