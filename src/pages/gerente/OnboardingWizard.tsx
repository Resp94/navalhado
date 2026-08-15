import React from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';

export const OnboardingWizard: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();

  return (
    <div className="onboarding-wizard-container" data-testid="onboarding-wizard">
      <header className="onboarding-header">
        <h1>Configuração Inicial da Barbearia</h1>
        {tenant && <p>Bem-vindo, {tenant.tenantName}</p>}
      </header>
      <main className="onboarding-content">
        <p>Assistente de configuração em andamento...</p>
      </main>
    </div>
  );
};
