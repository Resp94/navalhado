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

  const navTabClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-2 py-3 text-sm font-bold bg-transparent border-none border-b-[3px] -mb-0.5 cursor-pointer transition-all duration-200 ease-in outline-none no-underline whitespace-nowrap shrink-0 ${
      isActive
        ? 'text-text-primary border-b-brand-primary'
        : 'text-text-secondary border-b-transparent hover:text-brand-primary'
    }`;

  return (
    <div className="flex flex-col gap-6 w-full pb-12 animate-[slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="financeiro-desktop-view">
        <header className="flex flex-col gap-4 justify-between items-start md:flex-row md:items-center">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-text-primary m-0 tracking-[-0.02em] [&_svg]:text-brand-primary">
              Hub financeiro
            </h1>
            <p className="text-sm text-text-primary mt-1 leading-[1.4]">
              Acompanhe o faturamento em tempo real, controle o caixa diário e realize os repasses da sua equipe.
            </p>
          </div>
        </header>
      </div>

      {/* Navegação entre abas: links de rota, visíveis também no celular com rolagem horizontal. */}
      <nav
        className="flex items-center gap-6 border-b-2 border-border pb-0 mt-2 max-md:overflow-x-auto max-md:[-webkit-overflow-scrolling:touch] max-md:flex-nowrap"
        aria-label="Abas financeiras"
      >
        <NavLink to="/financeiro/caixa" className={navTabClass}>
          <HugeiconsIcon icon={Coins01Icon} size={18} />
          Caixa diário e turnos
        </NavLink>

        <NavLink to="/financeiro/comissoes" className={navTabClass}>
          <HugeiconsIcon icon={UserGroupIcon} size={18} />
          Repasses de comissões
        </NavLink>

        <NavLink to="/financeiro/cadastros" className={navTabClass}>
          <HugeiconsIcon icon={Invoice01Icon} size={18} />
          Plano de contas
        </NavLink>

        <NavLink to="/financeiro/contas-a-pagar" className={navTabClass}>
          <HugeiconsIcon icon={CreditCardIcon} size={18} />
          Contas a pagar
          {contadorAlerta > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 ml-1.5 rounded-full bg-error text-white text-[0.7rem] font-extrabold leading-none"
              aria-label={`${contadorAlerta} contas vencidas ou vencendo hoje`}
            >
              {contadorAlerta}
            </span>
          )}
        </NavLink>

        <NavLink to="/financeiro/fluxo-de-caixa" className={navTabClass}>
          <HugeiconsIcon icon={ChartLineData01Icon} size={18} />
          Fluxo de Caixa Projetado
        </NavLink>
      </nav>

      <Outlet context={outletContext} />
    </div>
  );
};
