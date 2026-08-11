import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { getActiveFocusSession, setActiveFocusSession, clearActiveFocusSession, remainingSecondsFor } from './lib/focusSession'

/* ---------------- Constants ---------------- */

const DURATIONS = [15, 25, 45, 60, 90]

const LEVEL_TITLES = [
  { level: 1, title: '🐚 Little Shell' },
  { level: 2, title: '🐠 Reef Explorer' },
  { level: 3, title: '🪸 Coral Collector' },
  { level: 4, title: "🧜‍♀️ Cove Keeper" },
  { level: 5, title: '🌊 Ocean Dreamer' },
  { level: 6, title: '💎 Pearl Hunter' },
  { level: 7, title: '🐚 Mermaid Scout' },
  { level: 8, title: "🧜‍♀️ Mermaid Royalty" },
  { level: 9, title: '🌟 Tide Master' },
  { level: 10, title: '👑 Queen of the Cove' },
]

const BASE_THRESHOLDS = [0, 100, 250, 500, 850, 1300, 1850, 2500, 3300, 4300]

function xpThresholdForLevel(level) {
  if (level <= BASE_THRESHOLDS.length) return BASE_THRESHOLDS[level - 1]
  let last = BASE_THRESHOLDS[BASE_THRESHOLDS.length - 1]
  let increment = last - BASE_THRESHOLDS[BASE_THRESHOLDS.length - 2]
  for (let lvl = BASE_THRESHOLDS.length + 1; lvl <= level; lvl++) {
    increment = Math.round(increment * 1.25 / 50) * 50
    last += increment
  }
  return last
}

function levelForXp(xp) {
  let level = 1
  while (xpThresholdForLevel(level + 1) <= xp) level++
  return level
}

function levelTitle(level) {
  const found = LEVEL_TITLES.find((l) => l.level === level)
  if (found) return found.title
  return `🌊 Wave ${level}`
}

const COVE_STAGES = [
  { level: 1, name: 'Starter Cove', gradient: 'linear-gradient(180deg, #BFE0DE 0%, #8FC2BE 100%)' },
  { level: 5, name: 'Coral Reef', gradient: 'linear-gradient(180deg, #A8D8D4 0%, #6FAFA9 100%)' },
  { level: 10, name: 'Hidden Lagoon', gradient: 'linear-gradient(180deg, #92CFCB 0%, #4E9C95 100%)' },
  { level: 15, name: 'Mermaid Palace', gradient: 'linear-gradient(180deg, #C9B8E8 0%, #8FC2BE 100%)' },
  { level: 20, name: 'Deep Sea', gradient: 'linear-gradient(180deg, #5A8FB0 0%, #1E5C57 100%)' },
  { level: 30, name: 'Enchanted Reef', gradient: 'linear-gradient(180deg, #E8CBAA 0%, #8FC2BE 50%, #1E5C57 100%)' },
]

function coveStageFor(level) {
  let stage = COVE_STAGES[0]
  for (const s of COVE_STAGES) {
    if (level >= s.level) stage = s
  }
  return stage
}

const RARITIES = {
  common: { label: 'Common', color: '#8FC2BE' },
  uncommon: { label: 'Uncommon', color: '#1E5C57' },
  rare: { label: 'Rare', color: '#B896C9' },
  epic: { label: 'Epic', color: '#D9822E' },
  legendary: { label: 'Legendary', color: '#E4B84A' },
}

const SHOP_CATEGORIES = ['Coral', 'Sea Life', 'Decorations', 'Effects', 'Structures', 'Companions']

const CATALOG = [
  { key: 'shell_small', name: 'Small Shell', emoji: '🐚', category: 'Decorations', rarity: 'common', price: 10 },
  { key: 'rocks', name: 'Smooth Rocks', emoji: '🪨', category: 'Decorations', rarity: 'common', price: 15 },
  { key: 'bubbles', name: 'Bubble Stream', emoji: '🫧', category: 'Effects', rarity: 'common', price: 20 },
  { key: 'seaweed', name: 'Seaweed', emoji: '🌿', category: 'Decorations', rarity: 'common', price: 20 },
  { key: 'starfish', name: 'Starfish', emoji: '⭐', category: 'Sea Life', rarity: 'common', price: 15 },
  { key: 'clownfish', name: 'Clownfish', emoji: '🐠', category: 'Sea Life', rarity: 'common', price: 20 },
  { key: 'crab', name: 'Little Crab', emoji: '🦀', category: 'Sea Life', rarity: 'common', price: 20 },
  { key: 'coral_pink', name: 'Pink Coral', emoji: '🪸', category: 'Coral', rarity: 'uncommon', price: 25 },
  { key: 'coral_purple', name: 'Purple Coral', emoji: '🪸', category: 'Coral', rarity: 'uncommon', price: 30 },
  { key: 'sparkle_trail', name: 'Sparkle Trail', emoji: '✨', category: 'Effects', rarity: 'uncommon', price: 30 },
  { key: 'seahorse', name: 'Seahorse', emoji: '🎏', category: 'Sea Life', rarity: 'uncommon', price: 40 },
  { key: 'jellyfish', name: 'Jellyfish', emoji: '🪼', category: 'Sea Life', rarity: 'uncommon', price: 45 },
  { key: 'old_key', name: 'Old Key', emoji: '🗝️', category: 'Decorations', rarity: 'rare', price: 60 },
  { key: 'glow_orb', name: 'Glow Orb', emoji: '🔮', category: 'Effects', rarity: 'rare', price: 70 },
  { key: 'sunken_vase', name: 'Sunken Vase', emoji: '🏺', category: 'Decorations', rarity: 'rare', price: 80 },
  { key: 'turtle', name: 'Sea Turtle', emoji: '🐢', category: 'Sea Life', rarity: 'rare', price: 90 },
  { key: 'sunken_ruins', name: 'Sunken Ruins', emoji: '🏛️', category: 'Structures', rarity: 'rare', price: 100 },
  { key: 'treasure_chest', name: 'Treasure Chest', emoji: '💰', category: 'Structures', rarity: 'rare', price: 100 },
  { key: 'mermaid_friend', name: 'Mermaid Friend', emoji: "🧜‍♀️", category: 'Companions', rarity: 'rare', price: 150 },
  { key: 'coral_gold', name: 'Golden Coral', emoji: '🪸', category: 'Coral', rarity: 'epic', price: 120 },
  { key: 'rainbow_shimmer', name: 'Rainbow Shimmer', emoji: '🌈', category: 'Effects', rarity: 'epic', price: 150 },
  { key: 'shark', name: 'Small Shark', emoji: '🦈', category: 'Sea Life', rarity: 'epic', price: 150 },
  { key: 'octopus', name: 'Octopus', emoji: '🐙', category: 'Sea Life', rarity: 'epic', price: 180 },
  { key: 'dolphin', name: 'Dolphin', emoji: '🐬', category: 'Sea Life', rarity: 'epic', price: 200 },
  { key: 'shipwreck', name: 'Shipwreck', emoji: '⚓', category: 'Structures', rarity: 'epic', price: 200 },
  { key: 'pearl_bed', name: 'Pearl Bed', emoji: '💎', category: 'Coral', rarity: 'legendary', price: 400 },
  { key: 'mermaid_castle', name: 'Mermaid Castle', emoji: '🏰', category: 'Structures', rarity: 'legendary', price: 500 },
  { key: 'pearl_princess', name: 'Pearl Princess', emoji: '👑', category: 'Companions', rarity: 'legendary', price: 500 },
]

const ACHIEVEMENTS = [
  { key: 'first_pearl', icon: '🐚', name: 'First Pearl', desc: 'Complete your first focus session.', check: (s) => s.sessionsCompleted >= 1, progress: (s) => [Math.min(s.sessionsCompleted, 1), 1] },
  { key: 'making_waves_5', icon: '🫧', name: 'Making Waves', desc: 'Complete 5 focus sessions.', check: (s) => s.sessionsCompleted >= 5, progress: (s) => [Math.min(s.sessionsCompleted, 5), 5] },
  { key: 'growing_cove', icon: '🪸', name: 'Growing the Cove', desc: 'Complete 10 focus sessions.', check: (s) => s.sessionsCompleted >= 10, progress: (s) => [Math.min(s.sessionsCompleted, 10), 10] },
  { key: 'locked_in', icon: '⏱️', name: 'Locked In', desc: 'Complete a 60-minute session.', check: (s) => s.maxDuration >= 60, progress: (s) => [Math.min(s.maxDuration, 60), 60] },
  { key: 'deep_focus', icon: '🌊', name: 'Deep Focus', desc: 'Complete a 90-minute session.', check: (s) => s.maxDuration >= 90, progress: (s) => [Math.min(s.maxDuration, 90), 90] },
  { key: 'pearl_collector', icon: '💎', name: 'Pearl Collector', desc: 'Earn 500 pearls total.', check: (s) => s.totalPearlsEarned >= 500, progress: (s) => [Math.min(s.totalPearlsEarned, 500), 500] },
  { key: 'streak_3', icon: '🔥', name: 'Riding the Wave', desc: '3-day focus streak.', check: (s) => s.streak >= 3, progress: (s) => [Math.min(s.streak, 3), 3] },
  { key: 'streak_7', icon: '🔥🔥', name: 'Ocean Energy', desc: '7-day focus streak.', check: (s) => s.streak >= 7, progress: (s) => [Math.min(s.streak, 7), 7] },
  { key: 'streak_30', icon: '👑', name: 'Mermaid Mode', desc: '30-day focus streak.', check: (s) => s.streak >= 30, progress: (s) => [Math.min(s.streak, 30), 30] },
  { key: 'night_swim', icon: '🌙', name: 'Night Swim', desc: 'Complete a session after 8 PM.', check: (s) => s.hasNightSession, progress: (s) => [s.hasNightSession ? 1 : 0, 1] },
  { key: 'early_bird', icon: '🌅', name: 'Early Bird', desc: 'Complete a session before 8 AM.', check: (s) => s.hasEarlySession, progress: (s) => [s.hasEarlySession ? 1 : 0, 1] },
  { key: 'under_the_sea', icon: "🧜‍♀️", name: 'Under the Sea', desc: 'Spend 10 total hours focusing.', check: (s) => s.totalMinutes >= 600, progress: (s) => [Math.min(s.totalMinutes, 600), 600] },
  { key: 'pearl_princess_ach', icon: '💎', name: 'Pearl Princess', desc: 'Earn 1,000 pearls total.', check: (s) => s.totalPearlsEarned >= 1000, progress: (s) => [Math.min(s.totalPearlsEarned, 1000), 1000] },
]

const STREAK_MILESTONES = [
  { days: 3, reward: '25 bonus pearls', pearls: 25 },
  { days: 7, reward: 'an exclusive decoration', pearls: 0, item: 'sparkle_trail' },
  { days: 14, reward: 'a rare sea creature', pearls: 0, item: 'turtle' },
  { days: 30, reward: 'an exclusive mermaid', pearls: 0, item: 'pearl_princess' },
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function catalogItem(key) {
  return CATALOG.find((c) => c.key === key)
}

/* ---------------- Sub-components ---------------- */

function XPProgress({ xp, level }) {
  const currentThreshold = xpThresholdForLevel(level)
  const nextThreshold = xpThresholdForLevel(level + 1)
  const pct = Math.min(100, Math.round(((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
  return (
    <div className="cove-xp-block">
      <div className="cove-level-row">
        <span className="cove-level-badge">Level {level}</span>
        <span className="cove-level-title">{levelTitle(level)}</span>
      </div>
      <div className="momentum-track">
        <div className="momentum-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="momentum-caption">{xp - currentThreshold} / {nextThreshold - currentThreshold} XP to Level {level + 1}</p>
    </div>
  )
}

function PearlCounter({ pearls }) {
  return <span className="cove-pearl-counter">💎 {pearls.toLocaleString()}</span>
}

function DailyGoal({ todayMinutes, goalMinutes, onChangeGoal }) {
  const pct = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100))
  return (
    <div className="calendar-card">
      <div className="cove-goal-header">
        <p className="cake-section-heading" style={{ margin: 0 }}>🎯 Today's Focus</p>
        <select className="cove-goal-select" value={goalMinutes} onChange={(e) => onChangeGoal(parseInt(e.target.value, 10))}>
          {[30, 60, 120, 240].map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60}h` : `${m}m`} goal</option>)}
        </select>
      </div>
      <p className="focus-timer-stat-value">{todayMinutes} / {goalMinutes} min</p>
      <div className="momentum-track">
        <div className="momentum-fill" style={{ width: `${pct}%` }} />
      </div>
      {pct >= 100 && <p className="momentum-caption">✨ Daily goal complete!</p>}
    </div>
  )
}

function StreakCounter({ streak }) {
  return (
    <div className="cove-streak-pill">
      🔥 {streak} day{streak === 1 ? '' : 's'}
    </div>
  )
}

function AchievementBadge({ achievement, unlocked, stats, onClick }) {
  const [have, need] = achievement.progress(stats)
  return (
    <button type="button" className={`cove-achievement-badge ${unlocked ? 'cove-achievement-unlocked' : ''}`} onClick={() => onClick(achievement, unlocked, have, need)}>
      <span className="cove-achievement-icon">{unlocked ? achievement.icon : '🔒'}</span>
      <span className="cove-achievement-name">{unlocked ? achievement.name : '???'}</span>
      {!unlocked && <span className="cove-achievement-progress">{have}/{need}</span>}
    </button>
  )
}

function ShopItemCard({ item, owned, pearls, onBuy }) {
  const rarity = RARITIES[item.rarity]
  return (
    <div className="cove-shop-item" style={{ borderColor: owned ? rarity.color : undefined }}>
      <span className="cove-shop-item-emoji">{item.emoji}</span>
      <span className="cove-shop-item-name">{item.name}</span>
      <span className="cove-rarity-chip" style={{ background: rarity.color }}>{rarity.label}</span>
      {owned ? (
        <span className="cove-owned-tag">✓ Owned</span>
      ) : (
        <button className="btn-check" disabled={pearls < item.price} onClick={() => onBuy(item)}>
          💎 {item.price}
        </button>
      )}
    </div>
  )
}

/* ---------------- Main View ---------------- */

export default function FocusTimerView() {
  const [profile, setProfile] = useState(null)
  const [inventory, setInventory] = useState([])
  const [achievements, setAchievements] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedDuration, setSelectedDuration] = useState(25)
  const [customMinutes, setCustomMinutes] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)

  const [completionData, setCompletionData] = useState(null)
  const [levelUpData, setLevelUpData] = useState(null)
  const [wilted, setWilted] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [shopCategory, setShopCategory] = useState('Coral')
  const [cabinetOpen, setCabinetOpen] = useState(false)
  const [selectedAchievement, setSelectedAchievement] = useState(null)
  const [toast, setToast] = useState(null)

  const intervalRef = useRef(null)
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    fetchAll().then(rehydrateSession)
  }, [])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') rehydrateSession(profile)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [profile])

  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  function rehydrateSession(freshProfile) {
    const stored = getActiveFocusSession()
    if (!stored) return
    const remaining = remainingSecondsFor(stored)
    setSessionId(stored.sessionId)
    setTotalSeconds(stored.totalSeconds)
    setRemainingSeconds(remaining)
    setPaused(!!stored.paused)
    setWilted(false)
    setCompletionData(null)
    if (remaining <= 0 && !stored.paused) {
      setRunning(false)
      completeSession(stored.sessionId, stored.totalSeconds, freshProfile)
    } else {
      setRunning(true)
      if (!stored.paused) runInterval()
    }
  }

  async function fetchAll() {
    setLoading(true)
    const user_id = await getUserId()

    let { data: prof } = await supabase.from('cove_profile').select('*').maybeSingle()
    if (!prof) {
      const { data: created } = await supabase.from('cove_profile').insert({ user_id }).select().single()
      prof = created
    }
    setProfile(prof)

    const { data: inv } = await supabase.from('cove_inventory').select('*')
    setInventory(inv || [])

    const { data: ach } = await supabase.from('cove_achievements').select('*')
    setAchievements(ach || [])

    const { data: sess } = await supabase.from('focus_sessions').select('*').eq('completed', true).order('completed_at', { ascending: false })
    setSessions(sess || [])

    setLoading(false)
    return prof
  }

  /* -------- timer controls -------- */

  async function startSession() {
    const minutes = customMinutes ? parseInt(customMinutes, 10) || 25 : selectedDuration
    const user_id = await getUserId()
    const { data, error } = await supabase.from('focus_sessions').insert({ duration_minutes: minutes, user_id }).select().single()
    if (error) return

    const totalSecs = minutes * 60
    setSessionId(data.id)
    setTotalSeconds(totalSecs)
    setRemainingSeconds(totalSecs)
    setRunning(true)
    setPaused(false)
    setWilted(false)
    setCompletionData(null)

    setActiveFocusSession({
      sessionId: data.id, totalSeconds: totalSecs, endTime: Date.now() + totalSecs * 1000, paused: false, remainingAtPause: null,
    })

    runInterval()
  }

  function runInterval() {
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const stored = getActiveFocusSession()
      if (!stored) return
      const remaining = remainingSecondsFor(stored)
      setRemainingSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(intervalRef.current)
        completeSession(stored.sessionId, stored.totalSeconds)
      }
    }, 1000)
  }

  function togglePause() {
    const stored = getActiveFocusSession()
    if (!stored) return
    if (paused) {
      const newEndTime = Date.now() + stored.remainingAtPause * 1000
      setActiveFocusSession({ ...stored, paused: false, endTime: newEndTime, remainingAtPause: null })
      setPaused(false)
      runInterval()
    } else {
      clearInterval(intervalRef.current)
      const remaining = remainingSecondsFor(stored)
      setActiveFocusSession({ ...stored, paused: true, remainingAtPause: remaining })
      setPaused(true)
    }
  }

  function giveUp() {
    if (!confirm("Give up on this session? It won't count.")) return
    clearInterval(intervalRef.current)
    if (sessionId) supabase.from('focus_sessions').delete().eq('id', sessionId)
    clearActiveFocusSession()
    setRunning(false)
    setPaused(false)
    setSessionId(null)
    setWilted(true)
  }

  async function completeSession(idOverride, totalSecondsOverride, profileOverride) {
    setRunning(false)
    const targetSessionId = idOverride || sessionId
    const targetTotalSeconds = totalSecondsOverride || totalSeconds
    const prof = profileOverride || profile
    clearActiveFocusSession()
    const minutes = Math.round(targetTotalSeconds / 60)
    const xpEarned = minutes
    const pearlsEarned = Math.round(minutes * 0.2) + (minutes >= 60 ? 5 : 0)
    const foundBonus = Math.random() < 0.18
    const bonusPearls = foundBonus ? Math.round(5 + Math.random() * 15) : 0

    await supabase.from('focus_sessions').update({
      completed: true, completed_at: new Date().toISOString(),
      xp_earned: xpEarned, pearls_earned: pearlsEarned + bonusPearls,
    }).eq('id', targetSessionId)

    const oldLevel = levelForXp(prof.xp)
    const newXp = prof.xp + xpEarned
    const newLevel = levelForXp(newXp)

    // streak logic
    const today = todayStr()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    let newStreak = prof.streak
    if (prof.last_session_date === today) {
      // already counted today
    } else if (prof.last_session_date === yesterdayStr) {
      newStreak = prof.streak + 1
    } else {
      newStreak = 1
    }

    const newPearls = prof.pearls + pearlsEarned + bonusPearls
    const updatedProfile = { ...prof, xp: newXp, pearls: newPearls, streak: newStreak, last_session_date: today }
    await supabase.from('cove_profile').update({
      xp: newXp, pearls: newPearls, streak: newStreak, last_session_date: today, updated_at: new Date().toISOString(),
    }).eq('id', prof.id)
    setProfile(updatedProfile)

    // streak milestone reward
    const milestone = STREAK_MILESTONES.find((m) => m.days === newStreak)
    let milestoneMsg = null
    if (milestone) {
      milestoneMsg = `🔥 ${newStreak}-day streak! You earned ${milestone.reward}.`
      if (milestone.item && !inventory.some((i) => i.item_key === milestone.item)) {
        const uid = await getUserId()
        await supabase.from('cove_inventory').insert({ item_key: milestone.item, user_id: uid })
      }
      if (milestone.pearls) {
        await supabase.from('cove_profile').update({ pearls: newPearls + milestone.pearls }).eq('id', prof.id)
        setProfile((p) => ({ ...p, pearls: newPearls + milestone.pearls }))
      }
    }

    const { data: freshSessions } = await supabase.from('focus_sessions').select('*').eq('completed', true).order('completed_at', { ascending: false })
    setSessions(freshSessions || [])

    setCompletionData({ minutes, xpEarned, pearlsEarned, bonusPearls, foundBonus, milestoneMsg })

    if (newLevel > oldLevel) {
      setTimeout(() => setLevelUpData({ level: newLevel, title: levelTitle(newLevel) }), 400)
    }

    await checkAchievements({ ...updatedProfile }, freshSessions || sessions)
    fetchAll()
  }

  async function checkAchievements(prof, sess) {
    const unlockedKeys = new Set(achievements.map((a) => a.achievement_key))
    const stats = computeStats(prof, sess)
    const uid = await getUserId()
    for (const a of ACHIEVEMENTS) {
      if (!unlockedKeys.has(a.key) && a.check(stats)) {
        await supabase.from('cove_achievements').insert({ achievement_key: a.key, user_id: uid }).select()
        setToast(`🏆 Achievement unlocked: ${a.name}!`)
        setTimeout(() => setToast(null), 3000)
      }
    }
  }

  /* -------- shop -------- */

  async function buyItem(item) {
    if (profile.pearls < item.price) return
    const uid = await getUserId()
    await supabase.from('cove_inventory').insert({ item_key: item.key, user_id: uid })
    const newPearls = profile.pearls - item.price
    await supabase.from('cove_profile').update({ pearls: newPearls }).eq('id', profile.id)
    setProfile((p) => ({ ...p, pearls: newPearls }))
    fetchAll()
  }

  /* -------- derived stats -------- */

  function computeStats(prof, sess) {
    const totalMinutes = sess.reduce((sum, s) => sum + s.duration_minutes, 0)
    const totalPearlsEarned = sess.reduce((sum, s) => sum + (s.pearls_earned || 0), 0)
    const maxDuration = sess.reduce((max, s) => Math.max(max, s.duration_minutes), 0)
    const hasNightSession = sess.some((s) => new Date(s.completed_at).getHours() >= 20)
    const hasEarlySession = sess.some((s) => new Date(s.completed_at).getHours() < 8)
    return {
      sessionsCompleted: sess.length, totalMinutes, totalPearlsEarned, maxDuration,
      hasNightSession, hasEarlySession, streak: prof?.streak || 0,
    }
  }

  const stats = useMemo(() => computeStats(profile, sessions), [profile, sessions])
  const level = profile ? levelForXp(profile.xp) : 1
  const coveStage = coveStageFor(level)
  const placedItems = inventory.filter((i) => i.placed !== false)

  const todayMinutes = useMemo(() => {
    const today = todayStr()
    return sessions.filter((s) => s.completed_at?.startsWith(today)).reduce((sum, s) => sum + s.duration_minutes, 0)
  }, [sessions])

  const weekMinutes = useMemo(() => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return sessions.filter((s) => new Date(s.completed_at) >= weekAgo).reduce((sum, s) => sum + s.duration_minutes, 0)
  }, [sessions])

  async function changeGoal(minutes) {
    await supabase.from('cove_profile').update({ daily_goal_minutes: minutes }).eq('id', profile.id)
    setProfile((p) => ({ ...p, daily_goal_minutes: minutes }))
  }

  const elapsed = totalSeconds - remainingSeconds
  const pct = totalSeconds > 0 ? elapsed / totalSeconds : 0

  if (loading || !profile) {
    return <p className="loading">Diving into your cove… 🧜‍♀️✨</p>
  }

  // Focus mode: minimal UI while timer runs
  if (running) {
    return (
      <div className="cove-focus-mode">
        {toast && <div className="celebration-toast">{toast}</div>}
        <p className="cove-focus-mode-title">🧜‍♀️ Mermaid Cove</p>
        <div className={`cove-scene cove-scene-focus ${reducedMotion ? '' : 'cove-scene-animated'}`} style={{ background: coveStage.gradient }}>
          {!reducedMotion && (
            <>
              <span className="cove-bubble cove-bubble-1">🫧</span>
              <span className="cove-bubble cove-bubble-2">🫧</span>
              <span className="cove-bubble cove-bubble-3">🫧</span>
            </>
          )}
          <span className="cove-focus-mermaid">🧜‍♀️</span>
        </div>
        <p className="focus-timer-clock">{formatTime(remainingSeconds)}</p>
        <div className="momentum-track" style={{ maxWidth: 320, margin: '0 auto' }}>
          <div className="momentum-fill" style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="log-value-row" style={{ justifyContent: 'center', marginTop: 20 }}>
          <button className="btn-check" onClick={togglePause}>{paused ? '▶️ Resume' : '⏸️ Pause'}</button>
          <button className="btn-cancel" onClick={giveUp}>Give up</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {toast && <div className="celebration-toast">{toast}</div>}

      <div className="view-header">
        <div>
          <h1 className="view-title">Mermaid Cove</h1>
          <p className="view-subtitle cake-club-subtitle">🧜‍♀️ Focus, and watch your cove come to life.</p>
        </div>
        <div className="toolbar">
          <button className="btn-check" onClick={() => setCabinetOpen(true)}>🏆 Achievements ({achievements.length}/{ACHIEVEMENTS.length})</button>
          <button className="btn-check" onClick={() => setShopOpen(true)}>🛍️ Cove Shop</button>
        </div>
      </div>

      <div className="cove-top-row">
        <PearlCounter pearls={profile.pearls} />
        <StreakCounter streak={profile.streak} />
      </div>

      <XPProgress xp={profile.xp} level={level} />

      {/* Cove scene */}
      <div className={`cove-scene ${reducedMotion ? '' : 'cove-scene-animated'}`} style={{ background: coveStage.gradient }}>
        {!reducedMotion && (
          <>
            <span className="cove-bubble cove-bubble-1">🫧</span>
            <span className="cove-bubble cove-bubble-2">🫧</span>
          </>
        )}
        <p className="cove-stage-label">{coveStage.name}</p>
        <div className="cove-items-grid">
          {placedItems.length === 0 && <span className="cove-empty-hint">✨ Your cove is waiting to be decorated</span>}
          {placedItems.map((i) => {
            const item = catalogItem(i.item_key)
            if (!item) return null
            return <span key={i.id} className="cove-placed-item" title={item.name}>{item.emoji}</span>
          })}
        </div>
      </div>

      {/* Timer setup */}
      {wilted ? (
        <div className="calendar-card focus-timer-card">
          <span className="focus-plant-emoji" style={{ opacity: 0.5 }}>🥀</span>
          <p className="cake-section-heading">That one didn't count.</p>
          <p className="field-hint">Every session is a fresh start — try again whenever you're ready.</p>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setWilted(false)}>Try again</button>
        </div>
      ) : completionData ? (
        <div className="calendar-card focus-timer-card cove-completion-card">
          <p className="cake-section-heading">🌊 You did it!</p>
          <p className="field-hint">{completionData.minutes} minutes of focus</p>
          <div className="cove-reward-row">
            <span>+{completionData.xpEarned} XP</span>
            <span>+{completionData.pearlsEarned} 💎</span>
          </div>
          {completionData.foundBonus && (
            <p className="momentum-caption">✨ You found something! +{completionData.bonusPearls} bonus pearls</p>
          )}
          {completionData.milestoneMsg && <p className="momentum-caption">{completionData.milestoneMsg}</p>}
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setCompletionData(null)}>Claim & continue</button>
        </div>
      ) : (
        <div className="calendar-card focus-timer-card">
          <p className="cake-section-heading">🌰 How long are you focusing?</p>
          <div className="filter-row">
            {DURATIONS.map((d) => (
              <button key={d} className={`filter-pill ${selectedDuration === d && !customMinutes ? 'filter-pill-active' : ''}`} onClick={() => { setSelectedDuration(d); setCustomMinutes('') }}>
                {d} min
              </button>
            ))}
          </div>
          <div className="log-value-row" style={{ marginTop: 10 }}>
            <input type="number" className="log-value-input" placeholder="Custom minutes" value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value)} />
          </div>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={startSession}>🧜‍♀️ Start focusing</button>
        </div>
      )}

      <DailyGoal todayMinutes={todayMinutes} goalMinutes={profile.daily_goal_minutes} onChangeGoal={changeGoal} />

      <div className="cake-stats-row" style={{ marginTop: 16 }}>
        <div className="cake-stat-card">
          <span className="cake-stat-icon">☀️</span>
          <span className="cake-stat-value">{todayMinutes}m</span>
          <span className="cake-stat-label">Today</span>
        </div>
        <div className="cake-stat-card">
          <span className="cake-stat-icon">📅</span>
          <span className="cake-stat-value">{Math.round(weekMinutes / 60 * 10) / 10}h</span>
          <span className="cake-stat-label">This Week</span>
        </div>
        <div className="cake-stat-card">
          <span className="cake-stat-icon">⏱️</span>
          <span className="cake-stat-value">{Math.round(stats.totalMinutes / 60 * 10) / 10}h</span>
          <span className="cake-stat-label">Total</span>
        </div>
        <div className="cake-stat-card">
          <span className="cake-stat-icon">🎯</span>
          <span className="cake-stat-value">{stats.sessionsCompleted}</span>
          <span className="cake-stat-label">Sessions</span>
        </div>
      </div>

      {/* Shop Modal */}
      {shopOpen && (
        <div className="modal-backdrop" onClick={() => setShopOpen(false)}>
          <div className="modal cove-shop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cove-goal-header">
              <h2>🛍️ Cove Shop</h2>
              <PearlCounter pearls={profile.pearls} />
            </div>
            <div className="filter-row">
              {SHOP_CATEGORIES.map((c) => (
                <button key={c} className={`filter-pill ${shopCategory === c ? 'filter-pill-active' : ''}`} onClick={() => setShopCategory(c)}>{c}</button>
              ))}
            </div>
            <div className="cove-shop-grid">
              {CATALOG.filter((i) => i.category === shopCategory).map((item) => (
                <ShopItemCard
                  key={item.key}
                  item={item}
                  owned={inventory.some((i) => i.item_key === item.key)}
                  pearls={profile.pearls}
                  onBuy={buyItem}
                />
              ))}
            </div>
            <div className="modal-actions">
              <div />
              <div className="modal-actions-right">
                <button className="btn-cancel" onClick={() => setShopOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Cabinet */}
      {cabinetOpen && (
        <div className="modal-backdrop" onClick={() => setCabinetOpen(false)}>
          <div className="modal cove-shop-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🏆 Achievement Cabinet</h2>
            <p className="field-hint">{achievements.length} / {ACHIEVEMENTS.length} unlocked</p>
            <div className="cove-achievement-grid">
              {ACHIEVEMENTS.map((a) => (
                <AchievementBadge
                  key={a.key}
                  achievement={a}
                  unlocked={achievements.some((x) => x.achievement_key === a.key)}
                  stats={stats}
                  onClick={(ach, unlocked, have, need) => setSelectedAchievement({ ach, unlocked, have, need })}
                />
              ))}
            </div>
            <div className="modal-actions">
              <div />
              <div className="modal-actions-right">
                <button className="btn-cancel" onClick={() => setCabinetOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedAchievement && (
        <div className="modal-backdrop" onClick={() => setSelectedAchievement(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 48 }}>{selectedAchievement.unlocked ? selectedAchievement.ach.icon : '🔒'}</span>
            <h2>{selectedAchievement.unlocked ? selectedAchievement.ach.name : '???'}</h2>
            <p className="field-hint">{selectedAchievement.ach.desc}</p>
            {!selectedAchievement.unlocked && (
              <p className="momentum-caption">{selectedAchievement.have} / {selectedAchievement.need}</p>
            )}
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setSelectedAchievement(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Level Up Modal */}
      {levelUpData && (
        <div className="modal-backdrop" onClick={() => setLevelUpData(null)}>
          <div className="modal cove-levelup-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 48, margin: 0 }}>🎉</p>
            <h2>Level {levelUpData.level}!</h2>
            <p className="cake-section-heading">{levelUpData.title}</p>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setLevelUpData(null)}>Keep going</button>
          </div>
        </div>
      )}
    </div>
  )
}
