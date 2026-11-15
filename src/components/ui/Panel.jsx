import { forwardRef } from 'react';

export const Panel = forwardRef(function Panel({ children, className = '', ...props }, ref) {
  return (
    <section ref={ref} className={['panel', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </section>
  );
});

export function PanelHeader({ children, className = '' }) {
  return (
    <div className={['panel-header', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}
