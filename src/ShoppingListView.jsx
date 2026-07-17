import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { getCurrency, getHiddenShoppingTabs } from './lib/localPrefs'

const TABS = [
  { key: 'groceries', label: '🛒 Grocery List' },
  { key: 'planner', label: '🗓️ Meal Planner' },
  { key: 'recipes', label: '📖 Recipe Box' },
  { key: 'pantry', label: '🌾 Pantry' },
  { key: 'budget', label: '💰 Budget' },
  { key: 'planned', label: '🎀 Wishlist' },
]

const GROCERY_SECTIONS = [
  { key: 'produce', label: '🍎 Produce' },
  { key: 'protein', label: '🥩 Protein' },
  { key: 'dairy', label: '🥛 Dairy' },
  { key: 'bakery', label: '🥖 Bakery' },
  { key: 'pantry', label: '🥫 Pantry' },
  { key: 'frozen', label: '🧊 Frozen' },
  { key: 'drinks', label: '🥤 Drinks' },
  { key: 'treats', label: '🍬 Treats & Snacks' },
  { key: 'supplements', label: '💊 Supplements' },
  { key: 'beauty', label: '🧴 Beauty & Skincare' },
  { key: 'cleaning', label: '🧼 Cleaning Supplies' },
  { key: 'household', label: '🧻 Household Essentials' },
  { key: 'pet', label: '🐾 Pet Supplies' },
  { key: 'baby', label: '👶 Baby Essentials' },
  { key: 'other', label: '📦 Other' },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MEAL_TYPES = [
  { key: 'breakfast', label: '🍓 Breakfast' },
  { key: 'lunch', label: '🥗 Lunch' },
  { key: 'dinner', label: '🍝 Dinner' },
  { key: 'snack', label: '🍿 Snack' },
]

const RECIPE_CATEGORIES = [
  { key: 'breakfast', label: '🍳 Breakfast' },
  { key: 'lunch', label: '🥗 Lunch' },
  { key: 'dinner', label: '🍝 Dinner' },
  { key: 'treats', label: '🍪 Treats' },
  { key: 'drinks', label: '🥤 Drinks' },
  { key: 'healthy', label: '🌱 Healthy' },
]

const PANTRY_STATUSES = [
  { key: 'stocked', label: '✅ Stocked' },
  { key: 'low', label: '⚠️ Running Low' },
  { key: 'out', label: '❌ Out' },
]

const UNITS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'pcs']

function sectionInfo(key) {
  return GROCERY_SECTIONS.find((s) => s.key === key) || GROCERY_SECTIONS[GROCERY_SECTIONS.length - 1]
}

function formatDateShort(d) {
  if (!d) return ''
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ShoppingListView() {
  const hiddenTabs = getHiddenShoppingTabs()
  const visibleTabs = TABS.filter((t) => !hiddenTabs.includes(t.key))
  const [tab, setTab] = useState(() => (visibleTabs[0] ? visibleTabs[0].key : 'groceries'))
  const currency = getCurrency()

  useEffect(() => {
    if (hiddenTabs.includes(tab) && visibleTabs.length > 0) setTab(visibleTabs[0].key)
  }, [tab])

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Kitchen Club</h1>
          <p className="view-subtitle cake-club-subtitle">🍓 Girl dinner is not a food group.</p>
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

      {tab === 'groceries' && <GroceryListTab />}
      {tab === 'planner' && <MealPlannerTab />}
      {tab === 'recipes' && <RecipeBoxTab />}
      {tab === 'pantry' && <PantryTab />}
      {tab === 'budget' && <BudgetTab currency={currency} />}
      {tab === 'planned' && <PlannedPurchasesTab currency={currency} />}
    </div>
  )
}

/* ---------------- Grocery List ---------------- */
function GroceryListTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newText, setNewText] = useState('')
  const [newSection, setNewSection] = useState('produce')
  const [adding, setAdding] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('shopping_items').select('*').eq('category', 'groceries').order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)
    const user_id = await getUserId()
    const { error } = await supabase.from('shopping_items').insert({
      text: newText.trim(), category: 'groceries', section: newSection, user_id,
    })
    setAdding(false)
    if (error) { setError(error.message); return }
    setNewText('')
    fetchItems()
  }

  async function toggleComplete(item) {
    const willComplete = !item.completed
    const { error } = await supabase.from('shopping_items').update({ completed: willComplete }).eq('id', item.id)
    if (error) { setError(error.message); return }

    if (willComplete) {
      const user_id = await getUserId()
      const { data: existingPantry } = await supabase
        .from('pantry_items')
        .select('*')
        .ilike('name', item.text)
        .limit(1)
      if (existingPantry && existingPantry.length > 0) {
        await supabase.from('pantry_items').update({ status: 'stocked', section: item.section || existingPantry[0].section || 'other' }).eq('id', existingPantry[0].id)
      } else {
        await supabase.from('pantry_items').insert({ name: item.text, status: 'stocked', section: item.section || 'other', user_id })
      }
    }
    fetchItems()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('shopping_items').delete().eq('id', id)
    if (error) { setError(error.message); return }
    fetchItems()
  }

  const openItems = items.filter((i) => !i.completed)
  const completedItems = items.filter((i) => i.completed)

  const grouped = GROCERY_SECTIONS.map((s) => ({
    ...s,
    items: openItems.filter((i) => (i.section || 'other') === s.key),
  })).filter((s) => s.items.length > 0)

  async function downloadGroceryImage() {
    if (grouped.length === 0) return
    const { data: userData } = await supabase.auth.getUser()
    const displayName = userData?.user?.user_metadata?.full_name || userData?.user?.email?.split('@')[0] || 'My'
    const headerText = `🛍️ ${displayName}'s Grocery List`

    const width = 480
    const padding = 32
    const headerHeight = 92
    const lineHeight = 27
    const sectionGap = 16

    let totalLines = 0
    grouped.forEach((s) => { totalLines += 1 + s.items.length })
    const height = headerHeight + totalLines * lineHeight + grouped.length * sectionGap + padding

    const canvas = document.createElement('canvas')
    const scale = 2
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)

    ctx.fillStyle = '#FAF6F0'
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = '#1E5C57'
    let titleFontSize = 24
    ctx.font = `bold ${titleFontSize}px Georgia, serif`
    while (ctx.measureText(headerText).width > width - padding * 2 && titleFontSize > 16) {
      titleFontSize -= 1
      ctx.font = `bold ${titleFontSize}px Georgia, serif`
    }
    ctx.fillText(headerText, padding, 44)

    ctx.fillStyle = '#8a8378'
    ctx.font = '13px sans-serif'
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    ctx.fillText(dateStr, padding, 66)

    ctx.strokeStyle = '#E8DDCB'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding, 78)
    ctx.lineTo(width - padding, 78)
    ctx.stroke()

    let y = headerHeight
    grouped.forEach((s) => {
      ctx.font = 'bold 13px sans-serif'
      ctx.fillStyle = '#1E5C57'
      ctx.fillText(s.label.toUpperCase(), padding, y)
      y += lineHeight

      ctx.font = '15px sans-serif'
      s.items.forEach((item) => {
        ctx.strokeStyle = '#C9BFA8'
        ctx.lineWidth = 1.5
        ctx.strokeRect(padding, y - 13, 15, 15)
        ctx.fillStyle = '#3A342E'
        ctx.fillText(item.text, padding + 25, y - 1)
        y += lineHeight
      })
      y += sectionGap
    })

    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `grocery-list-${isoDate(new Date())}.png`
    link.href = dataUrl
    link.click()
  }

  return (
    <div>
      <form className="habit-add-row" onSubmit={handleAdd}>
        <input
          className="search-box habit-add-input"
          placeholder="Add a grocery item…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        <select className="todo-date-input" value={newSection} onChange={(e) => setNewSection(e.target.value)}>
          {GROCERY_SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <button className="btn-primary" type="submit" disabled={adding}>{adding ? 'Adding…' : '+ Add'}</button>
      </form>

      {grouped.length > 0 && (
        <button className="btn-check" style={{ marginBottom: 18 }} onClick={downloadGroceryImage}>
          📸 Save list as image for the store
        </button>
      )}

      {loading && <p className="loading">Rounding up the essentials… 🛒✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && grouped.length === 0 && completedItems.length === 0 && (
        <div className="empty-state">
          <h3>Cart's empty, bestie ✨</h3>
          <p>Add your first grocery item above and pick which aisle it belongs to.</p>
        </div>
      )}

      {!loading && !error && grouped.map((s) => (
        <div className="upnext-section" key={s.key}>
          <p className="module-group-label">{s.label.toUpperCase()}</p>
          <div className="todo-list">
            {s.items.map((item) => (
              <div className="todo-row shopping-row" key={item.id}>
                <button className="todo-checkbox shopping-checkbox" onClick={() => toggleComplete(item)} aria-label="Mark got it" />
                <span className="todo-text">{item.text}</span>
                <button className="todo-delete" onClick={() => handleDelete(item.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {completedItems.length > 0 && (
        <div className="todo-completed-section">
          <button className="btn-ghost todo-toggle-completed" onClick={() => setShowCompleted(!showCompleted)}>
            {showCompleted ? 'Hide' : 'Show'} got it already ({completedItems.length})
          </button>
          {showCompleted && (
            <div className="todo-list">
              {completedItems.map((item) => (
                <div className="todo-row todo-row-done shopping-row" key={item.id}>
                  <button className="todo-checkbox todo-checkbox-checked shopping-checkbox" onClick={() => toggleComplete(item)}>✓</button>
                  <span className="todo-text todo-text-done">{item.text}</span>
                  <span className="habit-schedule">{sectionInfo(item.section).label}</span>
                  <button className="todo-delete" onClick={() => handleDelete(item.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- Meal Planner ---------------- */
function getMonday(offsetWeeks) {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function isoDate(d) {
  return d.toISOString().split('T')[0]
}

function MealPlannerTab() {
  const [plans, setPlans] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // { date, mealType }
  const [inputValue, setInputValue] = useState('')
  const [recipeId, setRecipeId] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)

  const monday = getMonday(weekOffset)
  const weekDates = DAYS.map((_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
  const weekEnd = weekDates[6]
  const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  useEffect(() => { fetchAll() }, [weekOffset])

  async function fetchAll() {
    setLoading(true)
    const from = isoDate(weekDates[0])
    const to = isoDate(weekDates[6])
    const [{ data: plansData }, { data: recipesData }] = await Promise.all([
      supabase.from('meal_plans').select('*').gte('plan_date', from).lte('plan_date', to),
      supabase.from('recipes').select('*').order('name', { ascending: true }),
    ])
    setPlans(plansData || [])
    setRecipes(recipesData || [])
    setLoading(false)
  }

  function getMeal(dateStr, mealType) {
    return plans.find((p) => p.plan_date === dateStr && p.meal_type === mealType)
  }

  function openEdit(dateStr, mealType) {
    const existing = getMeal(dateStr, mealType)
    setEditing({ date: dateStr, mealType })
    setInputValue(existing?.meal_name || '')
    setRecipeId(existing?.recipe_id || '')
  }

  function pickRecipe(id) {
    setRecipeId(id)
    const recipe = recipes.find((r) => r.id === id)
    if (recipe) setInputValue(recipe.name)
  }

  const [toast, setToast] = useState(null)

  async function saveMeal() {
    if (!editing) return
    const { date, mealType } = editing
    const existing = getMeal(date, mealType)
    const user_id = await getUserId()
    let saveErr
    if (!inputValue.trim()) {
      if (existing) {
        ;({ error: saveErr } = await supabase.from('meal_plans').delete().eq('id', existing.id))
      }
    } else if (existing) {
      ;({ error: saveErr } = await supabase.from('meal_plans').update({ meal_name: inputValue.trim(), recipe_id: recipeId || null }).eq('id', existing.id))
    } else {
      ;({ error: saveErr } = await supabase.from('meal_plans').insert({
        plan_date: date, day_of_week: DAYS[weekDates.findIndex((d) => isoDate(d) === date)],
        meal_type: mealType, meal_name: inputValue.trim(), recipe_id: recipeId || null, user_id,
      }))
    }
    if (saveErr) { setToast(`⚠️ ${saveErr.message}`); return }
    setEditing(null)
    fetchAll()
  }

  function printWeekPlan() {
    const width = 480
    const padding = 32
    const headerHeight = 92
    const lineHeight = 24
    const dayGap = 14

    const daysWithMeals = DAYS.map((day, i) => {
      const dateStr = isoDate(weekDates[i])
      const meals = MEAL_TYPES.map((mt) => ({ mt, meal: getMeal(dateStr, mt.key) })).filter((m) => m.meal?.meal_name)
      return { day, dateLabel: weekDates[i].toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), meals }
    }).filter((d) => d.meals.length > 0)

    if (daysWithMeals.length === 0) {
      setToast('Nothing planned this week yet ✨')
      setTimeout(() => setToast(null), 3000)
      return
    }

    let totalLines = 0
    daysWithMeals.forEach((d) => { totalLines += 1 + d.meals.length })
    const height = headerHeight + totalLines * lineHeight + daysWithMeals.length * dayGap + padding

    const canvas = document.createElement('canvas')
    const scale = 2
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)

    ctx.fillStyle = '#FAF6F0'
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = '#1E5C57'
    ctx.font = 'bold 22px Georgia, serif'
    ctx.fillText('🗓️ This Week\'s Meal Plan', padding, 42)
    ctx.fillStyle = '#8a8378'
    ctx.font = '13px sans-serif'
    ctx.fillText(weekLabel, padding, 64)
    ctx.strokeStyle = '#E8DDCB'
    ctx.beginPath()
    ctx.moveTo(padding, 78)
    ctx.lineTo(width - padding, 78)
    ctx.stroke()

    let y = headerHeight
    daysWithMeals.forEach((d) => {
      ctx.font = 'bold 14px sans-serif'
      ctx.fillStyle = '#1E5C57'
      ctx.fillText(`${d.day.toUpperCase()} · ${d.dateLabel}`, padding, y)
      y += lineHeight
      ctx.font = '14px sans-serif'
      ctx.fillStyle = '#3A342E'
      d.meals.forEach(({ mt, meal }) => {
        ctx.fillText(`${mt.label}: ${meal.meal_name}`, padding + 12, y)
        y += lineHeight
      })
      y += dayGap
    })

    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `meal-plan-${isoDate(weekDates[0])}.png`
    link.href = dataUrl
    link.click()
  }

  async function generateShoppingListFromPlan() {
    const recipeIds = Array.from(new Set(plans.filter((p) => p.recipe_id).map((p) => p.recipe_id)))
    if (recipeIds.length === 0) {
      setToast('No recipes scheduled this week yet ✨')
      setTimeout(() => setToast(null), 3000)
      return
    }
    const plannedRecipes = recipes.filter((r) => recipeIds.includes(r.id))
    const allIngredients = []
    plannedRecipes.forEach((r) => {
      const list = Array.isArray(r.ingredients_list) ? r.ingredients_list : []
      list.forEach((ing) => { if (ing.name) allIngredients.push(ing) })
    })

    const user_id = await getUserId()
    let added = 0
    const seen = new Set()
    for (const ing of allIngredients) {
      const key = ing.name.toLowerCase().trim()
      if (seen.has(key)) continue
      seen.add(key)
      const displayText = ing.amount ? `${ing.amount}${ing.unit || ''} ${ing.name}`.trim() : ing.name

      const { data: stocked } = await supabase.from('pantry_items').select('*').ilike('name', ing.name).eq('status', 'stocked').limit(1)
      if (stocked && stocked.length > 0) continue
      const { data: existingGrocery } = await supabase
        .from('shopping_items').select('*').eq('category', 'groceries').eq('completed', false).ilike('text', `%${ing.name}%`).limit(1)
      if (existingGrocery && existingGrocery.length > 0) continue

      await supabase.from('shopping_items').insert({ text: displayText, category: 'groceries', section: 'other', user_id })
      added++
    }
    setToast(added > 0 ? `${added} ingredient${added > 1 ? 's' : ''} added to your grocery list 🛒` : 'Already got everything you need ✨')
    setTimeout(() => setToast(null), 3000)
  }

  const mealsPlannedThisWeek = plans.filter((p) => p.meal_name).length

  return (
    <div>
      <div className="calendar-card goals-summary-card">
        <p className="module-group-label">QUICK STATS</p>
        <div className="goals-summary-row">
          <span className="goals-summary-label">🍽️ Meals planned this week</span>
          <span className="goals-summary-value">{mealsPlannedThisWeek} / 28</span>
        </div>
      </div>

      <div className="calendar-nav" style={{ marginBottom: 16 }}>
        <button className="cal-nav-btn" onClick={() => setWeekOffset(weekOffset - 1)}>‹</button>
        <span className="cal-month-label">
          {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : weekOffset < -1 ? `${-weekOffset} Weeks Ago` : `In ${weekOffset} Week${weekOffset > 1 ? 's' : ''}`}
          {' '}· {weekLabel}
        </span>
        <button className="cal-nav-btn" onClick={() => setWeekOffset(weekOffset + 1)}>›</button>
      </div>
      {weekOffset !== 0 && (
        <button className="weather-location-link" style={{ marginBottom: 14 }} onClick={() => setWeekOffset(0)}>
          Back to this week
        </button>
      )}

      <div className="log-value-row" style={{ marginBottom: 16 }}>
        <button className="btn-check" onClick={printWeekPlan}>🖨️ Print week's meal plan</button>
        <button className="btn-check" onClick={generateShoppingListFromPlan}>🛒 Generate shopping list</button>
      </div>
      {toast && <p className="momentum-caption" style={{ marginBottom: 14 }}>{toast}</p>}

      {loading && <p className="loading">Setting the table… 🍽️✨</p>}

      {!loading && DAYS.map((day, i) => {
        const dateStr = isoDate(weekDates[i])
        const dateLabel = weekDates[i].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return (
          <div className="upnext-section" key={day}>
            <p className="module-group-label">{day.toUpperCase()} · {dateLabel}</p>
            <div className="calendar-card">
              {MEAL_TYPES.map((mt) => {
                const meal = getMeal(dateStr, mt.key)
                const isEditing = editing?.date === dateStr && editing?.mealType === mt.key
                const matchingRecipes = recipes
                return (
                  <div className="goals-summary-row meal-planner-row" key={mt.key}>
                    <span className="goals-summary-label">{mt.label}</span>
                    {isEditing ? (
                      <div className="meal-planner-editor">
                        {matchingRecipes.length > 0 && (
                          <select
                            className="meal-planner-recipe-select"
                            value={recipeId}
                            onChange={(e) => pickRecipe(e.target.value)}
                          >
                            <option value="">📖 Pick from Recipe Box…</option>
                            {matchingRecipes.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        )}
                        <span className="log-value-row" style={{ margin: 0 }}>
                          <input
                            autoFocus
                            className="log-value-input"
                            value={inputValue}
                            onChange={(e) => { setInputValue(e.target.value); setRecipeId('') }}
                            onKeyDown={(e) => e.key === 'Enter' && saveMeal()}
                            placeholder="Or type something else…"
                          />
                          <button className="btn-check log-value-btn" onClick={saveMeal}>Save</button>
                        </span>
                      </div>
                    ) : (
                      <button className="weather-location-link" onClick={() => openEdit(dateStr, mt.key)}>
                        {meal?.recipe_id && '📖 '}{meal?.meal_name || 'Add a meal'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Recipe Box ---------------- */
function RecipeBoxTab() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const emptyForm = { name: '', category: 'dinner', prep_time: '', servings: '4', ingredients_list: [], instructions: '', favorite: false }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [schedulingId, setSchedulingId] = useState(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleMealType, setScheduleMealType] = useState('dinner')
  const [toast, setToast] = useState(null)

  useEffect(() => { fetchRecipes() }, [])

  async function fetchRecipes() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('recipes').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setRecipes(data)
    setLoading(false)
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(r) {
    setEditingId(r.id)
    let ingredientsList = Array.isArray(r.ingredients_list) ? r.ingredients_list : []
    if (ingredientsList.length === 0 && r.ingredients) {
      ingredientsList = r.ingredients.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ({ amount: '', unit: '', name: l }))
    }
    setForm({
      name: r.name || '', category: r.category || 'dinner', prep_time: r.prep_time || '', servings: r.servings || '4',
      ingredients_list: ingredientsList, instructions: r.instructions || '', favorite: r.favorite || false,
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
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(), category: form.category, prep_time: form.prep_time.trim() || null, servings: form.servings,
      ingredients_list: form.ingredients_list.filter((i) => i.name.trim()), instructions: form.instructions.trim() || null, favorite: form.favorite,
    }
    let error
    if (editingId) {
      ;({ error } = await supabase.from('recipes').update(payload).eq('id', editingId))
    } else {
      const user_id = await getUserId()
      ;({ error } = await supabase.from('recipes').insert({ ...payload, user_id }))
    }
    setSaving(false)
    if (error) { setError(error.message); return }
    closeModal()
    fetchRecipes()
  }

  async function toggleFavorite(r) {
    await supabase.from('recipes').update({ favorite: !r.favorite }).eq('id', r.id)
    fetchRecipes()
  }

  async function addMissingIngredients(recipe) {
    const list = Array.isArray(recipe.ingredients_list) ? recipe.ingredients_list : []
    if (list.length === 0) return
    const user_id = await getUserId()
    let added = 0
    for (const ing of list) {
      if (!ing.name) continue
      const displayText = ing.amount ? `${ing.amount}${ing.unit || ''} ${ing.name}`.trim() : ing.name
      const { data: stocked } = await supabase.from('pantry_items').select('*').ilike('name', ing.name).eq('status', 'stocked').limit(1)
      if (stocked && stocked.length > 0) continue
      const { data: existingGrocery } = await supabase
        .from('shopping_items').select('*').eq('category', 'groceries').eq('completed', false).ilike('text', `%${ing.name}%`).limit(1)
      if (existingGrocery && existingGrocery.length > 0) continue
      await supabase.from('shopping_items').insert({ text: displayText, category: 'groceries', section: 'other', user_id })
      added++
    }
    setToast(added > 0 ? `${added} ingredient${added > 1 ? 's' : ''} added to your grocery list 🛒` : 'Already got everything you need ✨')
    setTimeout(() => setToast(null), 3000)
  }

  function openSchedule(recipe) {
    setSchedulingId(recipe.id)
    setScheduleDate(isoDate(new Date()))
    setScheduleMealType(recipe.category === 'dinner' || recipe.category === 'lunch' || recipe.category === 'breakfast' ? recipe.category : 'dinner')
  }

  async function confirmSchedule(recipe) {
    if (!scheduleDate) return
    const dateObj = new Date(scheduleDate + 'T00:00:00')
    const dayName = DAYS[(dateObj.getDay() + 6) % 7]

    const user_id = await getUserId()
    const { data: existing, error: fetchErr } = await supabase
      .from('meal_plans').select('*').eq('plan_date', scheduleDate).eq('meal_type', scheduleMealType).limit(1)
    if (fetchErr) { setError(fetchErr.message); return }

    let saveErr
    if (existing && existing.length > 0) {
      ;({ error: saveErr } = await supabase.from('meal_plans').update({ meal_name: recipe.name, recipe_id: recipe.id }).eq('id', existing[0].id))
    } else {
      ;({ error: saveErr } = await supabase.from('meal_plans').insert({
        plan_date: scheduleDate, day_of_week: dayName, meal_type: scheduleMealType,
        meal_name: recipe.name, recipe_id: recipe.id, user_id,
      }))
    }
    if (saveErr) { setError(saveErr.message); return }
    setSchedulingId(null)
    setToast(`Scheduled for ${dayName} ${formatDateShort(scheduleDate)} — ${MEAL_TYPES.find((m) => m.key === scheduleMealType)?.label} 📅`)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleDelete() {
    if (!editingId) return
    if (!confirm('Delete this recipe?')) return
    await supabase.from('recipes').delete().eq('id', editingId)
    closeModal()
    fetchRecipes()
  }

  const filtered = categoryFilter === 'all' ? recipes : recipes.filter((r) => r.category === categoryFilter)

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <button className="btn-primary" onClick={openAdd}>+ Add recipe</button>
      </div>
      <p className="field-hint">Save favorite recipes.</p>

      <div className="filter-row">
        <button className={`filter-pill ${categoryFilter === 'all' ? 'filter-pill-active' : ''}`} onClick={() => setCategoryFilter('all')}>All</button>
        {RECIPE_CATEGORIES.map((c) => (
          <button key={c.key} className={`filter-pill ${categoryFilter === c.key ? 'filter-pill-active' : ''}`} onClick={() => setCategoryFilter(c.key)}>{c.label}</button>
        ))}
      </div>

      {loading && <p className="loading">Flipping through the recipe box… 📖✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <h3>No recipes saved yet ✨</h3>
          <p>Add the first one you make on repeat.</p>
        </div>
      )}

      {toast && <p className="momentum-caption" style={{ marginBottom: 10 }}>{toast}</p>}

      {!loading && !error && filtered.length > 0 && (
        <div className="finished-shelf">
          {filtered.map((r) => (
            <div className="library-card library-card-small" key={r.id}>
              <div onClick={() => openEdit(r)} style={{ cursor: 'pointer' }}>
                <h3 className="contact-name" title={r.name}>{r.name}</h3>
                <p className="contact-relationship">{RECIPE_CATEGORIES.find((c) => c.key === r.category)?.label}</p>
                <p className="habit-dates">
                  {r.prep_time && `⏱️ ${r.prep_time}`}{r.prep_time && r.servings ? ' · ' : ''}{r.servings && `🍽️ Serves ${r.servings}`}
                </p>
              </div>
              <button
                className="todo-recurring-badge todo-recurring-badge-on"
                style={{ opacity: r.favorite ? 1 : 0.25 }}
                onClick={(e) => { e.stopPropagation(); toggleFavorite(r) }}
              >
                ⭐
              </button>

              {schedulingId === r.id ? (
                <div className="meal-planner-editor" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="date"
                    className="log-value-input"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                  <select className="meal-planner-recipe-select" value={scheduleMealType} onChange={(e) => setScheduleMealType(e.target.value)}>
                    {MEAL_TYPES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <div className="log-value-row">
                    <button className="btn-cancel" onClick={() => setSchedulingId(null)}>Cancel</button>
                    <button className="btn-check log-value-btn" onClick={() => confirmSchedule(r)}>Confirm</button>
                  </div>
                </div>
              ) : (
                <div className="log-value-row" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-delete-small" onClick={() => addMissingIngredients(r)}>🛒 Add Missing Ingredients</button>
                  <button className="btn-delete-small" onClick={() => openSchedule(r)}>📅 Schedule Meal</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit recipe' : 'New recipe'}</h2>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Recipe name</label>
                <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Grandma's lasagna" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {RECIPE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Prep time</label>
                  <input value={form.prep_time} onChange={(e) => setForm({ ...form, prep_time: e.target.value })} placeholder="30 mins" />
                </div>
                <div className="field">
                  <label>🍽️ Servings</label>
                  <select value={form.servings} onChange={(e) => setForm({ ...form, servings: e.target.value })}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="4">4</option>
                    <option value="6">6</option>
                    <option value="8+">8+</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Ingredients</label>
                {form.ingredients_list.map((ing, i) => (
                  <div className="ingredient-row" key={i}>
                    <input
                      type="number"
                      className="ingredient-amount-input"
                      placeholder="100"
                      value={ing.amount}
                      onChange={(e) => {
                        const list = [...form.ingredients_list]
                        list[i] = { ...list[i], amount: e.target.value }
                        setForm({ ...form, ingredients_list: list })
                      }}
                    />
                    <select
                      className="ingredient-unit-select"
                      value={ing.unit}
                      onChange={(e) => {
                        const list = [...form.ingredients_list]
                        list[i] = { ...list[i], unit: e.target.value }
                        setForm({ ...form, ingredients_list: list })
                      }}
                    >
                      <option value="">—</option>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input
                      className="ingredient-name-input"
                      placeholder="Chicken breast"
                      value={ing.name}
                      onChange={(e) => {
                        const list = [...form.ingredients_list]
                        list[i] = { ...list[i], name: e.target.value }
                        setForm({ ...form, ingredients_list: list })
                      }}
                    />
                    <button
                      type="button"
                      className="ingredient-remove-btn"
                      onClick={() => setForm({ ...form, ingredients_list: form.ingredients_list.filter((_, idx) => idx !== i) })}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="weather-location-link"
                  onClick={() => setForm({ ...form, ingredients_list: [...form.ingredients_list, { amount: '0', unit: '', name: '' }] })}
                >
                  + Add ingredient
                </button>
              </div>
              <div className="field">
                <label>Instructions</label>
                <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Step by step…" />
              </div>
              <label className="savings-toggle-label">
                <input type="checkbox" checked={form.favorite} onChange={(e) => setForm({ ...form, favorite: e.target.checked })} />
                {' '}⭐ Favorite
              </label>
              <div className="modal-actions">
                <div>{editingId && <button type="button" className="btn-delete" onClick={handleDelete} disabled={saving}>Delete</button>}</div>
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

/* ---------------- Pantry Tracker ---------------- */
function PantryTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newSection, setNewSection] = useState('other')
  const [adding, setAdding] = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('pantry_items').select('*').order('name', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const user_id = await getUserId()
    await supabase.from('pantry_items').insert({ name: newName.trim(), section: newSection, user_id })
    setAdding(false)
    setNewName('')
    fetchItems()
  }

  async function setStatus(item, status) {
    await supabase.from('pantry_items').update({ status }).eq('id', item.id)

    if (status === 'low' || status === 'out') {
      const { data: existingGrocery } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('category', 'groceries')
        .eq('completed', false)
        .ilike('text', item.name)
        .limit(1)
      if (!existingGrocery || existingGrocery.length === 0) {
        const user_id = await getUserId()
        await supabase.from('shopping_items').insert({
          text: item.name, category: 'groceries', section: item.section || 'other', user_id,
        })
      }
    }
    fetchItems()
  }

  async function setSection(item, section) {
    await supabase.from('pantry_items').update({ section }).eq('id', item.id)
    fetchItems()
  }

  async function handleDelete(id) {
    await supabase.from('pantry_items').delete().eq('id', id)
    fetchItems()
  }

  return (
    <div>
      <p className="field-hint">Track staples.</p>
      <form className="habit-add-row" onSubmit={handleAdd}>
        <input className="search-box habit-add-input" placeholder="Rice, pasta, coffee…" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <select className="todo-date-input" value={newSection} onChange={(e) => setNewSection(e.target.value)}>
          {GROCERY_SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <button className="btn-primary" type="submit" disabled={adding}>{adding ? 'Adding…' : '+ Add'}</button>
      </form>

      {loading && <p className="loading">Checking the cupboards… 🌾✨</p>}

      {!loading && items.length === 0 && (
        <div className="empty-state">
          <h3>Nothing tracked yet ✨</h3>
          <p>Add your pantry staples so you always know what's running low.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          {GROCERY_SECTIONS.map((s) => {
            const sectionItems = items.filter((i) => (i.section || 'other') === s.key)
            if (sectionItems.length === 0) return null
            return (
              <div className="upnext-section" key={s.key}>
                <p className="module-group-label">{s.label.toUpperCase()}</p>
                <div className="todo-list">
                  {sectionItems.map((item) => (
                    <div className="todo-row shopping-row" key={item.id}>
                      <span className="todo-text">{item.name}</span>
                      <select
                        className="todo-recurring-select"
                        value={item.section || 'other'}
                        onChange={(e) => setSection(item, e.target.value)}
                        title="Category"
                      >
                        {GROCERY_SECTIONS.map((sec) => <option key={sec.key} value={sec.key}>{sec.label}</option>)}
                      </select>
                      <select
                        className="todo-priority-select"
                        value={item.status || 'stocked'}
                        onChange={(e) => setStatus(item, e.target.value)}
                      >
                        {PANTRY_STATUSES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                      </select>
                      <button className="todo-delete" onClick={() => handleDelete(item.id)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/* ---------------- Grocery Budget ---------------- */
function BudgetTab({ currency }) {
  const [budget, setBudget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [budgetInput, setBudgetInput] = useState('')
  const [spentInput, setSpentInput] = useState('')

  useEffect(() => { fetchBudget() }, [])

  async function fetchBudget() {
    setLoading(true)
    const user_id = await getUserId()
    let { data } = await supabase.from('grocery_budget').select('*').maybeSingle()
    if (!data) {
      const { data: created } = await supabase.from('grocery_budget').insert({ user_id }).select().single()
      data = created
    }
    setBudget(data)
    setBudgetInput(String(data.monthly_budget || 0))
    setSpentInput(String(data.spent_this_month || 0))
    setLoading(false)
  }

  async function save() {
    const { data } = await supabase
      .from('grocery_budget')
      .update({ monthly_budget: parseFloat(budgetInput) || 0, spent_this_month: parseFloat(spentInput) || 0 })
      .eq('id', budget.id)
      .select().single()
    setBudget(data)
  }

  if (loading || !budget) return <p className="loading">Adding it all up… 🧮</p>

  const remaining = Number(budget.monthly_budget || 0) - Number(budget.spent_this_month || 0)
  const pct = budget.monthly_budget > 0 ? Math.min(100, Math.round((budget.spent_this_month / budget.monthly_budget) * 100)) : 0

  return (
    <div>
      <div className="calendar-card goals-summary-card">
        <p className="module-group-label">GROCERY BUDGET</p>
        <div className="goals-summary-row">
          <span className="goals-summary-label">Monthly budget</span>
          <span className="goals-summary-value">{formatMoney(budget.monthly_budget, currency)}</span>
        </div>
        <div className="goals-summary-row">
          <span className="goals-summary-label">Spent so far</span>
          <span className="goals-summary-value">{formatMoney(budget.spent_this_month, currency)}</span>
        </div>
        <div className="goals-summary-row">
          <span className="goals-summary-label">{remaining >= 0 ? '✅ Remaining' : '⚠️ Over by'}</span>
          <span className="goals-summary-value">{formatMoney(Math.abs(remaining), currency)}</span>
        </div>
        <div className="momentum-track" style={{ marginTop: 10 }}>
          <div className="momentum-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="calendar-card">
        <div className="field-row">
          <div className="field">
            <label>Monthly budget</label>
            <input type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
          </div>
          <div className="field">
            <label>Spent so far</label>
            <input type="number" value={spentInput} onChange={(e) => setSpentInput(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" onClick={save}>Save</button>
      </div>
    </div>
  )
}

/* ---------------- Planned Purchases / Wishlist ---------------- */
function PlannedPurchasesTab({ currency }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newText, setNewText] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [adding, setAdding] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('shopping_items').select('*').eq('category', 'planned').order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)
    const user_id = await getUserId()
    const { error } = await supabase.from('shopping_items').insert({
      text: newText.trim(), category: 'planned', price: newPrice ? parseFloat(newPrice) || null : null, user_id,
    })
    setAdding(false)
    if (error) { setError(error.message); return }
    setNewText('')
    setNewPrice('')
    fetchItems()
  }

  async function toggleComplete(item) {
    await supabase.from('shopping_items').update({ completed: !item.completed }).eq('id', item.id)
    fetchItems()
  }

  async function handleDelete(id) {
    await supabase.from('shopping_items').delete().eq('id', id)
    fetchItems()
  }

  const openItems = items.filter((i) => !i.completed)
  const completedItems = items.filter((i) => i.completed)
  const total = openItems.reduce((acc, i) => acc + Number(i.price || 0), 0)

  return (
    <div>
      <form className="habit-add-row" onSubmit={handleAdd}>
        <input className="search-box habit-add-input" placeholder="New shoes, a lamp, that bag…" value={newText} onChange={(e) => setNewText(e.target.value)} />
        <input type="number" className="todo-date-input shopping-price-input" placeholder={`Price (${currency})`} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
        <button className="btn-primary" type="submit" disabled={adding}>{adding ? 'Adding…' : '+ Add'}</button>
      </form>

      {openItems.length > 0 && (
        <div className="totals-row shopping-total-row">
          <div className="total-card">
            <span className="total-label">Wishlist total</span>
            <span className="total-value">{formatMoney(total, currency)}</span>
          </div>
        </div>
      )}

      {loading && <p className="loading">Rounding up your list… 🛒✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && openItems.length === 0 && completedItems.length === 0 && (
        <div className="empty-state">
          <h3>Nothing here yet, iconic ✨</h3>
          <p>Add the first thing you're dreaming of buying.</p>
        </div>
      )}

      {!loading && !error && openItems.length > 0 && (
        <div className="todo-list">
          {openItems.map((item) => (
            <div className="todo-row shopping-row" key={item.id}>
              <button className="todo-checkbox shopping-checkbox" onClick={() => toggleComplete(item)} />
              <span className="todo-text">{item.text}</span>
              {item.price != null && <span className="todo-due">{formatMoney(item.price, currency)}</span>}
              <button className="todo-delete" onClick={() => handleDelete(item.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {completedItems.length > 0 && (
        <div className="todo-completed-section">
          <button className="btn-ghost todo-toggle-completed" onClick={() => setShowCompleted(!showCompleted)}>
            {showCompleted ? 'Hide' : 'Show'} got it already ({completedItems.length})
          </button>
          {showCompleted && (
            <div className="todo-list">
              {completedItems.map((item) => (
                <div className="todo-row todo-row-done shopping-row" key={item.id}>
                  <button className="todo-checkbox todo-checkbox-checked shopping-checkbox" onClick={() => toggleComplete(item)}>✓</button>
                  <span className="todo-text todo-text-done">{item.text}</span>
                  {item.price != null && <span className="todo-due">{formatMoney(item.price, currency)}</span>}
                  <button className="todo-delete" onClick={() => handleDelete(item.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
