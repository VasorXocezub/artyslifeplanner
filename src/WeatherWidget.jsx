import { useEffect, useState } from 'react'
import { getLocation, setLocation } from './lib/localPrefs'

const WEATHER_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

function getSeason(date, lat) {
  const month = date.getMonth()
  const isSouthern = lat < 0
  let season
  if ([11, 0, 1].includes(month)) season = 'Winter'
  else if ([2, 3, 4].includes(month)) season = 'Spring'
  else if ([5, 6, 7].includes(month)) season = 'Summer'
  else season = 'Autumn'
  if (isSouthern) {
    const swap = { Winter: 'Summer', Summer: 'Winter', Spring: 'Autumn', Autumn: 'Spring' }
    season = swap[season]
  }
  return season
}

export default function WeatherWidget() {
  const [location, setLocationState] = useState(getLocation())
  const [weather, setWeather] = useState(null)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (location) fetchWeather(location)
  }, [location])

  async function fetchWeather(loc) {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code&daily=sunset&timezone=auto`
      )
      const data = await res.json()
      setWeather(data)
    } catch {
      setWeather(null)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`
      )
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setResults([])
    }
    setSearching(false)
  }

  function selectResult(r) {
    const loc = { name: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}`, lat: r.latitude, lon: r.longitude }
    setLocation(loc)
    setLocationState(loc)
    setEditing(false)
    setResults([])
    setQuery('')
  }

  const now = new Date()
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })

  const temp = weather?.current?.temperature_2m
  const code = weather?.current?.weather_code
  const icon = code != null ? WEATHER_ICONS[code] || '🌡️' : null
  const season = location ? getSeason(now, location.lat) : null
  const sunsetRaw = weather?.daily?.sunset?.[0]
  const sunsetTime = sunsetRaw
    ? new Date(sunsetRaw).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null

  return (
    <div className="weather-widget">
      <p className="hero-subline">
        {dayName}{season ? ` • ${season}` : ''}
      </p>

      {location ? (
        <p className="hero-subline weather-line">
          {icon && `${icon} `}{temp != null ? `${Math.round(temp)}°` : '—'}
          {sunsetTime && <> &nbsp;·&nbsp; 🌙 Sunset {sunsetTime}</>}
          <button type="button" className="weather-location-link" onClick={() => setEditing(!editing)}>
            📍 {location.name}
          </button>
        </p>
      ) : (
        <p className="hero-subline weather-line">
          <button type="button" className="weather-location-link" onClick={() => setEditing(!editing)}>
            📍 Set your location for accurate weather
          </button>
        </p>
      )}

      {editing && (
        <div className="weather-location-editor">
          <form onSubmit={handleSearch} className="weather-search-row">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city…"
            />
            <button type="submit" className="btn-check">{searching ? '…' : 'Search'}</button>
            <button type="button" className="btn-delete-small" onClick={() => setEditing(false)}>Close</button>
          </form>
          {results.length > 0 && (
            <div className="weather-results">
              {results.map((r, i) => (
                <button key={i} className="weather-result-row" onClick={() => selectResult(r)}>
                  {r.name}{r.admin1 ? `, ${r.admin1}` : ''}{r.country ? `, ${r.country}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
