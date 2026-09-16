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
    <header className="w-full max-w-[420px] mx-auto px-4 box-border pt-5 pb-3 flex flex-col items-center justify-center text-center">
      {/* Logo Oficial Navalhado Original */}
      <div className="w-9 h-9 flex items-center justify-center mb-1.5 bg-transparent border-none shadow-none overflow-visible p-0 box-border">
        <img
          src={tenantLogoUrl || '/simbolo.svg'}
          alt="Logotipo da Barbearia"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Nome do Estabelecimento */}
      <h1 className="text-base font-extrabold text-text-primary tracking-[-0.02em] leading-[1.2] m-0">
        {displayName}
      </h1>
    </header>
  );
};
