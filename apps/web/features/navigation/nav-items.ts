import {
  CreditCard,
  FileClock,
  FileUp,
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
  { label: 'Previsão de Despesas', href: '/previsao-despesas', icon: TrendingDown },
  { label: 'Transações', href: '/transacoes', icon: Receipt },
  { label: 'Contas', href: '/contas', icon: Wallet },
  { label: 'Categorias', href: '/categorias', icon: Tags },
  { label: 'Cartões', href: '/cartoes', icon: CreditCard },
  { label: 'Orçamentos', href: '/orcamentos', icon: PiggyBank },
  { label: 'Metas', href: '/metas', icon: Target },
  { label: 'Importar Fatura', href: '/importar-fatura', icon: FileUp },
  { label: 'Bancos', href: '/bancos', icon: Landmark },
  { label: 'Transações Importadas', href: '/transacoes-importadas', icon: FileClock },
];
