import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const spinnerVariants = cva('inline-block animate-spin rounded-full border-current border-t-transparent align-[-0.125em]', {
  variants: {
    size: {
      xs: 'size-3 border-2',
      sm: 'size-4 border-2',
      md: 'size-6 border-2',
      lg: 'size-8 border-[3px]',
      xl: 'size-12 border-4',
    },
    tone: {
      primary: 'text-primary',
      secondary: 'text-secondary-foreground',
      muted: 'text-muted-foreground',
      accent: 'text-accent',
      destructive: 'text-destructive',
      /** For use on a coloured surface (e.g. inside a primary button). */
      onColor: 'text-primary-foreground',
      /** Inherit the colour of the parent element. */
      current: 'text-current',
    },
  },
  defaultVariants: {
    size: 'md',
    tone: 'primary',
  },
});

export interface SpinnerProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>,
    VariantProps<typeof spinnerVariants> {
  /**
   * Accessible label announced to screen readers.
   * Set to `null` when the spinner sits next to visible loading text,
   * so the state is not announced twice.
   */
  label?: string | null;
}

/**
 * The single spinner primitive for the whole app.
 * Do not create another spinner — add a variant here instead.
 */
export function Spinner({ size, tone, label = 'Đang tải', className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(spinnerVariants({ size, tone }), className)}
      {...props}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export { spinnerVariants };
export default Spinner;
