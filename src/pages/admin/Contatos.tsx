import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { CabecalhoDoAdmin } from '../../components/admin/CabecalhoDoAdmin';
import { ContatosDoSite } from '../../components/admin/ContatosDoSite';

/** Aba Contatos do painel do Proprietário: as mensagens do formulário de contato do site (spec 056). */
export const Contatos: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [adminName, setAdminName] = useState('Administrador');

  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single();
          if (profile?.name) setAdminName(profile.name);
        }
      } catch (error) {
        console.error('Error fetching admin name:', error);
      }
    };
    fetchAdminProfile();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      addToast('Erro ao sair da conta.', 'error');
      return;
    }
    addToast('Logout realizado com sucesso.', 'success');
    navigate('/');
  };

  return (
    <>
      <div className="noise-overlay" />

      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
        <CabecalhoDoAdmin nomeDoAdmin={adminName} aoSair={handleLogout} />

        <main className="flex-1 max-w-[1200px] w-full mx-auto p-8 flex flex-col gap-8 max-md:p-4">
          <section>
            <h2>Contatos do site</h2>
            <p>Mensagens do formulário de contato do site. A resposta é feita fora do Navalhado.</p>
          </section>

          <section className="bg-bg-secondary border border-border rounded-xl shadow-sm overflow-hidden">
            <ContatosDoSite />
          </section>
        </main>
      </div>
    </>
  );
};
