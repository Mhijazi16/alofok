import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[60dvh] items-center justify-center p-6">
          <div className="glass flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-h3 text-foreground">حدث خطأ غير متوقع</h2>
            <p className="text-body-sm text-muted-foreground">
              {this.state.error?.message || "Something went wrong"}
            </p>
            <button
              onClick={this.handleRetry}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
