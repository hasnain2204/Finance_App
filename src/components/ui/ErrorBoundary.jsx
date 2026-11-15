import { Component } from 'react';
import { CircleAlert, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PWS Application Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="loading-shell" role="alert" aria-live="assertive">
          <section className="panel" style={{ textAlign: 'center', padding: '2rem 1.5rem', marginTop: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: '#d02222' }}>
              <CircleAlert size={48} />
            </div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Something went wrong</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              An unexpected error occurred while loading this view. Your local data remains safe.
            </p>
            <button
              type="button"
              className="primary-action"
              onClick={this.handleReload}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}
            >
              <RefreshCw size={16} /> Reload App
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
