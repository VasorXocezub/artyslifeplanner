import { supabase, getUserId } from './supabase'
import { loadBudgetMeta, describePeriod, currentKey } from './budgetPeriods'
import { parseLocalDate } from './social'

export const GIFT_CATEGORY = '🎁 Gifts'

// Total gift budget for birthdays that fall inside [start, end] (inclusive)
export function giftsDueInPeriod(contacts, start, end) {
  let total = 0
  let count = 0
  for (const c of contacts) {
    const price = Number(c.gift_price) || 0
    if (!price || c.no_gift || !c.birthday) continue
    const bd = parseLocalDate(c.birthday)
    for (const y of [start.getFullYear(), end.getFullYear()]) {
      const d = new Date(y, bd.month, bd.day)
      if (d >= start && d <= end) { total += price; count++; break }
    }
  }
  return { total, count }
}

// Creates or updates a "🎁 Gifts" expense line in the current budget period
export async function addGiftsToBudget(contacts) {
  const meta = await loadBudgetMeta()
  const key = currentKey(meta.settings, meta.customs)
  const period = describePeriod(key, meta.settings, meta.customs)
  if (!period) throw new Error('Set up your budget period first.')
  const { total, count } = giftsDueInPeriod(contacts, period.start, period.end)
  if (!total) return { total: 0, count: 0, key, label: period.label }
  const existing = await supabase.from('budget_items').select('id').eq('month', key).eq('kind', 'expense').eq('category', GIFT_CATEGORY).limit(1)
  if (existing.error) throw existing.error
  if (existing.data && existing.data.length) {
    const { error } = await supabase.from('budget_items').update({ planned_amount: total }).eq('id', existing.data[0].id)
    if (error) throw error
  } else {
    const user_id = await getUserId()
    const { error } = await supabase.from('budget_items').insert({ user_id, month: key, category: GIFT_CATEGORY, kind: 'expense', planned_amount: total, sort_order: 99 })
    if (error) throw error
  }
  return { total, count, key, label: period.label }
}
