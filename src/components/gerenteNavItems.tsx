import {
  Users,
  UsersFour,
  Scissors,
  Package,
  CurrencyDollar,
  ChartBar,
  WhatsappLogo,
  Gear,
} from '@phosphor-icons/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CalendarUserIcon, Invoice01Icon } from '@hugeicons/core-free-icons';
import type { NavItemConfig } from './GlassSidebar';

export const GERENTE_NAV_ITEMS: NavItemConfig[] = [
  {
    path: '/agenda',
    label: 'Agenda',
    renderIcon: ({ size, isBold }) => (
      <HugeiconsIcon
        icon={CalendarUserIcon}
        size={size}
        color="currentColor"
        strokeWidth={isBold ? 2.2 : 1.7}
      />
    ),
  },
  {
    path: '/comandas',
    label: 'Comandas',
    renderIcon: ({ size, isBold }) => (
      <HugeiconsIcon
        icon={Invoice01Icon}
        size={size}
        color="currentColor"
        strokeWidth={isBold ? 2.2 : 1.7}
      />
    ),
  },
  {
    path: '/clientes',
    label: 'Clientes',
    renderIcon: ({ size, isBold }) => (
      <Users size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/profissionais',
    matchPrefix: true,
    label: 'Equipe',
    renderIcon: ({ size, isBold }) => (
      <UsersFour size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/servicos/cadastro',
    label: 'Serviços',
    renderIcon: ({ size, isBold }) => (
      <Scissors size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/produtos',
    label: 'Produtos',
    renderIcon: ({ size, isBold }) => (
      <Package size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/financeiro',
    matchPrefix: true,
    label: 'Financeiro',
    renderIcon: ({ size, isBold }) => (
      <CurrencyDollar size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    // Módulo de Relatórios (spec 038): rota própria, fora do Hub
    // Financeiro, exclusiva do desktop -- por isso não entra na barra
    // inferior nem na gaveta "Mais" do celular (`MobileBottomNav`,
    // `MobileMaisDrawer`), só nesta sidebar (`GlassSidebar`), que já é
    // exibida apenas acima de 768px.
    path: '/relatorios',
    label: 'Relatórios',
    renderIcon: ({ size, isBold }) => (
      <ChartBar size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/whatsapp',
    label: 'WhatsApp',
    renderIcon: ({ size, isBold }) => (
      <WhatsappLogo size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
  {
    path: '/configuracoes',
    label: 'Ajustes',
    renderIcon: ({ size, isBold }) => (
      <Gear size={size} weight={isBold ? 'bold' : 'regular'} style={{ color: 'currentColor' }} />
    ),
  },
];
