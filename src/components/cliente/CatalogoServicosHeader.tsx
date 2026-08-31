import React from 'react';

interface CatalogoServicosHeaderProps {
  tenantName?: string;
  tenantLogoUrl?: string | null;
}

export const CatalogoServicosHeader: React.FC<CatalogoServicosHeaderProps> = ({
  tenantName,
  tenantLogoUrl,
}) => {
  const displayName = tenantName?.trim() || 'Barbearia Navalhado';

  return (
    <header className="w-full max-w-[420px] mx-auto pt-4 pb-2 px-4">
      <div className="bg-white rounded-2xl border border-[#EADED6] p-5 shadow-xs flex flex-col items-center justify-center text-center">
        {/* Logo Oficial Navalhado */}
        <div className="w-14 h-14 rounded-xl bg-[#D96C00] border-2 border-[#FFF1E6] shadow-xs flex items-center justify-center mb-3 overflow-hidden p-2.5">
          <img
            src={tenantLogoUrl || '/simbolo.svg'}
            alt="Logotipo da Barbearia"
            className="w-full h-full object-contain filter brightness-0 invert"
          />
        </div>

        {/* Nome do Estabelecimento */}
        <h1 className="text-base font-extrabold text-[#2D231E] tracking-tight leading-tight m-0">
          {displayName}
        </h1>
      </div>
    </header>
  );
};
