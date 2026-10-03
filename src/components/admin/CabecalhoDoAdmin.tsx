import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui';

interface CabecalhoDoAdminProps {
  nomeDoAdmin: string;
  aoSair: () => void;
}

const ROTA_DO_DASHBOARD = '/admin/dashboard';

const ABAS = [
  { rota: ROTA_DO_DASHBOARD, rotulo: 'Dashboard' },
  { rota: '/admin/tenants', rotulo: 'Barbearias' },
];

/** Barra do topo das telas do Proprietário (Admin > Dashboard e Admin > Barbearias): logo, abas, quem está logado e Sair. */
export const CabecalhoDoAdmin: React.FC<CabecalhoDoAdminProps> = ({ nomeDoAdmin, aoSair }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <header className="flex justify-between items-center gap-2 px-8 py-4 bg-[radial-gradient(ellipse_40%_60%_at_15%_50%,rgba(217,108,0,0.05)_0%,transparent_60%),radial-gradient(ellipse_40%_60%_at_85%_50%,rgba(217,108,0,0.03)_0%,transparent_55%),linear-gradient(145deg,rgba(255,255,255,0.78)_0%,rgba(255,241,230,0.5)_45%,rgba(255,255,255,0.72)_100%)] backdrop-blur-[28px] backdrop-saturate-[200%] border-b border-[rgba(255,255,255,0.25)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(255,255,255,0.15),0_8px_40px_-8px_rgba(45,35,30,0.1),0_1px_4px_rgba(45,35,30,0.04)] sticky top-0 z-[100] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] max-md:px-3 max-md:py-4">
      <div
        className="flex items-center gap-3 cursor-pointer shrink-0 hover:opacity-90 max-md:gap-2"
        onClick={() => navigate(ROTA_DO_DASHBOARD)}
      >
        <div className="flex items-center justify-center">
          <img src="/simbolo.svg" alt="Navalhado" className="w-[34px] h-[34px] block" />
        </div>
        <div>
          <h1 className="text-base font-bold m-0 leading-[1.1] text-text-primary max-[440px]:hidden">Navalhado</h1>
        </div>
      </div>

      <nav
        aria-label="Navegação do Admin"
        className="flex items-center gap-[0.35rem] bg-[radial-gradient(ellipse_50%_100%_at_30%_50%,rgba(217,108,0,0.04)_0%,transparent_70%),rgba(255,255,255,0.45)] p-1 rounded-lg border border-[rgba(255,255,255,0.35)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[12px] backdrop-saturate-[160%] max-md:gap-0"
      >
        {ABAS.map(({ rota, rotulo }) => {
          const atual = pathname === rota;
          return (
            <button
              key={rota}
              type="button"
              onClick={() => navigate(rota)}
              aria-current={atual ? 'page' : undefined}
              className={`flex items-center gap-2 bg-transparent border border-transparent text-sm font-medium cursor-pointer px-2 min-[361px]:px-3 md:px-4 py-[0.45rem] rounded-md no-underline transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] ${
                atual
                  ? 'text-brand-primary bg-bg-secondary border-[rgba(234,222,214,0.8)] font-semibold shadow-[0_1px_2px_rgba(45,35,30,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]'
                  : 'text-text-secondary hover:text-brand-primary hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(234,222,214,0.6)]'
              }`}
            >
              {rotulo}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-6 shrink-0 max-md:gap-0">
        <div className="flex flex-col text-right max-md:hidden">
          <span className="text-sm font-semibold">{nomeDoAdmin}</span>
          <span className="text-xs text-text-secondary">Proprietário</span>
        </div>
        <Button variant="danger-outline" size="sm" onClick={aoSair}>
          Sair
        </Button>
      </div>
    </header>
  );
};
