import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{ padding: 16, maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' }}>
        <h1 style={{ marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          The app hit an unexpected error and stopped rendering. Open DevTools → Console to see the exact message.
        </p>
        <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.06)', padding: 12, borderRadius: 12, overflow: 'auto' }}>
{String(this.state.error?.message || this.state.error || 'Unknown error')}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.15)', background: 'white', cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    )
  }
}
