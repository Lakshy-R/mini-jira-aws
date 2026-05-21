import { cn, getInitials, getAvatarColor } from '../../lib/utils';

export function Avatar({ name = '', size = 'md', src, className }) {
  const initials = getInitials(name);
  const color = getAvatarColor(name);

  const sizes = {
    xs:  'w-5 h-5 text-[9px]',
    sm:  'w-7 h-7 text-xs',
    md:  'w-8 h-8 text-sm',
    lg:  'w-10 h-10 text-base',
    xl:  'w-12 h-12 text-lg',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover ring-1 ring-border shrink-0', sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold shrink-0 ring-1 ring-inset ring-black/5',
        sizes[size],
        color,
        className
      )}
      title={name}
      aria-label={name}
    >
      {initials || '?'}
    </div>
  );
}
