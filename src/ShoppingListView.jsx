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
  { key: 'produce', label: '🍓 Produce' },
  { key: 'dairy', label: '🥛 Dairy' },
  { key: 'protein', label: '🥩 Protein' },
  { key: 'pantry', label: '🌾 Pantry' },
  { key: 'treats', label: '🧁 Treats' },
  { key: 'other', label: '🛒 Other' },
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

function sectionInfo(key) {
  return GROCERY_SECTIONS.find((s) => s.key === key) || GROCERY_SECTIONS[GROCERY_SECTIONS.length - 1]
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
          <h1 className="view-title">Shopping</h1>
          <p className="view-subtitle cake-club-subtitle">A fully stocked, fully cute kitchen. 🍓</p>
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
        await supabase.from('pantry_items').update({ status: 'stocked' }).eq('id', existingPantry[0].id)
      } else {
        await supabase.from('pantry_items').insert({ name: item.text, status: 'stocked', user_id })
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
function MealPlannerTab() {
  const [plans, setPlans] = useState([])
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // { day, mealType }
  const [inputValue, setInputValue] = useState('')
  const [recipeId, setRecipeId] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: plansData }, { data: recipesData }] = await Promise.all([
      supabase.from('meal_plans').select('*'),
      supabase.from('recipes').select('*').order('name', { ascending: true }),
    ])
    setPlans(plansData || [])
    setRecipes(recipesData || [])
    setLoading(false)
  }

  function getMeal(day, mealType) {
    return plans.find((p) => p.day_of_week === day && p.meal_type === mealType)
  }

  function openEdit(day, mealType) {
    const existing = getMeal(day, mealType)
    setEditing({ day, mealType })
    setInputValue(existing?.meal_name || '')
    setRecipeId(existing?.recipe_id || '')
  }

  function pickRecipe(id) {
    setRecipeId(id)
    const recipe = recipes.find((r) => r.id === id)
    if (recipe) setInputValue(recipe.name)
  }

  async function saveMeal() {
    if (!editing) return
    const { day, mealType } = editing
    const existing = getMeal(day, mealType)
    const user_id = await getUserId()
    if (!inputValue.trim()) {
      if (existing) await supabase.from('meal_plans').delete().eq('id', existing.id)
    } else if (existing) {
      await supabase.from('meal_plans').update({ meal_name: inputValue.trim(), recipe_id: recipeId || null }).eq('id', existing.id)
    } else {
      await supabase.from('meal_plans').insert({
        day_of_week: day, meal_type: mealType, meal_name: inputValue.trim(), recipe_id: recipeId || null, user_id,
      })
    }
    setEditing(null)
    fetchAll()
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

      {loading && <p className="loading">Setting the table… 🍽️✨</p>}

      {!loading && DAYS.map((day) => (
        <div className="upnext-section" key={day}>
          <p className="module-group-label">{day.toUpperCase()}</p>
          <div className="calendar-card">
            {MEAL_TYPES.map((mt) => {
              const meal = getMeal(day, mt.key)
              const isEditing = editing?.day === day && editing?.mealType === mt.key
              const matchingRecipes = recipes.filter((r) => r.category === mt.key)
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
                    <button className="weather-location-link" onClick={() => openEdit(day, mt.key)}>
                      {meal?.recipe_id && '📖 '}{meal?.meal_name || 'Add a meal'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
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
  const emptyForm = { name: '', category: 'dinner', prep_time: '', ingredients: '', instructions: '', favorite: false }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')

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
    setForm({
      name: r.name || '', category: r.category || 'dinner', prep_time: r.prep_time || '',
      ingredients: r.ingredients || '', instructions: r.instructions || '', favorite: r.favorite || false,
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
      name: form.name.trim(), category: form.category, prep_time: form.prep_time.trim() || null,
      ingredients: form.ingredients.trim() || null, instructions: form.instructions.trim() || null, favorite: form.favorite,
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

      {!loading && !error && filtered.length > 0 && (
        <div className="finished-shelf">
          {filtered.map((r) => (
            <div className="library-card library-card-small" key={r.id} onClick={() => openEdit(r)}>
              <h3 className="contact-name" title={r.name}>{r.name}</h3>
              <p className="contact-relationship">{RECIPE_CATEGORIES.find((c) => c.key === r.category)?.label}</p>
              {r.prep_time && <p className="habit-dates">⏱️ {r.prep_time}</p>}
              <button
                className="todo-recurring-badge todo-recurring-badge-on"
                style={{ opacity: r.favorite ? 1 : 0.25 }}
                onClick={(e) => { e.stopPropagation(); toggleFavorite(r) }}
              >
                ⭐
              </button>
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
              </div>
              <div className="field">
                <label>Ingredients</label>
                <textarea value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} placeholder="One per line…" />
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
    await supabase.from('pantry_items').insert({ name: newName.trim(), user_id })
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
          text: item.name, category: 'groceries', section: 'pantry', user_id,
        })
      }
    }
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
        <div className="todo-list">
          {items.map((item) => (
            <div className="todo-row shopping-row" key={item.id}>
              <span className="todo-text">{item.name}</span>
              <select
                className="todo-priority-select"
                value={item.status || 'stocked'}
                onChange={(e) => setStatus(item, e.target.value)}
              >
                {PANTRY_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button className="todo-delete" onClick={() => handleDelete(item.id)}>×</button>
            </div>
          ))}
        </div>
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
