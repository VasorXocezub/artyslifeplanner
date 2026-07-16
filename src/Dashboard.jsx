import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatZAR } from './lib/currency'

const MODULES = [
  {
    group: 'PEOPLE',
    items: [
      { key: 'contacts', title: 'Birthdays', desc: 'Never miss a cake day 🎂', enabled: true, accent: '#F2B6C6' },
    ],
  },
  {
    group: 'GROWTH',
    items: [
      { key: 'goals', title: 'Goals', desc: 'Big dreams, tiny steps 🌱', enabled: true, accent: '#1B3A5C' },
      { key: 'habits', title: 'Habits', desc: 'Streaks worth bragging about 🔥', enabled: true, accent: '#EF7B4D' },
      { key: 'todos', title: 'To-Do', desc: 'One thing at a time 📋', enabled: true, accent: '#F2B6C6' },
    ],
  },
  {
    group: 'MONEY',
    items: [
      { key: 'finances', title: 'Finances', desc: 'Where your money runs off to 💸', enabled: true, accent: '#3D6FB4' },
    ],
  },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Rise and shine'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard({ onNavigate, user }) {
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

    setStats({ nextBirthday, birthdaysThisMonth, goalsInProgress, habitsDoneToday, habitsTotal, netBalance, hasTransactions, totalSaved, hasSavings, todosOpen })
    setLoading(false)
  }

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

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
        <p className="hero-eyebrow">{getGreeting()}</p>
        <h1 className="hero-title">Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'}.</h1>
        <p className="hero-date">{todayLabel}</p>
      </div>

      {!loading && (
        <div className="stat-strip">
          <div className="stat-pill">
            <span className="stat-dot" style={{ background: '#F2B6C6' }} />
            {birthdayLabel()}
          </div>
          {stats.birthdaysThisMonth.length > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#EF7B4D' }} />
              🎉 {stats.birthdaysThisMonth.length} birthday{stats.birthdaysThisMonth.length > 1 ? 's' : ''} this month
            </div>
          )}
          {stats.goalsInProgress > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#3D6FB4' }} />
              🚀 {stats.goalsInProgress} goal{stats.goalsInProgress > 1 ? 's' : ''} in motion
            </div>
          )}
          {stats.habitsTotal > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#F2B6C6' }} />
              🔥 {stats.habitsDoneToday}/{stats.habitsTotal} habits done today
            </div>
          )}
          {stats.hasTransactions && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: stats.netBalance >= 0 ? '#2E5A96' : '#D64545' }} />
              💸 {formatZAR(stats.netBalance)} net
            </div>
          )}
          {stats.hasSavings && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#3D6FB4' }} />
              🐷 {formatZAR(stats.totalSaved)} saved
            </div>
          )}
          {stats.todosOpen > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#EF7B4D' }} />
              📋 {stats.todosOpen} to-do{stats.todosOpen > 1 ? 's' : ''} open
            </div>
          )}
        </div>
      )}

      {MODULES.map((group) => (
        <div key={group.group} className="module-section">
          <p className="module-group-label">{group.group}</p>
          <div className="module-grid">
            {group.items.map((m) => (
              <button
                key={m.key}
                className={`module-card ${!m.enabled ? 'module-card-disabled' : ''}`}
                style={{ '--card-accent': m.accent }}
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
      ))}
    </div>
  )
}
