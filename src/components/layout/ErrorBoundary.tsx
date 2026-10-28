import { Component, type ErrorInfo, type ReactNode } from 'react';
import { NoticeView } from '@/components/pdf/ResultView';
import { Button } from '@/components/ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Muestra un mensaje amable si una pantalla falla, en lugar de dejarla en blanco. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <NoticeView
        icon="alert"
        title="Algo salió mal"
        subtitle="Ocurrió un error inesperado en esta pantalla. Tus archivos no salieron de tu dispositivo."
        actions={<Button variant="primary" size="lg" icon="rotateCw" onClick={() => window.location.reload()}>Recargar</Button>}
      />
    );
  }
}
