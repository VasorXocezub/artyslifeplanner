import { useEffect } from 'react'

export default function UndoBar({ message, onUndo, onDismiss, ms = 8000 }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, ms)
    return () => clearTimeout(t)
  }, [message]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="sc-undo" role="status">
      <span>{message}</span>
      <button className="sc-chip-btn" onClick={onUndo}>Undo</button>
    </div>
  )
}
