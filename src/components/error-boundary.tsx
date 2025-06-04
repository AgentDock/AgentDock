'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    console.error('Uncaught error:', error, errorInfo);
  }

  public componentDidUpdate(prevProps: Props) {
    if (
      this.props.resetOnPropsChange &&
      this.state.hasError &&
      prevProps !== this.props
    ) {
      this.handleRetry();
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  private getErrorMessage(error: Error | null): string {
    if (!error) return 'An unexpected error occurred';

    // Handle known error types
    if (error.name === 'SecurityError') {
      return 'A security error occurred. Please check your permissions.';
    }
    if (error.name === 'NetworkError') {
      return 'A network error occurred. Please check your connection.';
    }
    if (error.name === 'ValidationError') {
      return 'Invalid data provided. Please check your input.';
    }
    if (error.name === 'StorageError') {
      return 'Failed to access storage. Please check your browser settings.';
    }

    // Return the actual error message if available
    return error.message || 'An unexpected error occurred';
  }

  private ErrorFallback = () => {
    const errorMessage = this.getErrorMessage(this.state.error);
    const isNetworkError = this.state.error?.name === 'NetworkError';
    const isStorageError = this.state.error?.name === 'StorageError';

    return (
      <Alert
        variant="destructive"
        className="my-4"
      >
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col gap-4">
          <p className="text-sm">{errorMessage}</p>

          {/* Show technical details in development */}
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <pre className="text-xs bg-muted p-2 rounded-md overflow-auto">
              <code>
                {this.state.error?.stack}\n\nComponent Stack:\n
                {this.state.errorInfo.componentStack}
              </code>
            </pre>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>

            {(isNetworkError || isStorageError) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = '/')}
              >
                <Home className="mr-2 h-4 w-4" />
                Back to home
              </Button>
            )}
          </div>

          {isNetworkError && (
            <p className="text-sm text-muted-foreground">
              Tip: Check your internet connection and try again.
            </p>
          )}
          {isStorageError && (
            <p className="text-sm text-muted-foreground">
              Tip: Try clearing your browser cache or using a different browser.
            </p>
          )}
        </AlertDescription>
      </Alert>
    );
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <this.ErrorFallback />;
    }

    return this.props.children;
  }
}
