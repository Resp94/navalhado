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
    <header className="cliente-container catalogo-header">
      {/* Logo Oficial Navalhado Original */}
      <div className="catalogo-header__logo-wrapper">
        <img
          src={tenantLogoUrl || '/simbolo.svg'}
          alt="Logotipo da Barbearia"
          className="catalogo-header__logo-img"
        />
      </div>

      {/* Nome do Estabelecimento */}
      <h1 className="catalogo-header__title">
        {displayName}
      </h1>
    </header>
  );
};
