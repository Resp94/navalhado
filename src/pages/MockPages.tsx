import React from 'react';
import { useNavigate } from 'react-router-dom';

// Layout base para os Mocks do Dashboard e outras áreas administrativas
const MockPageLayout: React.FC<{ title: string; subtitle: string; role: string; children?: React.ReactNode }> = ({
  title,
  subtitle,
  role,
  children
}) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Para efeito de protótipo/fluxo de teste, limpamos a navegação
    navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    }}>
      {/* Header Premium do Mock */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--color-border)',
        width: '100%'
      }}>
        <div>
          <h1 style={{ color: 'var(--color-brand-primary)', fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>
            {title}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{
            fontSize: 'var(--font-size-xs)',
            backgroundColor: 'var(--color-brand-lightest)',
            color: 'var(--color-brand-primary)',
            padding: '0.25rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            textTransform: 'uppercase'
          }}>
            Perfil: {role}
          </span>
          
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--color-error)',
              border: '1px solid var(--color-error)',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 'var(--font-size-sm)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-error-bg)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Sair
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '3rem',
        boxShadow: 'var(--shadow-md)',
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto'
      }}>
        {children}
      </main>
    </div>
  );
};

export const DashboardGerente: React.FC = () => {
  return (
    <MockPageLayout 
      title="Painel da Barbearia (Gerente)" 
      subtitle="Controle de agenda geral, equipe e financeiro"
      role="gerente"
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)' }}>Bem-vindo à Agenda Geral</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Esta é a tela de controle do gerente, onde as colunas de barbeiros e agendamentos serão exibidas.
        </p>
      </div>
    </MockPageLayout>
  );
};

export const AgendaBarbeiro: React.FC = () => {
  return (
    <MockPageLayout 
      title="Minha Agenda (Barbeiro)" 
      subtitle="Visualização móvel e finalização de cortes"
      role="barbeiro"
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)' }}>Seus Atendimentos do Dia</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Esta tela é mobile-first e exibe a lista cronológica de clientes agendados para você.
        </p>
      </div>
    </MockPageLayout>
  );
};

export const DashboardSaaSAdmin: React.FC = () => {
  return (
    <MockPageLayout 
      title="Dashboard do SaaS (Proprietário)" 
      subtitle="Administração global da plataforma Navalhado"
      role="proprietario"
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)' }}>Visão Geral do SaaS</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Aqui o dono do SaaS acompanha o MRR, faturamento geral e gerencia as barbearias (tenants) cadastradas.
        </p>
      </div>
    </MockPageLayout>
  );
};

