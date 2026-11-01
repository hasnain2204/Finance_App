import { Trash2 } from 'lucide-react';

export function ConfirmDialog({
  open,
  titleId,
  title,
  description,
  onCancel,
  onConfirm,
  confirmLabel = 'Delete',
  confirmClassName = 'dialog-delete',
  dialogClassName = '',
  showTrashIcon = true
}) {
  if (!open) return null;

  return (
    <div className="delete-overlay" role="presentation">
      <section
        className={['delete-dialog', dialogClassName].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        {typeof description === 'string' ? <p>{description}</p> : description}
        <div className="delete-dialog-actions">
          <button type="button" className="dialog-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className={confirmClassName} onClick={onConfirm}>
            {showTrashIcon ? <Trash2 size={confirmClassName === 'restore-confirm-button' ? 18 : 17} aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
