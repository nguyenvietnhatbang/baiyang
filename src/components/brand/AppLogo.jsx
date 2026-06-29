import { APP_LOGO_URL } from '@/lib/qrWithLogo';
import { cn } from '@/lib/utils';

const sizeClass = {
  xs: 'h-6',
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
  xl: 'h-16',
};

export default function AppLogo({ size = 'md', className, alt = 'Baiyang VN' }) {
  return (
    <img
      src={APP_LOGO_URL}
      alt={alt}
      className={cn('w-auto object-contain', typeof size === 'string' ? sizeClass[size] || size : size, className)}
      decoding="async"
    />
  );
}
