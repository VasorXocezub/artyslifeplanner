import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/currency'

const MODULES = [
  {
    group: 'PEOPLE',
    items: [
      { key: 'contacts', title: '🎂 Cake Club', desc: 'Never miss a cake day 🎂', enabled: true, accent: '#D9A8B8', tint: '#FBF3F6' },
    ],
  },
  {
    group: 'GROWTH',
    items: [
      { key: 'goals', title: 'Goals', desc: 'Big dreams, tiny steps ✨', enabled: true, accent: '#243B63', tint: '#F6F4FA' },
      { key: 'habits', title: 'Habits', desc: 'Streaks worth bragging about 🔥', enabled: true, accent: '#C98A72', tint: '#FBF3EF' },
      { key: 'todos', title: 'To-Do', desc: 'One thing at a time, bestie 📋', enabled: true, accent: '#E9C86A', tint: '#FCF8EC' },
    ],
  },
  {
    group: 'MONEY',
    items: [
      { key: 'finances', title: 'Finances', desc: 'Where your money runs off to 💸', enabled: true, accent: '#AFC6DD', tint: '#F3F7FB' },
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
        <h1 className="hero-title">{getGreeting()}, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'}.</h1>
        <p className="hero-date">{todayLabel}</p>
      </div>

      {!loading && (
        <div className="stat-strip">
          {!hiddenModules.includes('contacts') && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#D9A8B8' }} />
              {birthdayLabel()}
            </div>
          )}
          {!hiddenModules.includes('contacts') && stats.birthdaysThisMonth.length > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#E9C86A' }} />
              🎉 {stats.birthdaysThisMonth.length} birthday{stats.birthdaysThisMonth.length > 1 ? 's' : ''} this month
            </div>
          )}
          {!hiddenModules.includes('goals') && stats.goalsInProgress > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#AFC6DD' }} />
              🚀 {stats.goalsInProgress} goal{stats.goalsInProgress > 1 ? 's' : ''} in motion
            </div>
          )}
          {!hiddenModules.includes('habits') && stats.habitsTotal > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#C98A72' }} />
              🔥 {stats.habitsDoneToday}/{stats.habitsTotal} habits done today
            </div>
          )}
          {!hiddenModules.includes('finances') && stats.hasTransactions && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: stats.netBalance >= 0 ? '#1B2E4A' : '#C98A72' }} />
              💸 {formatMoney(stats.netBalance, user?.user_metadata?.currency)} net
            </div>
          )}
          {!hiddenModules.includes('finances') && stats.hasSavings && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#AFC6DD' }} />
              🐷 {formatMoney(stats.totalSaved, user?.user_metadata?.currency)} saved
            </div>
          )}
          {!hiddenModules.includes('todos') && stats.todosOpen > 0 && (
            <div className="stat-pill">
              <span className="stat-dot" style={{ background: '#243B63' }} />
              📋 {stats.todosOpen} to-do{stats.todosOpen > 1 ? 's' : ''} open
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
