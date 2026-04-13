import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[OPSBOARD] Unhandled error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 12, padding: 40,
        }}>
          <div style={{ fontSize: 24, color: 'var(--danger)' }}>✕</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Something went wrong</div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center',
          }}>
            {this.state.error?.message}
          </div>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            RETRY
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
