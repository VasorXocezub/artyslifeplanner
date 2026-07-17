import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { getCurrency, getHiddenShoppingTabs } from './lib/localPrefs'

const CATEGORIES = [
  { key: 'groceries', label: '🥑 Groceries', addPlaceholder: 'Milk, eggs, bread…' },
  { key: 'planned', label: '🛍️ Planned Purchases', addPlaceholder: 'New shoes, a lamp, that bag…' },
]

export default function ShoppingListView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hiddenTabs = getHiddenShoppingTabs()
  const visibleCategories = CATEGORIES.filter((c) => !hiddenTabs.includes(c.key))
  const [tab, setTab] = useState(() => (visibleCategories[0] ? visibleCategories[0].key : 'groceries'))
  const [newText, setNewText] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [adding, setAdding] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const currency = getCurrency()

  useEffect(() => {
    fetchItems()
  }, [])

  useEffect(() => {
    if (hiddenTabs.includes(tab) && visibleCategories.length > 0) {
      setTab(visibleCategories[0].key)
    }
  }, [tab])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) setError(error.message)
    else setItems(data)
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)
    const user_id = await getUserId()
    const payload = {
      text: newText.trim(),
      category: tab,
      price: tab === 'planned' && newPrice ? parseFloat(newPrice) || null : null,
      user_id,
    }
    const { error } = await supabase.from('shopping_items').insert(payload)
    setAdding(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewText('')
    setNewPrice('')
    fetchItems()
  }

  async function toggleComplete(item) {
    const { error } = await supabase
      .from('shopping_items')
      .update({ completed: !item.completed })
      .eq('id', item.id)
    if (error) {
      setError(error.message)
      return
    }
    fetchItems()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('shopping_items').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    fetchItems()
  }

  const categoryItems = items.filter((i) => i.category === tab)
  const openItems = categoryItems.filter((i) => !i.completed)
  const completedItems = categoryItems.filter((i) => i.completed)
  const plannedTotal = tab === 'planned'
    ? openItems.reduce((acc, i) => acc + Number(i.price || 0), 0)
    : 0

  const currentCat = CATEGORIES.find((c) => c.key === tab)

  return (
    <div>
      <div className="view-header">
        <div>
          <h1 className="view-title">Shopping List</h1>
          <p className="view-subtitle">
            {openItems.length === 0 ? "Cart's empty, bestie ✨" : `${openItems.length} thing${openItems.length === 1 ? '' : 's'} to grab`}
          </p>
        </div>
      </div>

      <div className="filter-row">
        {visibleCategories.map((c) => (
          <button
            key={c.key}
            className={`filter-pill ${tab === c.key ? 'filter-pill-active' : ''}`}
            onClick={() => setTab(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <form className="habit-add-row" onSubmit={handleAdd}>
        <input
          className="search-box habit-add-input"
          placeholder={currentCat.addPlaceholder}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        {tab === 'planned' && (
          <input
            type="number"
            className="todo-date-input shopping-price-input"
            placeholder={`Price (${currency})`}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
        )}
        <button className="btn-primary" type="submit" disabled={adding}>
          {adding ? 'Adding…' : '+ Add'}
        </button>
      </form>

      {tab === 'planned' && openItems.length > 0 && (
        <div className="totals-row shopping-total-row">
          <div className="total-card">
            <span className="total-label">Wishlist total</span>
            <span className="total-value">{formatMoney(plannedTotal, currency)}</span>
          </div>
        </div>
      )}

      {loading && <p className="loading">Rounding up your list… 🛒✨</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && openItems.length === 0 && completedItems.length === 0 && (
        <div className="empty-state">
          <h3>Nothing here yet, iconic ✨</h3>
          <p>Add your first {tab === 'groceries' ? 'grocery item' : 'thing you\'re dreaming of buying'} above.</p>
        </div>
      )}

      {!loading && !error && openItems.length > 0 && (
        <div className="todo-list">
          {openItems.map((item) => (
            <div className="todo-row shopping-row" key={item.id}>
              <button className="todo-checkbox shopping-checkbox" onClick={() => toggleComplete(item)} aria-label="Mark got it" />
              <span className="todo-text">{item.text}</span>
              {item.price != null && (
                <span className="todo-due">{formatMoney(item.price, currency)}</span>
              )}
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
                  <button className="todo-checkbox todo-checkbox-checked shopping-checkbox" onClick={() => toggleComplete(item)} aria-label="Mark not done">
                    ✓
                  </button>
                  <span className="todo-text todo-text-done">{item.text}</span>
                  {item.price != null && (
                    <span className="todo-due">{formatMoney(item.price, currency)}</span>
                  )}
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
