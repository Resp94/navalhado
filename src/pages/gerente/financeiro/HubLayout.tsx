import React from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserGroupIcon,
  Coins01Icon,
  ChartLineData01Icon,
  Invoice01Icon,
} from '@hugeicons/core-free-icons';
import type { TenantContextType } from '../../../components/GerenteLayout';
import '../Financeiro.css';

/**
 * Layout do Hub Financeiro (`/financeiro`): título e navegação entre abas por link de rota, com
 * estado ativo derivado da URL. `/financeiro` sem sub-rota e qualquer sub-rota desconhecida
 * redirecionam para `/financeiro/caixa` (ver rotas em `App.tsx`), então o botão voltar não cai
 * num redirecionamento em laço.
 *
 * Repassa o contexto do tenant, recebido do `GerenteLayout`, às rotas-filhas por `Outlet`. O
 * layout do painel (sem segmento de URL) o estende com o estado compartilhado de Caixa e
 * Comissões em vez de substituí-lo. A aba Plano de contas (035) não tem período: é rota-filha
 * direta desta, fora do layout do painel, e lê só o contexto do tenant.
 */
export const FinanceiroHub: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();

  return (
    <div className="financeiro-page">
      <div className="financeiro-desktop-view">
        <header className="financeiro-header">
          <div>
            <h1 className="financeiro-header-title">
              Hub financeiro
            </h1>
            <p className="financeiro-header-subtitle">
              Acompanhe o faturamento em tempo real, controle o caixa diário e realize os repasses da sua equipe.
            </p>
          </div>
        </header>
      </div>

      {/* Navegação entre abas: links de rota, visíveis também no celular com rolagem horizontal. */}
      <nav className="financeiro-nav-tabs" aria-label="Abas financeiras">
        <NavLink
          to="/financeiro/caixa"
          className={({ isActive }) => `nav-tab-btn ${isActive ? 'nav-tab-btn--active' : ''}`}
        >
          <HugeiconsIcon icon={Coins01Icon} size={18} />
          Caixa diário e turnos
        </NavLink>

        <NavLink
          to="/financeiro/comissoes"
          className={({ isActive }) => `nav-tab-btn ${isActive ? 'nav-tab-btn--active' : ''}`}
        >
          <HugeiconsIcon icon={UserGroupIcon} size={18} />
          Repasses de comissões
        </NavLink>

        <NavLink
          to="/financeiro/cadastros"
          className={({ isActive }) => `nav-tab-btn ${isActive ? 'nav-tab-btn--active' : ''}`}
        >
          <HugeiconsIcon icon={Invoice01Icon} size={18} />
          Plano de contas
        </NavLink>

        <NavLink
          to="/financeiro/fluxo-de-caixa"
          className={({ isActive }) => `nav-tab-btn ${isActive ? 'nav-tab-btn--active' : ''}`}
        >
          <HugeiconsIcon icon={ChartLineData01Icon} size={18} />
          Fluxo de Caixa Projetado
        </NavLink>
      </nav>

      <Outlet context={tenant} />
    </div>
  );
};
