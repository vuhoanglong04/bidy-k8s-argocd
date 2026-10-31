import { cn } from '@/lib/utils';

import { Spinner } from './Spinner';

export interface PageLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  /**
   * `page` (default) fills the viewport minus the header — use in `loading.tsx`.
   * `section` fills its parent — use for a panel or tab body.
   */
  variant?: 'page' | 'section';
}

/**
 * Route- and section-level loading state.
 * Use directly as the body of an App Router `loading.tsx`.
 */
export function PageLoader({ message = 'Đang tải...', variant = 'page', className, ...props }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex w-full flex-col items-center justify-center gap-4',
        variant === 'page' ? 'min-h-[60vh]' : 'min-h-48 py-12',
        className,
      )}
      {...props}
    >
      <Spinner size="xl" label={null} />
      <p className="text-muted-foreground text-sm font-medium">{message}</p>
    </div>
  );
}

export default PageLoader;
