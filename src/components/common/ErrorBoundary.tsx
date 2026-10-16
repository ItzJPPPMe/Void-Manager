import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("VOID yakaladı:", error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-void-950 p-8 text-center text-slate-200">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wide">
            Beklenmeyen bir hata oluştu
          </h1>
          <p className="max-w-md font-mono text-xs text-slate-400">
            {this.state.message || "Bilinmeyen hata"}
          </p>
          <button onClick={this.handleReload} className="btn-primary">
            <RefreshCw className="h-4 w-4" />
            Yeniden Yükle
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
