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
          .select('role, is_active, tenant_id')
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

        if (profile.role !== 'proprietario') {
          if (!profile.tenant_id) {
            throw new Error('Tenant do usuário não encontrado.');
          }

          const { data: suspendedSubscriptions, error: subscriptionError } = await supabase
            .from('tenant_subscriptions')
            .select('status')
            .eq('tenant_id', profile.tenant_id)
            .eq('status', 'suspended')
            .limit(1);

          if (subscriptionError) {
            throw subscriptionError;
          }

          if (suspendedSubscriptions && suspendedSubscriptions.length > 0) {
            addToast('A assinatura desta barbearia está suspensa.', 'error');
            await supabase.auth.signOut();
            if (isMounted) {
              setAuthenticated(false);
              setLoading(false);
              navigate('/');
            }
            return;
          }
        }

        // Validar role
        if (allowedRole && profile.role !== allowedRole) {
          addToast('Você não tem permissão para acessar esta área.', 'warning');
          
          // Redireciona para a rota padrão correspondente ao role dele
          const routes: Record<string, string> = {
            proprietario: '/admin/dashboard',
            gerente: '/agenda',
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
        <div className="min-h-screen bg-bg-primary text-text-primary p-8 flex flex-col gap-8">
          {/* Header Skeleton */}
          <header className="flex justify-between items-center pb-6 border-b border-border w-full">
            <div className="w-[250px] h-8 rounded-md bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
            <div className="flex items-center gap-4">
              <div className="w-[100px] h-6 rounded-full bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
              <div className="w-20 h-9 rounded-md bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
            </div>
          </header>

          {/* Main Body Skeleton */}
          <main className="flex flex-col gap-8 max-w-[1200px] w-full mx-auto">
            {/* Grid de Cards */}
            <div className="grid [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] gap-6 w-full">
              <div className="h-[110px] rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
              <div className="h-[110px] rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
              <div className="h-[110px] rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
              <div className="h-[110px] rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
            </div>

            {/* Grafico Placeholder */}
            <div className="h-[300px] w-full rounded-lg bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />

            {/* Lista / Tabela Placeholder */}
            <div className="flex flex-col gap-4 w-full">
              <div className="h-14 w-full rounded-md bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
              <div className="h-14 w-full rounded-md bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
              <div className="h-14 w-full rounded-md bg-[linear-gradient(90deg,var(--color-bg-secondary)_25%,var(--color-border)_37%,var(--color-bg-secondary)_63%)] bg-[length:400%_100%] animate-shimmer" />
            </div>
          </main>
        </div>
      </>
    );
  }

  return authenticated ? <>{children}</> : null;
};
