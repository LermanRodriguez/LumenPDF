import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { Brand } from './Brand';

export function Header() {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar-right">
        <span className="privacy-badge" title="Los archivos nunca salen de tu dispositivo. No hay servidores.">
          <Icon name="shield" />
          <span>100% en tu dispositivo</span>
        </span>
        <button className="icon-btn" type="button" onClick={toggleTheme} aria-label="Cambiar tema" title="Cambiar tema claro/oscuro">
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} />
        </button>
      </div>
    </header>
  );
}
