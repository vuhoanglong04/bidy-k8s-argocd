import { Spinner, type SpinnerProps } from '@/components/common/loading';

/**
 * @deprecated Dùng `Spinner` từ `@/components/common/loading`.
 * Giữ lại để không phá các call-site cũ; sẽ gỡ sau khi migrate xong.
 */
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'muted';
  className?: string;
}

const colorToTone: Record<NonNullable<LoadingSpinnerProps['color']>, SpinnerProps['tone']> = {
  primary: 'primary',
  white: 'onColor',
  muted: 'muted',
};

export default function LoadingSpinner({ size = 'md', color = 'primary', className }: LoadingSpinnerProps) {
  return <Spinner size={size} tone={colorToTone[color]} className={className} />;
}
