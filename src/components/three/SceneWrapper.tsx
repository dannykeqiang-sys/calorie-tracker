import { Component, type ReactNode, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ThreeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[Three.js] Render error, falling back to 2D:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface SceneWrapperProps {
  children: ReactNode;
  fallback: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function SceneWrapper({ children, fallback, className, style }: SceneWrapperProps) {
  return (
    <ThreeErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Canvas
          className={className}
          style={{
            ...style,
            background: 'transparent',
          }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          camera={{ position: [0, 0, 6], fov: 45 }}
        >
          {children}
        </Canvas>
      </Suspense>
    </ThreeErrorBoundary>
  );
}
