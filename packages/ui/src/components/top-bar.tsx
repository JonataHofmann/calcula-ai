import { IconButton, SearchField } from '../index.js';
import { Avatar } from './avatar.js';
import { cn } from '../lib/cn.js';

export interface TopBarProps {
  /** Busca (controlada). */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Período (delega para PeriodSelector externo). */
  period?: React.ReactNode;
  /** Usuário logado. */
  user?: { name: string; email?: string; avatar?: string };
  /** Ações extras (ThemeToggle, notificações, etc.). */
  actions?: React.ReactNode;
  /** Callback do menu mobile. */
  onMenuClick?: () => void;
  className?: string;
}

/* Spec §7: TopBar — barra superior fixa. h-16, bg-background/80 backdrop-blur, border-border.
   Menu (mobile) | Search (flex-1 max-w-[480px]) | Period | Actions | Avatar. */
export function TopBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  period,
  user,
  actions,
  onMenuClick,
  className,
}: TopBarProps) {
  return (
    <header className={cn('bg-background/80 border-border sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-6', className)}>
      {onMenuClick ? (
        <IconButton aria-label="Abrir menu" onClick={onMenuClick} className="md:hidden">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1={3} y1={12} x2={21} y2={12} />
            <line x1={3} y1={6} x2={21} y2={6} />
            <line x1={3} y1={18} x2={21} y2={18} />
          </svg>
        </IconButton>
      ) : null}

      <SearchField
        value={searchValue}
        onChange={onSearchChange ? (e) => onSearchChange(e.currentTarget.value) : undefined}
        placeholder={searchPlaceholder}
        aria-label="Buscar"
        className="hidden max-w-[480px] flex-1 sm:block"
      />

      <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
        {period ? <div className="hidden lg:block">{period}</div> : null}
        {actions}
        {user ? (
          <div className="flex items-center gap-2.5 pl-1">
            <Avatar name={user.name} alt={user.name} src={user.avatar} size="lg" />
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-text text-sm font-semibold">{user.name}</span>
              {user.email ? <span className="text-text-muted text-xs">{user.email}</span> : null}
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
}