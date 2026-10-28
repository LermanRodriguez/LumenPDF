import { ICON_PATHS, type IconName } from './icons';

interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ? `icon ${className}` : 'icon'}
      aria-hidden="true"
      // Trazos propios definidos en icons.ts (no provienen del usuario)
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}

export type { IconName };
