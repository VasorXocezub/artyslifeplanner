import { useCallback, useEffect, useState } from 'react'
import { supabase, getUserId } from './supabase'

// One shared list of finance categories for every finance tab.
// = saved categories (finance_categories) + any already used in transactions, recurring or budget items.
export async function fetchFinanceCategories() {
  const [saved, tx, rec, bud] = await Promise.all([
    supabase.from('finance_categories').select('id, name').order('name'),
    supabase.from('transactions').select('category').not('category', 'is', null).limit(1000),
    supabase.from('recurring_expenses').select('category').not('category', 'is', null).limit(500),
    supabase.from('budget_items').select('category').limit(500),
  ])
  const savedRows = saved.error ? [] : (saved.data || [])
  const savedKeys = new Set(savedRows.map(r => r.name.toLowerCase()))
  const used = [...(tx.data || []), ...(rec.data || []), ...(bud.data || [])]
    .map(r => (r.category || '').trim())
    .filter(n => n && n !== 'Savings' && n !== 'Savings Withdrawal')
  const seen = new Set(savedKeys)
  const extra = []
  for (const n of used) {
    const k = n.toLowerCase()
    if (!seen.has(k)) { seen.add(k); extra.push(n) }
  }
  const all = [...savedRows.map(r => r.name), ...extra].sort((a, b) => a.localeCompare(b))
  return { all, savedRows }
}

export async function saveFinanceCategory(name) {
  const clean = (name || '').trim()
  if (!clean) return { error: null }
  const { data } = await supabase.from('finance_categories').select('id').ilike('name', clean).limit(1)
  if (data && data.length) return { error: null }
  const user_id = await getUserId()
  return supabase.from('finance_categories').insert({ user_id, name: clean })
}

export function useFinanceCategories() {
  const [categories, setCategories] = useState([])
  const [savedRows, setSavedRows] = useState([])
  const refresh = useCallback(async () => {
    const { all, savedRows } = await fetchFinanceCategories()
    setCategories(all)
    setSavedRows(savedRows)
  }, [])
  useEffect(() => { refresh() }, [refresh])
  const addCategory = useCallback(async (name) => {
    const res = await saveFinanceCategory(name)
    if (!res.error) await refresh()
    return res
  }, [refresh])
  const removeCategory = useCallback(async (name) => {
    const row = savedRows.find(r => r.name.toLowerCase() === name.toLowerCase())
    if (row) await supabase.from('finance_categories').delete().eq('id', row.id)
    await refresh()
  }, [savedRows, refresh])
  return { categories, savedRows, addCategory, removeCategory, refresh }
}
