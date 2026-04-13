import { useToastStore, Toast } from '../../store/toast.store'

const ICONS: Record<Toast['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: '○',
}

const COLORS: Record<Toast['type'], string> = {
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--accent)',
}

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      zIndex: 9999,
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: 'var(--bg-elevated)',
            border: `1px solid ${COLORS[t.type]}44`,
            borderLeft: `3px solid ${COLORS[t.type]}`,
            borderRadius: 'var(--radius)',
            minWidth: 280,
            maxWidth: 400,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            pointerEvents: 'all',
            cursor: 'pointer',
          }}
          onClick={() => remove(t.id)}
        >
          <span style={{ color: COLORS[t.type], fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            {ICONS[t.type]}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>
            {t.message}
          </span>
        </div>
      ))}
    </div>
  )
}
