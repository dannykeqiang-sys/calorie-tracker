import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(155deg, #e8efe4 0%, #d8e8f6 35%, #e8daf4 100%)',
            padding: '2rem',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              padding: '3rem 2rem',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 1.5rem',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle style={{ width: '32px', height: '32px', color: '#ef4444' }} />
            </div>

            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#1f2937',
                marginBottom: '0.75rem',
              }}
            >
              应用遇到了一些问题
            </h1>

            <p
              style={{
                fontSize: '0.95rem',
                color: '#6b7280',
                marginBottom: '2rem',
                lineHeight: '1.6',
              }}
            >
              请尝试刷新页面，如果问题持续存在，请联系技术支持。
            </p>

            {this.state.error && (
              <details
                style={{
                  marginBottom: '1.5rem',
                  textAlign: 'left',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  padding: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem',
                  }}
                >
                  错误详情
                </summary>
                <pre
                  style={{
                    marginTop: '0.75rem',
                    color: '#6b7280',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                  }}
                >
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleRetry}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.875rem 2rem',
                fontSize: '1rem',
                fontWeight: '600',
                color: '#fff',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
              }}
            >
              <RefreshCw style={{ width: '20px', height: '20px' }} />
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
