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
  { text: "I'm literally just a girl.", highlight: 'just a girl' },
  { text: "Keepin' It Cute Today.", highlight: 'Cute' },
  { text: 'You Can Do Great Things!', highlight: 'Great Things' },
  { text: 'Romanticise Your Everyday.', highlight: 'Romanticise' },
  { text: 'Be a little kinder to yourself.', highlight: 'kinder' },
  { text: 'Make your heart the prettiest thing about you.', highlight: 'prettiest' },
  { text: 'I refuse to lose my whimsy.', highlight: 'whimsy' },
  { text: 'Manifest Your Dreams!', highlight: 'Manifest' },
  { text: 'Strong Girls Club', highlight: 'Strong' },
  { text: 'Keep On Smiling', highlight: 'Smiling' },
  { text: 'In My Happy Girl Era', highlight: 'Happy' },
  { text: 'Girl, you already have what it takes!', highlight: 'what it takes' },
  { text: "Don't forget to celebrate the little wins!", highlight: 'celebrate' },
  { text: 'You are capable of amazing things!', highlight: 'amazing' },
  { text: 'Make your energy the prettiest thing about you.', highlight: 'energy' },
  { text: 'The Plot Twist? She became everything she said she would.', highlight: 'Plot Twist' },
  { text: 'Girl, date yourself.', highlight: 'date yourself' },
]

const MODULES = [
  {
    group: 'PEOPLE',
    items: [
      { key: 'contacts', title: 'Cake Club', desc: 'Because panic-buying gifts isn\'t a personality trait. 🎁', enabled: true, accent: '#B896C9', tint: '#F0E8F5' },
      { key: 'social', title: 'Social Club', desc: '🌸 The group chat\'s HR department.', enabled: true, accent: '#C98A72', tint: '#FBF3EF' },
    ],
  },
  {
    group: 'GROWTH',
    items: [
      { key: 'goals', title: 'Dream Board', desc: 'Delulu? No. Visionary. ✨', enabled: true, accent: '#1E5C57', tint: '#E3F0EE' },
      { key: 'habits', title: 'Daily Habits', desc: '✨ Romanticizing basic human maintenance.', enabled: true, accent: '#1E5C57', tint: '#EAF5F3' },
      { key: 'todos', title: 'To-Do List', desc: '🫡 Unfortunately, I assigned this to myself.', enabled: true, accent: '#8FC2BE', tint: '#EAF5F3' },
    ],
  },
  {
    group: 'READING',
    items: [
      { key: 'booknook', title: 'Book Nook', desc: '💌 In a committed relationship with fictional characters.', enabled: true, accent: '#1E5C57', tint: '#E3F0EE' },
    ],
  },
  {
    group: 'WELLNESS',
    items: [
      { key: 'glowup', title: 'Glow Up Hub', desc: 'Mind, body and main character energy. ✨', enabled: true, accent: '#D9A8B8', tint: '#FBF3F6' },
    ],
  },
  {
    group: 'MONEY',
    items: [
      { key: 'finances', title: 'Rich Girl Era', desc: '💸 We listen and we don\'t judge.', enabled: true, accent: '#1E5C57', tint: '#F7EFDF' },
      { key: 'shopping', title: 'Kitchen Club', desc: '🍓 Girl dinner is not a food group.', enabled: true, accent: '#B896C9', tint: '#F0E8F5' },
      { key: 'wishlist', title: 'Wishlist', desc: '🎀 Manifesting these into my cart.', enabled: true, accent: '#D9A8B8', tint: '#FBF3F6' },
    ],
  },
]

function renderQuote(msg) {
  if (!msg.highlight) return msg.text
  const idx = msg.text.indexOf(msg.highlight)
  if (idx === -1) return msg.text
  const before = msg.text.slice(0, idx)
  const after = msg.text.slice(idx + msg.highlight.length)
  return (
    <>
      {before}
      <span className="hero-quote-highlight">{msg.highlight}</span>
      {after}
    </>
  )
}

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
    nextSocialEvent: null,
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
    const { data: socialData } = await supabase.from('social_events').select('*').gte('event_date', todayIso).order('event_date', { ascending: true }).limit(1)

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

    const nextSocialEvent = (socialData || [])[0]
      ? (() => {
          const ev = socialData[0]
          const evDate = new Date(ev.event_date + 'T00:00:00')
          const daysAway = Math.round((evDate - new Date(new Date().toDateString())) / 86400000)
          return { title: ev.title, daysAway }
        })()
      : null

    setStats({ nextBirthday, birthdaysThisMonth, goalsInProgress, habitsDoneToday, habitsTotal, netBalance, hasTransactions, totalSaved, hasSavings, todosOpen, shoppingOpen, shoppingPlanned, shoppingGroceries, currentlyReadingBook, booksReadThisYear, wellness: wellnessData || null, nextSocialEvent })
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
    const { name, daysAway } = stats.nextBirthday
    const subtitle = daysAway <= 14
      ? 'Time to start planning something special 💖'
      : daysAway <= 30
      ? "It's getting close — start thinking gifts 🎁"
      : 'On the horizon — plenty of time to plan ✨'
    statCandidates.push({
      key: 'birthday', nav: 'contacts', icon: '🎂', title: `${name}'s Birthday`,
      bigNumber: daysAway, unit: daysAway === 1 ? 'day to go' : 'days to go',
      subtitle, progressPct: Math.max(2, Math.round(((365 - Math.min(daysAway, 365)) / 365) * 100)),
      color: '#D9A8B8', insight: birthdayLabel().replace('🎂 ', ''),
    })
  }
  if (!hiddenModules.includes('habits') && stats.habitsDoneToday > 0) {
    statCandidates.push({
      key: 'habits', nav: 'habits', icon: '🌸', title: 'Habits',
      bigNumber: stats.habitsDoneToday, unit: stats.habitsDoneToday === 1 ? 'habit checked off' : 'habits checked off',
      subtitle: 'Look at you go, bestie ✨',
      progressPct: stats.habitsTotal > 0 ? Math.round((stats.habitsDoneToday / stats.habitsTotal) * 100) : null,
      color: '#1E5C57', insight: `${stats.habitsDoneToday} habit${stats.habitsDoneToday > 1 ? 's' : ''} checked off, bestie`,
    })
  }
  if (!hiddenModules.includes('finances') && stats.hasTransactions) {
    statCandidates.push({
      key: 'net', nav: 'finances', icon: '🎀', title: 'Spending Power',
      bigNumber: formatMoney(stats.netBalance, currency), unit: '',
      subtitle: "You're keeping it cute with your money 💅",
      progressPct: null, color: '#164641', insight: `Spending power: ${formatMoney(stats.netBalance, currency)}`,
    })
  }
  if (!hiddenModules.includes('finances') && stats.hasSavings) {
    statCandidates.push({
      key: 'savings', nav: 'finances', icon: '✨', title: currentEraLabel,
      bigNumber: formatMoney(stats.totalSaved, currency), unit: 'saved',
      subtitle: 'Every little bit adds up to something big 🌷',
      progressPct: null, color: '#B896C9', insight: `${currentEraLabel}: ${formatMoney(stats.totalSaved, currency)} saved`,
    })
  }
  if (!hiddenModules.includes('goals') && stats.goalsInProgress > 0) {
    statCandidates.push({
      key: 'goals', nav: 'goals', icon: '🎯', title: 'Your Goals',
      bigNumber: stats.goalsInProgress, unit: stats.goalsInProgress === 1 ? 'win waiting' : 'wins waiting',
      subtitle: 'Your dreams are so close, keep going ✨',
      progressPct: null, color: '#1E5C57', insight: `${stats.goalsInProgress} win${stats.goalsInProgress > 1 ? 's' : ''} waiting for you`,
    })
  }
  if (!hiddenModules.includes('glowup') && stats.wellness?.steps > 0) {
    statCandidates.push({
      key: 'steps', nav: 'glowup', icon: '🚶', title: 'Walking Queen',
      bigNumber: Number(stats.wellness.steps).toLocaleString(), unit: 'steps',
      subtitle: 'Every step is a step toward glowing ✨',
      progressPct: Math.min(100, Math.round((stats.wellness.steps / (stats.wellness.steps_goal || 10000)) * 100)),
      color: '#1E5C57', insight: `Walking Queen: ${Number(stats.wellness.steps).toLocaleString()} steps`,
    })
  }
  if (!hiddenModules.includes('booknook') && stats.currentlyReadingBook) {
    statCandidates.push({
      key: 'reading', nav: 'booknook', icon: '📚', title: stats.currentlyReadingBook.title,
      bigNumber: stats.currentlyReadingBook.pct, unit: '% through',
      subtitle: 'A little escape is always worth it 📖',
      progressPct: stats.currentlyReadingBook.pct, color: '#8FC2BE',
      insight: `${stats.currentlyReadingBook.pct}% into "${stats.currentlyReadingBook.title}"`,
    })
  }
  if (!hiddenModules.includes('social') && stats.nextSocialEvent) {
    const daysText = stats.nextSocialEvent.daysAway === 0 ? 'today' : stats.nextSocialEvent.daysAway === 1 ? 'tomorrow' : `in ${stats.nextSocialEvent.daysAway} days`
    statCandidates.push({
      key: 'social', nav: 'social', icon: '💌', title: stats.nextSocialEvent.title,
      bigNumber: stats.nextSocialEvent.daysAway, unit: 'days away',
      subtitle: "Can't wait — it's going to be so fun 🎉",
      progressPct: null, color: '#C98A72', insight: `${stats.nextSocialEvent.title} ${daysText}`,
    })
  }

  const heroFocus = statCandidates[0]

  const insightItems = []
  if (!hiddenModules.includes('habits') && heroFocus?.key !== 'habits' && stats.habitsDoneToday > 0) {
    insightItems.push({ icon: '🌸', text: `${stats.habitsDoneToday} habit${stats.habitsDoneToday > 1 ? 's' : ''} completed today`, nav: 'habits' })
  }
  if (!hiddenModules.includes('finances') && heroFocus?.key !== 'net' && stats.hasTransactions) {
    insightItems.push({ icon: '💸', text: `Spending power: ${formatMoney(stats.netBalance, currency)}`, nav: 'finances' })
  }
  if (!hiddenModules.includes('finances') && heroFocus?.key !== 'savings' && stats.hasSavings) {
    insightItems.push({ icon: '✨', text: `${formatMoney(stats.totalSaved, currency)} saved toward your goals`, nav: 'finances' })
  }
  if (!hiddenModules.includes('wishlist') && stats.shoppingPlanned > 0) {
    insightItems.push({ icon: '🎀', text: `${stats.shoppingPlanned} item${stats.shoppingPlanned > 1 ? 's' : ''} on your wishlist`, nav: 'wishlist' })
  }
  if (!hiddenModules.includes('shopping') && stats.shoppingGroceries > 0) {
    insightItems.push({ icon: '🍓', text: `${stats.shoppingGroceries} essential${stats.shoppingGroceries > 1 ? 's' : ''} to grab`, nav: 'shopping' })
  }
  if (!hiddenModules.includes('todos') && stats.todosOpen > 0) {
    insightItems.push({ icon: '📝', text: `${stats.todosOpen} task${stats.todosOpen > 1 ? 's' : ''} waiting`, nav: 'todos' })
  }
  if (!hiddenModules.includes('goals') && heroFocus?.key !== 'goals' && stats.goalsInProgress > 0) {
    insightItems.push({ icon: '🎯', text: `${stats.goalsInProgress} win${stats.goalsInProgress > 1 ? 's' : ''} waiting for you`, nav: 'goals' })
  }
  if (!hiddenModules.includes('glowup') && stats.wellness) {
    const w = stats.wellness
    const glowItems = [
      w.water_glasses >= (w.water_goal || 8),
      (w.movement_mins || 0) >= 20,
      Number(w.sleep_hours || 0) >= 7,
      !!w.mood,
    ]
    const glowPct = Math.round((glowItems.filter(Boolean).length / glowItems.length) * 100)
    if (glowPct > 0) {
      insightItems.push({ icon: '🌿', text: `Glow Score: ${glowPct}%`, nav: 'glowup' })
    }
  }
  if (!hiddenModules.includes('contacts') && stats.birthdaysThisMonth.length > 0) {
    insightItems.push({ icon: '🎉', text: `${stats.birthdaysThisMonth.length} birthday${stats.birthdaysThisMonth.length > 1 ? 's' : ''} this month`, nav: 'contacts' })
  }

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
          <p className="hero-quote-text">{renderQuote(ROTATING_MESSAGES[msgIndex])}</p>
        </div>
      </div>

      {!loading && (heroFocus || insightItems.length > 0) && (
        <>
          {heroFocus && (
            <button
              className="hero-highlight-strip"
              style={{ '--focus-accent': heroFocus.color }}
              onClick={() => heroFocus.nav && onNavigate(heroFocus.nav)}
            >
              <span className="hero-highlight-icon">{heroFocus.icon}</span>
              <span className="hero-highlight-title">{heroFocus.title}</span>
              <span className="hero-highlight-dot">•</span>
              <span className="hero-highlight-countdown">{heroFocus.bigNumber} {heroFocus.unit}</span>
              <span className="hero-highlight-dot">•</span>
              <span className="hero-highlight-subtitle">{heroFocus.subtitle}</span>
              {heroFocus.progressPct != null && (
                <div className="hero-highlight-progress-track">
                  <div className="hero-highlight-progress-fill" style={{ width: `${heroFocus.progressPct}%` }} />
                </div>
              )}
            </button>
          )}
          {insightItems.length > 0 && (
            <div className="hero-stats-grid">
              {insightItems.map((item, i) => (
                <button className="hero-stats-tile" key={i} onClick={() => item.nav && onNavigate(item.nav)}>
                  <span className="hero-stats-tile-icon">{item.icon}</span>
                  <span className="hero-stats-tile-text">{item.text}</span>
                </button>
              ))}
            </div>
          )}
        </>
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
