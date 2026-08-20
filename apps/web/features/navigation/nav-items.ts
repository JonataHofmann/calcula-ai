import {
  CreditCard,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Tags,
  Target,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Visão Geral', href: '/', icon: LayoutDashboard },
  { label: 'Contas', href: '/contas', icon: Wallet },
  { label: 'Categorias', href: '/categorias', icon: Tags },
  { label: 'Transações', href: '/transacoes', icon: Receipt },
  { label: 'Previsão de Despesas', href: '/previsao-despesas', icon: TrendingDown },
  { label: 'Cartões', href: '/cartoes', icon: CreditCard },
  { label: 'Bancos', href: '/bancos', icon: Landmark },
  { label: 'Orçamentos', href: '/orcamentos', icon: PiggyBank },
  { label: 'Metas', href: '/metas', icon: Target },
];
