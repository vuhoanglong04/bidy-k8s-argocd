import { cn } from '@/lib/utils';

import { Spinner } from './Spinner';

export interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When false the overlay is not rendered at all. */
  show?: boolean;
  /** Optional text shown under the spinner. */
  message?: string;
  /**
   * `container` (default) covers the nearest positioned ancestor —
   * remember to give that ancestor `relative`.
   * `fullscreen` covers the viewport.
   */
  variant?: 'container' | 'fullscreen';
  /** Dim + blur the content behind the overlay. */
  blur?: boolean;
}

/**
 * Scrim shown on top of existing content while an action is in flight
 * (submitting a bid, uploading images, refetching a table).
 * Prefer this over unmounting content, so layout does not jump.
 */
export function LoadingOverlay({
  show = true,
  message,
  variant = 'container',
  blur = true,
  className,
  ...props
}: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'z-50 flex flex-col items-center justify-center gap-3',
        'bg-background/70',
        blur && 'backdrop-blur-sm',
        variant === 'fullscreen' ? 'fixed inset-0' : 'absolute inset-0',
        className,
      )}
      {...props}
    >
      <Spinner size="lg" label={message ? null : 'Đang tải'} />
      {message ? <p className="text-muted-foreground text-sm font-medium">{message}</p> : null}
    </div>
  );
}

export default LoadingOverlay;
