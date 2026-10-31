// Loading primitives — dùng chung toàn app
export { Spinner, LoadingOverlay, PageLoader, LoadingState, Skeleton } from './loading';
export type { SpinnerProps, LoadingOverlayProps, PageLoaderProps, LoadingStateProps } from './loading';

// Stepper dùng chung cho các luồng wizard (đăng sản phẩm, đăng đấu giá)
export { default as WizardStepper, type WizardStep } from './WizardStepper';

// Ảnh có fallback khi src hỏng/rỗng
export { ImageWithFallback, FALLBACK_IMAGE, type ImageWithFallbackProps } from './ImageWithFallback';

// Panel thông báo dùng chung (dropdown chuông user + panel admin)
export {
  NotificationPanel,
  NotificationItem,
  NotificationIcon,
} from './notification';
export type {
  NotificationPanelProps,
  NotificationItemProps,
  NotificationItemData,
  NotificationIconProps,
  NotificationTone,
} from './notification';

// Logo thương hiệu Bidy (tự động chuyển đổi sáng / tối)
export { BrandLogo } from './BrandLogo';
export type { BrandLogoProps } from './BrandLogo';

