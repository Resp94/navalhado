import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRole?: 'proprietario' | 'gerente' | 'barbeiro';
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, allowedRole }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuthAndRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          if (isMounted) {
            setAuthenticated(false);
            setLoading(false);
            navigate('/');
          }
          return;
        }

        // Buscar dados do perfil do usuário logado
        const { data: profile, error } = await supabase
          .from('users')
          .select('role, is_active')
          .eq('id', session.user.id)
          .single();

        if (error || !profile) {
          throw new Error('Perfil de usuário não encontrado.');
        }

        if (!profile.is_active) {
          addToast('Esta conta foi desativada pelo administrador.', 'error');
          await supabase.auth.signOut();
          if (isMounted) {
            setAuthenticated(false);
            setLoading(false);
            navigate('/');
          }
          return;
        }

        // Validar role
        if (allowedRole && profile.role !== allowedRole) {
          addToast('Você não tem permissão para acessar esta área.', 'warning');
          
          // Redireciona para a rota padrão correspondente ao role dele
          const routes: Record<string, string> = {
            proprietario: '/admin/dashboard',
            gerente: '/dashboard',
            barbeiro: '/minha-agenda'
          };
          
          if (isMounted) {
            setAuthenticated(false);
            setLoading(false);
            navigate(routes[profile.role] || '/');
          }
          return;
        }

        if (isMounted) {
          setAuthenticated(true);
          setLoading(false);
        }
      } catch (error: any) {
        console.error('AuthGuard Error:', error);
        addToast('Erro ao validar permissões de acesso.', 'error');
        if (isMounted) {
          setAuthenticated(false);
          setLoading(false);
          navigate('/');
        }
      }
    };

    checkAuthAndRole();

    // Ouvir alterações no estado da sessão
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setAuthenticated(false);
          setLoading(false);
          navigate('/');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [allowedRole, navigate, addToast]);

  if (loading) {
    return (
      <>
        <div className="noise-overlay" />
        <div className="skeleton-container">
          {/* Header Skeleton */}
          <header className="skeleton-header">
            <div className="skeleton skeleton-title" />
            <div className="skeleton-actions">
              <div className="skeleton skeleton-badge" />
              <div className="skeleton skeleton-btn" />
            </div>
          </header>

          {/* Main Body Skeleton */}
          <main className="skeleton-body">
            {/* Grid de Cards */}
            <div className="skeleton-grid">
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
            </div>

            {/* Grafico Placeholder */}
            <div className="skeleton skeleton-chart" />

            {/* Lista / Tabela Placeholder */}
            <div className="skeleton-table-wrapper">
              <div className="skeleton skeleton-table-row" />
              <div className="skeleton skeleton-table-row" />
              <div className="skeleton skeleton-table-row" />
            </div>
          </main>
        </div>

        <style>{`
          .skeleton-container {
            min-height: 100vh;
            background-color: var(--color-bg-primary);
            color: var(--color-text-primary);
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 2rem;
          }

          .skeleton-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--color-border);
            width: 100%;
          }

          .skeleton-title {
            width: 250px;
            height: 2rem;
          }

          .skeleton-actions {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .skeleton-badge {
            width: 100px;
            height: 1.5rem;
            border-radius: var(--radius-full);
          }

          .skeleton-btn {
            width: 80px;
            height: 2.25rem;
            border-radius: var(--radius-md);
          }

          .skeleton-body {
            display: flex;
            flex-direction: column;
            gap: 2rem;
            max-width: 1200px;
            width: 100%;
            margin: 0 auto;
          }

          .skeleton-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
            width: 100%;
          }

          .skeleton-card {
            height: 110px;
            border-radius: var(--radius-lg);
          }

          .skeleton-chart {
            height: 300px;
            border-radius: var(--radius-lg);
            width: 100%;
          }

          .skeleton-table-wrapper {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            width: 100%;
          }

          .skeleton-table-row {
            height: 3.5rem;
            border-radius: var(--radius-md);
            width: 100%;
          }

          /* --- Skeleton Animation --- */
          .skeleton {
            background: linear-gradient(
              90deg,
              var(--color-bg-secondary) 25%,
              var(--color-border) 37%,
              var(--color-bg-secondary) 63%
            );
            background-size: 400% 100%;
            animation: skeleton-loading 1.4s ease infinite;
            border-radius: var(--radius-md);
          }

          @keyframes skeleton-loading {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
        `}</style>
      </>
    );
  }

  return authenticated ? <>{children}</> : null;
};
