import { useEffect, useState } from 'react'
import { supabase, getUserId } from './lib/supabase'
import { formatMoney } from './lib/currency'
import { getCurrency } from './lib/localPrefs'

export default function WishlistView() {
  const currency = getCurrency()
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
      <div className="view-header">
        <div>
          <h1 className="view-title">Wishlist</h1>
          <p className="view-subtitle cake-club-subtitle">🎀 Manifesting these into my cart.</p>
        </div>
      </div>

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

      {loading && <p className="loading">Rounding up your list… 🎀✨</p>}
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
