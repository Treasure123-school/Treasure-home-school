import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function getErrorContext(error: Error | null): { heading: string; description: string } {
  if (!error) {
    return {
      heading: 'Page failed to load',
      description: 'An unexpected error occurred. Try again or reload the page.',
    };
  }
  const msg = error.message.toLowerCase();

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
    return {
      heading: 'Connection error',
      description: 'Unable to reach the server. Please check your internet connection and reload.',
    };
  }
  if (msg.includes('session') || msg.includes('log in') || msg.includes('401')) {
    return {
      heading: 'Session expired',
      description: 'Your session has expired. Please reload the page and log in again.',
    };
  }
  if (msg.includes('permission') || msg.includes('403') || msg.includes('forbidden')) {
    return {
      heading: 'Access denied',
      description: 'You don\'t have permission to view this page.',
    };
  }
  if (msg.includes('not found') || msg.includes('404')) {
    return {
      heading: 'Page not found',
      description: 'The content you\'re looking for could not be found.',
    };
  }
  return {
    heading: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again or reload the page.',
  };
}

/**
 * Global React Error Boundary — catches unhandled React rendering errors
 * and displays a recovery UI instead of a white screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error.message);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { heading, description } = getErrorContext(this.state.error);

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {heading}
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-auto max-h-40 text-red-600 dark:text-red-400">
                {this.state.error.message}
              </pre>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
