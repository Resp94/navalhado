import { useState } from 'react';

function App() {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.body.classList.toggle('dark-theme');
  };

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', minHeight: '100vh', justifyContent: 'center' }}>
      <div style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        <h1 style={{ color: 'var(--color-brand-primary)', marginBottom: '0.5rem' }}>Navalhado SaaS</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
          Design System configurado com Tema {isDark ? 'Escuro' : 'Claro'} por padrão.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button style={{
            backgroundColor: 'var(--color-brand-primary)',
            color: '#FFF1E6',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '1rem',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--color-brand-hover)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--color-brand-primary)'}
          >
            Agendar Atendimento
          </button>

          <button 
            onClick={toggleTheme}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              padding: '0.5rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.875rem'
            }}
          >
            Alternar para Tema {isDark ? 'Claro' : 'Escuro'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
