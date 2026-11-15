import { ArrowLeft } from 'lucide-react';

export function BackHeader({ title, onBack, backLabel = 'Back', iconSize = 22 }) {
  return (
    <header className="add-transaction-header">
      <button type="button" className="back-button" onClick={onBack} aria-label={backLabel}>
        <ArrowLeft size={iconSize} />
      </button>
      <h1>{title}</h1>
    </header>
  );
}
