import React, { useMemo } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserGroupIcon,
  Coins01Icon,
  ChartLineData01Icon,
  Invoice01Icon,
  CreditCardIcon,
} from '@hugeicons/core-free-icons';
import type { TenantContextType } from '../../../components/GerenteLayout';
import { supabase } from '../../../lib/supabase';
import { ContasPagarRepository } from '../../../modules/contas-pagar/ContasPagarRepository';
import { SupabaseContasPagarAdapter } from '../../../modules/contas-pagar/adapters/SupabaseContasPagarAdapter';
import { useContasPagarAlerta } from '../../../modules/contas-pagar/useContasPagarAlerta';
import '../Financeiro.css';

/**
 * Contexto repassado às rotas-filhas do Hub: o contexto do tenant, mais
 * `onContasPagarAlteradas` (ticket 09/036) — a aba Contas a Pagar chama isso
 * depois de qualquer escrita para o selo da navegação recarregar sem esperar
 * o gestor sair e voltar ao Hub. Composto aqui, não como propriedade nova no
 * componente de abas em si.
 */
export interface FinanceiroHubContextType extends TenantContextType {
  onContasPagarAlteradas?: () => void;
}

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
  const tenantId = tenant?.tenantId || '';

  const contasPagarRepository = useMemo(
    () => new ContasPagarRepository(new SupabaseContasPagarAdapter(supabase)),
    []
  );
  const { alerta, reload: recarregarAlerta } = useContasPagarAlerta(tenantId, contasPagarRepository);
  const contadorAlerta = alerta ? alerta.overdueCount + alerta.dueTodayCount : 0;

  const outletContext: FinanceiroHubContextType = {
    ...tenant,
    onContasPagarAlteradas: recarregarAlerta,
  };

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
          to="/financeiro/contas-a-pagar"
          className={({ isActive }) => `nav-tab-btn ${isActive ? 'nav-tab-btn--active' : ''}`}
        >
          <HugeiconsIcon icon={CreditCardIcon} size={18} />
          Contas a pagar
          {contadorAlerta > 0 && (
            <span className="nav-tab-badge" aria-label={`${contadorAlerta} contas vencidas ou vencendo hoje`}>
              {contadorAlerta}
            </span>
          )}
        </NavLink>

        <NavLink
          to="/financeiro/fluxo-de-caixa"
          className={({ isActive }) => `nav-tab-btn ${isActive ? 'nav-tab-btn--active' : ''}`}
        >
          <HugeiconsIcon icon={ChartLineData01Icon} size={18} />
          Fluxo de Caixa Projetado
        </NavLink>
      </nav>

      <Outlet context={outletContext} />

      <style>{`
        .nav-tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.25rem;
          height: 1.25rem;
          padding: 0 0.35rem;
          margin-left: 0.35rem;
          border-radius: 999px;
          background-color: var(--color-error, #B3261E);
          color: #FFFFFF;
          font-size: var(--font-size-xs, 0.7rem);
          font-weight: 800;
          line-height: 1;
        }
      `}</style>
    </div>
  );
};
