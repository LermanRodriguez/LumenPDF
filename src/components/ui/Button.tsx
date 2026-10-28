import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  /** Solo icono (botón cuadrado). */
  iconOnly?: boolean;
  pressed?: boolean;
}

export function Button({ variant = 'default', size = 'md', icon, iconOnly, pressed, className, children, type = 'button', ...rest }: ButtonProps) {
  const classes = [
    'btn',
    variant === 'primary' && 'btn-primary',
    variant === 'ghost' && 'btn-ghost',
    variant === 'danger' && 'btn-danger',
    size === 'sm' && 'btn-sm',
    size === 'lg' && 'btn-lg',
    iconOnly && 'btn-icon',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} aria-pressed={pressed} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
