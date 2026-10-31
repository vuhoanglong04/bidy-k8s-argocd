import { cn } from '@/lib/utils';

import { PageLoader } from './PageLoader';

export interface LoadingStateProps {
  /** Typically `query.isPending` from TanStack Query. */
  isLoading: boolean;
  /** Typically `query.isError`. */
  isError?: boolean;
  /** Rendered when `isError` and no `errorFallback` is given. */
  error?: unknown;
  /** True when the request succeeded but returned nothing to show. */
  isEmpty?: boolean;

  /** Custom loading UI — pass a skeleton here to avoid layout shift. */
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  emptyFallback?: React.ReactNode;

  /** Message shown by the default empty state. */
  emptyMessage?: string;
  /** Retry handler shown by the default error state. */
  onRetry?: () => void;

  className?: string;
  children: React.ReactNode;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

/**
 * One place to render the loading / error / empty / content branches of a query,
 * so pages stop re-implementing `if (isLoading) return <Spinner/>` by hand.
 *
 * @example
 * const { data, isPending, isError, error, refetch } = useProducts();
 * <LoadingState
 *   isLoading={isPending}
 *   isError={isError}
 *   error={error}
 *   isEmpty={!data?.length}
 *   onRetry={refetch}
 *   loadingFallback={<ProductGridSkeleton />}
 * >
 *   <ProductGrid items={data!} />
 * </LoadingState>
 */
export function LoadingState({
  isLoading,
  isError = false,
  error,
  isEmpty = false,
  loadingFallback,
  errorFallback,
  emptyFallback,
  emptyMessage = 'Không có dữ liệu.',
  onRetry,
  className,
  children,
}: LoadingStateProps) {
  if (isLoading) {
    return <div className={className}>{loadingFallback ?? <PageLoader variant="section" />}</div>;
  }

  if (isError) {
    if (errorFallback) return <div className={className}>{errorFallback}</div>;

    return (
      <div
        role="alert"
        className={cn('flex min-h-48 flex-col items-center justify-center gap-3 px-4 py-12 text-center', className)}
      >
        <p className="text-destructive text-sm font-medium">{resolveErrorMessage(error)}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="border-border text-foreground hover:bg-secondary-hover focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Thử lại
          </button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    if (emptyFallback) return <div className={className}>{emptyFallback}</div>;

    return (
      <div className={cn('flex min-h-48 items-center justify-center px-4 py-12 text-center', className)}>
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default LoadingState;
