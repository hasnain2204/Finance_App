export function StatusMessage({ type = 'idle', message = '', className = 'status' }) {
  if (!message) return null;
  return (
    <p className={`${className} ${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {message}
    </p>
  );
}
