"use client";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import AnimatedButton from "./AnimatedButton";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
            </div>

            {/* Error Message */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-foreground">
                Oops! Có lỗi xảy ra
              </h1>
              <p className="text-foreground-secondary text-base leading-relaxed">
                Đã xảy ra lỗi không mong muốn. Vui lòng thử lại hoặc quay về trang chính.
              </p>
              
              {/* Error details in development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Chi tiết lỗi (Development)
                  </summary>
                  <div className="mt-2 p-3 bg-muted rounded text-xs font-mono text-left overflow-auto">
                    <div className="text-red-600 font-semibold">
                      {this.state.error.name}: {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <AnimatedButton
                onClick={this.handleRetry}
                variant="primary"
                icon={<RefreshCcw className="w-4 h-4" />}
                className="flex-1 sm:flex-initial"
              >
                Thử lại
              </AnimatedButton>
              
              <AnimatedButton
                onClick={this.handleGoHome}
                variant="outline"
                icon={<Home className="w-4 h-4" />}
                className="flex-1 sm:flex-initial"
              >
                Trang chính
              </AnimatedButton>
            </div>

            {/* Support message */}
            <p className="text-sm text-muted-foreground">
              Nếu lỗi vẫn tiếp tục, vui lòng liên hệ bộ phận hỗ trợ.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;