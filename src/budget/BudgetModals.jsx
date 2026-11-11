import { firstEmoji } from '../lib/budgetPeriods'
import { COLORS, ICONS, round2 } from './constants'

// Every popup of the budget screen. State and handlers live in BudgetPlanner and arrive as props.
export default function BudgetModals({
  apply5030, billModal, copyFromKey, copyFromLast, currency, deleteLine, deletePeriod, deleteTx, end, existingGroups, expenseRows, exportPng, goals, jobModal, knownCats, modal, money, noteModal, pastKeys, payBill, period, periodModal, plannedIncome, prevItems, quick, rangeModal, recap, receivedIncome, remaining, renameCategory, renameModal, resetRange, rows, runUndo, saveJob, saveLine, saveNote, savePeriod, saveQuick, saveRange, saveTx, saving, setBillModal, setJobModal, setModal, setNoteModal, setPeriodModal, setQuick, setRangeModal, setRecap, setRenameModal, setTplModal, setTxModal, setUndo, today, tplModal, totalActual, totalBudget, txModal, unallocated, undo, undoTimer, unit,
}) {
  return (
    <>
      {undo && (
        <div className="bd-toast bd-noprint" role="status">
          <span>{undo.msg}</span>
          <button type="button" onClick={runUndo}>Undo</button>
          <button type="button" aria-label="Dismiss" onClick={() => { clearTimeout(undoTimer.current); setUndo(null) }}>✕</button>
        </div>
      )}

      {billModal && (
        <div className="modal-backdrop" onClick={() => setBillModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Pay bill">
            <h2>{billModal.r.icon || '🧾'} Paid {billModal.r.category}</h2>
            <p className="bd-dim">Planned {money(billModal.r.planned)}. Change it if the amount was different.</p>
            <form onSubmit={payBill}>
              <div className="field-row">
                <div className="field"><label>Amount paid ({currency})</label><input autoFocus type="number" inputMode="decimal" step="0.01" min="0" value={billModal.amount} onChange={e => setBillModal({ ...billModal, amount: e.target.value })} /></div>
                <div className="field"><label>Date</label><input type="date" value={billModal.date} onChange={e => setBillModal({ ...billModal, date: e.target.value })} required /></div>
              </div>
              <div className="modal-actions"><span />
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setBillModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary">Mark paid</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {txModal && (
        <div className="modal-backdrop" onClick={() => setTxModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit transaction">
            <h2>Edit transaction</h2>
            <form onSubmit={saveTx}>
              <div className="field-row">
                <div className="field"><label>Amount ({currency})</label><input autoFocus type="number" inputMode="decimal" step="0.01" min="0" value={txModal.amount} onChange={e => setTxModal({ ...txModal, amount: e.target.value })} /></div>
                <div className="field"><label>Date</label><input type="date" value={txModal.date} onChange={e => setTxModal({ ...txModal, date: e.target.value })} required /></div>
              </div>
              <div className="field"><label>Category</label>
                <select value={txModal.category} onChange={e => setTxModal({ ...txModal, category: e.target.value })}>
                  <option value="">Uncategorized</option>
                  {[...new Set([...knownCats, txModal.category].filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {(() => {
                const line = rows.find(r => r.kind === txModal.type && r.category.toLowerCase() === txModal.category.toLowerCase())
                return line && line.parts.length > 0 ? (
                  <div className="field"><label>Item</label>
                    <select value={txModal.item} onChange={e => setTxModal({ ...txModal, item: e.target.value })}>
                      <option value="">Not sure / other</option>
                      {line.parts.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                ) : null
              })()}
              <div className="field"><label>Notes</label><input value={txModal.notes} onChange={e => setTxModal({ ...txModal, notes: e.target.value })} /></div>
              <div className="modal-actions">
                <button type="button" className="btn-delete" onClick={deleteTx}>Delete</button>
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setTxModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {noteModal && (
        <div className="modal-backdrop" onClick={() => setNoteModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Period note">
            <h2>Note for {period?.label}</h2>
            <form onSubmit={saveNote}>
              <div className="field"><textarea autoFocus rows={3} value={noteModal.text} onChange={e => setNoteModal({ text: e.target.value })} placeholder="e.g. Bonus month, December trip, school fees due" /></div>
              <div className="modal-actions"><span />
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setNoteModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {quick && (
        <div className="modal-backdrop" onClick={() => setQuick(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Quick add">
            <h2>{quick.r.icon || '🧾'} {quick.r.kind === 'income' ? 'Log income' : 'Log spending'} · {quick.r.category}</h2>
            <p className="bd-dim">{quick.r.kind === 'income' ? `${money(Math.max(0, quick.r.budget - quick.r.actual))} still expected` : `${money(quick.r.remaining)} left`}{quick.amount && quick.r.kind === 'expense' ? ` → ${money(quick.r.remaining - (parseFloat(quick.amount) || 0))} after this` : ''}</p>
            <form onSubmit={saveQuick}>
              <div className="field-row">
                <div className="field"><label>Amount ({currency})</label><input autoFocus type="number" inputMode="decimal" step="0.01" min="0" value={quick.amount} onChange={e => setQuick({ ...quick, amount: e.target.value })} placeholder="0.00" /></div>
                <div className="field"><label>Date</label><input type="date" value={quick.date} onChange={e => setQuick({ ...quick, date: e.target.value })} required /></div>
              </div>
              {quick.r.parts.length > 0 && quick.r.kind === 'expense' && (
                <div className="field"><label>Which item?</label>
                  <select value={quick.item} onChange={e => setQuick({ ...quick, item: e.target.value })}>
                    <option value="">Not sure / other</option>
                    {quick.r.parts.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div className="field"><label>Notes (optional)</label><input value={quick.notes} onChange={e => setQuick({ ...quick, notes: e.target.value })} /></div>
              <div className="modal-actions"><span />
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setQuick(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Log it'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {jobModal && (
        <div className="modal-backdrop" onClick={() => setJobModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Give it a job">
            <h2>Give every {currency === 'ZAR' ? 'rand' : 'coin'} a job 💅</h2>
            <p className="bd-dim">{money(unallocated)} of your planned income isn't assigned to anything.</p>
            <form onSubmit={saveJob}>
              <div className="field"><label>Amount</label><input type="number" inputMode="decimal" step="0.01" min="0" value={jobModal.amount} onChange={e => setJobModal({ ...jobModal, amount: e.target.value })} /></div>
              <div className="field"><label>Put it towards</label>
                <select value={jobModal.target} onChange={e => setJobModal({ ...jobModal, target: e.target.value })}>
                  {expenseRows.filter(r => !(r.pctOf > 0)).map(r => <option key={r.id} value={r.id}>{r.icon || '🧾'} {r.category}{r.goal ? ' (goal)' : ''}</option>)}
                  <option value="__new">＋ A new budget line…</option>
                </select>
              </div>
              <div className="modal-actions"><span />
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setJobModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary">Assign</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {tplModal && (
        <div className="modal-backdrop" onClick={() => setTplModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Templates">
            <h2>Start from a template</h2>
            <p className="bd-dim">Only adds lines that aren't already in this {unit}.</p>
            <div className="bd-tpl-list">
              <button type="button" className="bd-tpl" onClick={apply5030}><strong>50 / 30 / 20</strong><span className="bd-dim">Needs, wants and savings as a % of your planned income{plannedIncome > 0 ? '' : ' (add an income line first)'}</span></button>
              <button type="button" className="bd-tpl" onClick={copyFromLast} disabled={!prevItems.length}><strong>Previous {unit}</strong><span className="bd-dim">{prevItems.length ? `${prevItems.length} lines` : 'Nothing there yet'}</span></button>
            </div>
            <p className="module-group-label">Copy from any period</p>
            {tplModal.loading ? <p className="loading">Loading…</p> : pastKeys.length === 0 ? <p className="bd-dim">No other periods have budget lines yet.</p> : (
              <div className="bd-tpl-list">
                {pastKeys.slice(0, 24).map(p => <button key={p.key} type="button" className="bd-tpl" onClick={() => copyFromKey(p.key)}><strong>{p.label}</strong><span className="bd-dim">{p.sub}</span></button>)}
              </div>
            )}
            <div className="modal-actions"><span /><div className="modal-actions-right"><button type="button" className="btn-cancel" onClick={() => setTplModal(null)}>Close</button></div></div>
          </div>
        </div>
      )}

      {renameModal && (
        <div className="modal-backdrop" onClick={() => setRenameModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Rename category">
            <h2>Rename or merge “{renameModal.from}”</h2>
            <p className="bd-dim">Updates every transaction, recurring expense and budget line. Type the name of an existing category to merge into it.</p>
            <form onSubmit={renameCategory}>
              <div className="field"><label>New name</label><input autoFocus list="bd-cat-names" value={renameModal.to} onChange={e => setRenameModal({ ...renameModal, to: e.target.value })} /></div>
              <datalist id="bd-cat-names">{knownCats.filter(c => c !== renameModal.from).map(c => <option key={c} value={c} />)}</datalist>
              {knownCats.some(c => c.toLowerCase() === renameModal.to.trim().toLowerCase() && c !== renameModal.from) && <p className="bd-dim">This will merge into the existing “{knownCats.find(c => c.toLowerCase() === renameModal.to.trim().toLowerCase())}”.</p>}
              <div className="modal-actions"><span />
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setRenameModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Updating…' : 'Update everywhere'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {recap && (() => {
        const withBudget = expenseRows.filter(r => r.budget > 0)
        const wins = withBudget.filter(r => r.actual <= r.budget)
        const overs = withBudget.filter(r => r.actual > r.budget).sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget))
        const bestWin = [...wins].sort((a, b) => b.remaining - a.remaining)[0]
        const biggest = [...expenseRows].sort((a, b) => b.actual - a.actual)[0]
        const done = today > end
        const headline = withBudget.length === 0 ? 'Nothing planned yet, babe.' : remaining >= 0 ? (done ? 'You stayed in budget. Iconic. 👑' : 'You’re on track. Keep that energy. 💅') : 'We overspent a bit, and that’s data, not drama. 🌷'
        return (
          <div className="modal-backdrop" onClick={() => setRecap(false)}>
            <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Recap">
              <h2>{period?.label} recap ✨</h2>
              <p><strong>{headline}</strong></p>
              <ul className="bd-recap">
                <li>Spent <strong>{money(totalActual)}</strong> of <strong>{money(totalBudget)}</strong> · {remaining >= 0 ? `${money(remaining)} ${done ? 'saved' : 'still free'}` : `${money(-remaining)} over`}</li>
                {withBudget.length > 0 && <li><strong>{wins.length} of {withBudget.length}</strong> lines stayed in budget</li>}
                {bestWin && bestWin.remaining > 0 && <li>Biggest win: <strong>{bestWin.category}</strong> with {money(bestWin.remaining)} to spare</li>}
                {biggest && biggest.actual > 0 && <li>Most spent on: <strong>{biggest.category}</strong> ({money(biggest.actual)})</li>}
                {overs[0] && <li>Watch next {unit}: <strong>{overs[0].category}</strong> ({money(overs[0].actual - overs[0].budget)} over)</li>}
                {receivedIncome > 0 && <li>Income received: <strong>{money(receivedIncome)}</strong></li>}
              </ul>
              <div className="modal-actions"><span /><div className="modal-actions-right"><button type="button" className="btn-cancel" onClick={() => { setRecap(false); exportPng() }}>Save as image</button><button type="button" className="btn-primary" onClick={() => setRecap(false)}>Done</button></div></div>
            </div>
          </div>
        )
      })()}

      {rangeModal && (
        <div className="modal-backdrop" onClick={() => setRangeModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Period dates">
            <h2>Dates for this period</h2>
            <p className="bd-dim">Change just this period, for example when payday moves. Other periods keep your usual dates.</p>
            <form onSubmit={saveRange}>
              <div className="field-row">
                <div className="field"><label>Starts</label><input type="date" value={rangeModal.start_date} onChange={e => setRangeModal({ ...rangeModal, start_date: e.target.value })} /></div>
                <div className="field"><label>Ends</label><input type="date" value={rangeModal.end_date} min={rangeModal.start_date} onChange={e => setRangeModal({ ...rangeModal, end_date: e.target.value })} /></div>
              </div>
              <div className="modal-actions">
                {rangeModal.hasOverride ? <button type="button" className="btn-delete" onClick={resetRange}>Reset to usual dates</button> : <span />}
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setRangeModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {periodModal && (
        <div className="modal-backdrop" onClick={() => setPeriodModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Budget period">
            <h2>{periodModal.id ? 'Edit period' : 'New budget period'}</h2>
            <form onSubmit={savePeriod}>
              <div className="field"><label>Name</label><input autoFocus value={periodModal.name} onChange={e => setPeriodModal({ ...periodModal, name: e.target.value })} placeholder="e.g. Pay cycle 3, Holiday trip" /></div>
              <div className="field-row">
                <div className="field"><label>Starts</label><input type="date" value={periodModal.start_date} onChange={e => setPeriodModal({ ...periodModal, start_date: e.target.value })} /></div>
                <div className="field"><label>Ends</label><input type="date" value={periodModal.end_date} min={periodModal.start_date} onChange={e => setPeriodModal({ ...periodModal, end_date: e.target.value })} /></div>
              </div>
              <div className="modal-actions">
                {periodModal.id ? <button type="button" className="btn-delete" onClick={deletePeriod}>Delete</button> : <span />}
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setPeriodModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal bd-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Budget line">
            <h2>{modal.id ? 'Edit budget line' : 'New budget line'}</h2>
            <form onSubmit={saveLine}>
              <div className="toggle-group" style={{ marginBottom: 12 }}>
                {[['expense', 'Spending'], ['income', 'Income']].map(([k, l]) => (
                  <button key={k} type="button" className={`toggle-btn ${modal.kind === k ? 'toggle-btn-active' : ''}`} onClick={() => setModal({ ...modal, kind: k })}>{l}</button>
                ))}
              </div>
              <div className="field">
                <label>Category</label>
                <select
                  value={modal.customCategory ? '__new' : (knownCats.some(c => c.toLowerCase() === modal.category.toLowerCase()) ? knownCats.find(c => c.toLowerCase() === modal.category.toLowerCase()) : (modal.category ? '__new' : ''))}
                  onChange={e => e.target.value === '__new' ? setModal({ ...modal, category: '', customCategory: true }) : setModal({ ...modal, category: e.target.value, customCategory: false })}
                >
                  <option value="">Choose category…</option>
                  {knownCats.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new">＋ New category…</option>
                </select>
                {(modal.customCategory || (modal.category && !knownCats.some(c => c.toLowerCase() === modal.category.toLowerCase()))) && (
                  <input style={{ marginTop: 8 }} placeholder="New category name" value={modal.category} onChange={e => setModal({ ...modal, category: e.target.value, customCategory: true })} autoFocus />
                )}
              </div>
              <div className="field">
                <label>How is the amount set?</label>
                <select value={modal.amountMode} onChange={e => setModal({ ...modal, amountMode: e.target.value })}>
                  <option value="fixed">A fixed amount</option>
                  <option value="pct">A % of my planned income</option>
                  {modal.kind === 'expense' && <option value="fund">Sinking fund (yearly / quarterly cost, saved up over time)</option>}
                </select>
              </div>
              {modal.amountMode === 'fixed' && (
                <div className="field">
                  <label>{modal.kind === 'income' ? 'Expected' : 'Budget'} per {unit} ({currency}){modal.parts.length > 0 ? ' — total of items' : ''}</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0"
                    value={modal.parts.length > 0 ? String(Math.round(modal.parts.reduce((a, p) => a + (parseFloat(p.amount) || 0), 0) * 100) / 100) : modal.planned_amount}
                    disabled={modal.parts.length > 0}
                    onChange={e => setModal({ ...modal, planned_amount: e.target.value })} />
                </div>
              )}
              {modal.amountMode === 'pct' && (
                <div className="field">
                  <label>Percent of planned income</label>
                  <input type="number" inputMode="decimal" step="0.5" min="0" max="100" value={modal.pct} onChange={e => setModal({ ...modal, pct: e.target.value })} placeholder="e.g. 20" />
                  <small className="bd-dim">{parseFloat(modal.pct) > 0 ? `= ${money(round2(rows.filter(r => r.kind === 'income' && !(r.pctOf > 0)).reduce((a, r) => a + r.planned, 0) * parseFloat(modal.pct) / 100))} this ${unit}` : 'Follows your income lines, so it adjusts when pay changes.'}</small>
                </div>
              )}
              {modal.amountMode === 'fund' && (
                <>
                  <div className="field-row">
                    <div className="field"><label>Total cost ({currency})</label><input type="number" inputMode="decimal" step="0.01" min="0" value={modal.fundTotal} onChange={e => setModal({ ...modal, fundTotal: e.target.value })} placeholder="e.g. 2400" /></div>
                    <div className="field"><label>Spread over (# of {unit}s)</label><input type="number" inputMode="numeric" min="1" value={modal.fundPeriods} onChange={e => setModal({ ...modal, fundPeriods: e.target.value })} placeholder="e.g. 12" /></div>
                  </div>
                  <small className="bd-dim" style={{ display: 'block', margin: '-4px 0 12px' }}>{parseFloat(modal.fundTotal) > 0 && parseInt(modal.fundPeriods, 10) > 0 ? `Sets aside ${money(round2(parseFloat(modal.fundTotal) / parseInt(modal.fundPeriods, 10)))} each ${unit} and keeps it growing until you pay the bill.` : 'The money accumulates each period until the bill is paid.'}</small>
                </>
              )}
              {modal.amountMode === 'fixed' && (
              <div className="field">
                <label>Break it down (optional)</label>
                {modal.parts.map((p, idx) => (
                  <div key={idx} className="bd-part-row">
                    <input placeholder="Item (e.g. Spotify)" value={p.name} onChange={e => setModal({ ...modal, parts: modal.parts.map((x, j) => j === idx ? { ...x, name: e.target.value } : x) })} />
                    <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" value={p.amount} onChange={e => setModal({ ...modal, parts: modal.parts.map((x, j) => j === idx ? { ...x, amount: e.target.value } : x) })} aria-label="Item amount" />
                    <button type="button" className="budget-remove" aria-label="Remove item" onClick={() => setModal({ ...modal, parts: modal.parts.filter((_, j) => j !== idx) })}>✕</button>
                  </div>
                ))}
                <button type="button" className="bd-mini" onClick={() => setModal({ ...modal, parts: [...modal.parts, { name: '', amount: '' }] })}>＋ Add item</button>
                <small className="bd-dim" style={{ display: 'block', marginTop: 6 }}>Split this category into line items — the total becomes the budget.</small>
              </div>
              )}
              <div className="field">
                <label>Icon</label>
                <div className="bd-picker">
                  {modal.icon && !ICONS.includes(modal.icon) && (
                    <button type="button" className="bd-pick bd-pick-on" aria-label={`Icon ${modal.icon}`}>{modal.icon}</button>
                  )}
                  {ICONS.map(i => (
                    <button key={i} type="button" className={`bd-pick ${modal.icon === i ? 'bd-pick-on' : ''}`} onClick={() => setModal({ ...modal, icon: i })} aria-label={`Icon ${i}`}>{i}</button>
                  ))}
                </div>
                <div className="bd-custom-emoji">
                  <input
                    value=""
                    onChange={e => { const em = firstEmoji(e.target.value); if (em) setModal({ ...modal, icon: em }) }}
                    placeholder="Or type / paste any emoji 😀"
                    aria-label="Custom emoji"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="field">
                <label>Colour</label>
                <div className="bd-picker">
                  {COLORS.map(c => (
                    <button key={c} type="button" className={`bd-swatch ${modal.color === c ? 'bd-swatch-on' : ''}`} style={{ background: c }} onClick={() => setModal({ ...modal, color: c })} aria-label={`Colour ${c}`} />
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Group (optional)</label>
                <input list="bd-groups" placeholder="Needs, Wants, Fun money…" value={modal.grp} onChange={e => setModal({ ...modal, grp: e.target.value })} />
                <datalist id="bd-groups">{existingGroups.map(g => <option key={g} value={g} />)}</datalist>
              </div>
              {modal.kind === 'expense' && (
                <>
                  <label className="bd-check">
                    <input type="checkbox" checked={modal.isBill} onChange={e => setModal({ ...modal, isBill: e.target.checked })} />
                    <span>This is a bill with a due day</span>
                  </label>
                  {modal.isBill && (
                    <div className="field"><label>Due on day of the month</label><input type="number" min="1" max="31" inputMode="numeric" value={modal.dueDay} onChange={e => setModal({ ...modal, dueDay: e.target.value })} placeholder="e.g. 1" /></div>
                  )}
                  {goals.length > 0 && (
                    <div className="field"><label>Link to a savings goal (optional)</label>
                      <select value={modal.goalId} onChange={e => setModal({ ...modal, goalId: e.target.value })}>
                        <option value="">Not linked</option>
                        {goals.map(g => <option key={g.id} value={g.id}>{g.icon || '💰'} {g.name}</option>)}
                      </select>
                      <small className="bd-dim">Contributions to the goal count as spending on this line.</small>
                    </div>
                  )}
                  {modal.amountMode !== 'fund' && (
                    <label className="bd-check">
                      <input type="checkbox" checked={modal.rollover} onChange={e => setModal({ ...modal, rollover: e.target.checked })} />
                      <span>Roll over unspent money to the next {unit}</span>
                    </label>
                  )}
                  {modal.rollover && modal.amountMode !== 'fund' && (
                    <div className="field">
                      <select value={modal.rolloverMode} onChange={e => setModal({ ...modal, rolloverMode: e.target.value })} aria-label="Rollover style">
                        <option value="prev">Only last {unit}'s leftover</option>
                        <option value="all">Keep accumulating over many {unit}s</option>
                      </select>
                      <label className="bd-check" style={{ marginTop: 8 }}>
                        <input type="checkbox" checked={modal.carryDebt} onChange={e => setModal({ ...modal, carryDebt: e.target.checked })} />
                        <span>If I overspend, take it off next {unit}</span>
                      </label>
                    </div>
                  )}
                </>
              )}
              <div className="field">
                <label>Notes (optional)</label>
                <input value={modal.notes} onChange={e => setModal({ ...modal, notes: e.target.value })} placeholder="e.g. Includes Woolies + Checkers" />
              </div>
              {!modal.id && period?.type !== 'custom' && (
                <div className="field">
                  <label>Repeat</label>
                  <select value={modal.forward} onChange={e => setModal({ ...modal, forward: Number(e.target.value) })}>
                    <option value={0}>This {unit} only</option>
                    <option value={2}>This + next 2 {unit}s</option>
                    <option value={5}>This + next 5 {unit}s</option>
                    <option value={11}>This + next 11 {unit}s</option>
                  </select>
                </div>
              )}
              <div className="modal-actions">
                {modal.id ? <button type="button" className="btn-delete" onClick={deleteLine}>Delete</button> : <span />}
                <div className="modal-actions-right">
                  <button type="button" className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
