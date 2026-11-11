export default function ConfirmSheet({ title, body, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal sc-confirm" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label={title}>
        <h2>{title}</h2>
        {body && <p className="field-hint">{body}</p>}
        <div className="modal-actions">
          <div />
          <div className="modal-actions-right">
            <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
            <button type="button" className={danger ? 'btn-delete' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
