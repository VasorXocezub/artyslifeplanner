import { useEffect, useState } from 'react'
import { formatMoney, CURRENCIES } from './lib/currency'

export default function CurrencyConverter({ currency }) {
  const [amount, setAmount] = useState('100')
  const [fromCurrency, setFromCurrency] = useState(currency || 'ZAR')
  const [toCurrency, setToCurrency] = useState(currency === 'USD' ? 'EUR' : 'USD')
  const [rate, setRate] = useState(null)
  const [rateError, setRateError] = useState(false)

  useEffect(() => {
    setFromCurrency(currency || 'ZAR')
  }, [currency])

  useEffect(() => {
    if (fromCurrency === toCurrency) return
    fetchRate()
  }, [fromCurrency, toCurrency])

  async function fetchRate() {
    setRateError(false)
    setRate(null)
    try {
      const res = await fetch(`https://api.frankfurter.dev/v2/rate/${fromCurrency}/${toCurrency}`)
      const data = await res.json()
      if (data?.rate) setRate(data.rate)
      else setRateError(true)
    } catch {
      setRateError(true)
    }
  }

  function swap() {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  const amountNum = parseFloat(amount) || 0

  return (
    <div>
      <div className="view-header">
        <div>
          <p className="view-subtitle">Convert between any two currencies, smooth sailing 🧭</p>
        </div>
      </div>

      <div className="calendar-card converter-card">
        <div className="field">
          <label>Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="converter-currency-row">
          <select
            className="converter-currency-select"
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
          <button type="button" className="converter-swap-btn" onClick={swap} title="Swap">⇄</button>
          <select
            className="converter-currency-select"
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>

        <div className="converter-divider" />

        <p className="module-group-label">RESULT</p>
        <p className="converter-total">
          {fromCurrency === toCurrency
            ? formatMoney(amountNum, toCurrency)
            : rate
            ? formatMoney(amountNum * rate, toCurrency)
            : rateError
            ? '—'
            : 'Loading…'}
        </p>

        {fromCurrency !== toCurrency && rate && (
          <p className="converter-rate-note">1 {fromCurrency} ≈ {formatMoney(rate, toCurrency)}</p>
        )}
        {fromCurrency !== toCurrency && rateError && (
          <p className="converter-rate-note">Couldn't fetch live rates right now.</p>
        )}
      </div>
    </div>
  )
}
