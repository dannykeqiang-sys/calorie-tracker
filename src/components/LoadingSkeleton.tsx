import type { ReactNode } from 'react';

interface LoadingSkeletonProps {
  message?: string;
}

export default function LoadingSkeleton({ message = '加载中...' }: LoadingSkeletonProps): ReactNode {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(155deg, #e8efe4 0%, #d8e8f6 35%, #e8daf4 100%)',
        gap: '1.5rem',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(16, 185, 129, 0.1)',
          borderTop: '4px solid #10b981',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <div
          style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#374151',
          }}
        >
          {message}
        </div>
        <div
          style={{
            fontSize: '0.85rem',
            color: '#6b7280',
          }}
        >
          请稍候
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
