import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { AvisosQueFalharam } from '../../components/admin/AvisosQueFalharam';
import { CabecalhoDoAdmin } from '../../components/admin/CabecalhoDoAdmin';
import { DetalhesDoTenant } from '../../components/admin/DetalhesDoTenant';
import { dataCurta } from '../../modules/assinatura/apresentacaoDaAssinatura';
import { rotuloDaSituacao, type SituacaoDaAssinatura } from '../../modules/assinatura/situacaoDaAssinatura';
import { InfoIcon, SearchIcon } from '../../components/Icons';

interface TenantManagementItem {
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string;
  tenant_logo_url: string | null;
  tenant_created_at: string;
  plan_name: string | null;
  plan_price: number | null;
  subscription_status: SituacaoDaAssinatura | null;
  subscription_end_date: string | null;
  whatsapp_status: 'connected' | 'connecting' | 'disconnected' | 'hibernated' | null;
  /** Até quando uma barbearia bloqueada foi liberada à mão (o fim de um dia no fuso dela), ou nulo. */
  subscription_unblocked_until: string | null;
  tenant_timezone: string | null;
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  connected: 'bg-success-bg text-success',
  active: 'bg-success-bg text-success',
  connecting: 'bg-warning-bg text-warning',
  hibernated: 'bg-text-secondary/[0.08] text-text-secondary',
  blocked: 'bg-warning-bg text-warning',
  trialing: 'bg-info-bg text-info',
  courtesy: 'bg-info-bg text-info',
  disconnected: 'bg-error-bg text-error',
  past_due: 'bg-error-bg text-error',
  canceled: 'bg-error-bg text-error',
};

// Os quatro estados da Instância WhatsApp (CONTEXT.md), com os rótulos da tela do Gerente (Whatsapp.tsx).
const ROTULO_DO_WHATSAPP: Record<NonNullable<TenantManagementItem['whatsapp_status']>, string> = {
  connected: 'Conectado',
  connecting: 'Pareando',
  hibernated: 'Pausado',
  disconnected: 'Desconectado',
};

export const Tenants: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantManagementItem[]>([]);
  const [search, setSearch] = useState('');
  // A barbearia cuja visão de detalhe (e as ações do Proprietário) está aberta.
  const [tenantAberto, setTenantAberto] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('Administrador');

  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('name')
            .eq('id', user.id)
            .single();
          if (profile?.name) {
            setAdminName(profile.name);
          }
        }
      } catch (error) {
        console.error('Error fetching admin name:', error);
      }
    };
    fetchAdminProfile();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      addToast('Logout realizado com sucesso.', 'success');
      navigate('/');
    } catch (error: any) {
      addToast('Erro ao sair da conta.', 'error');
    }
  };

  const fetchTenants = async () => {
    try {
      setLoading(true);
      let query = supabase.from('view_tenants_management').select('*');

      if (search.trim()) {
        const cleanSearch = search.trim();
        query = query.or(
          `tenant_name.ilike.%${cleanSearch}%,tenant_email.ilike.%${cleanSearch}%,tenant_phone.ilike.%${cleanSearch}%`
        );
      }

      const { data, error } = await query.order('tenant_name', { ascending: true });
      if (error) throw error;
      setTenants(data as TenantManagementItem[]);
    } catch (error: any) {
      console.error('Error fetching tenants:', error);
      addToast('Erro ao listar barbearias parceiras.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchTenants();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Barbearia bloqueada que o Proprietário liberou à mão: até que dia (o fim de um dia no fuso dela). Passada a data, não aparece.
  const liberadaAte = (t: TenantManagementItem): string | null => {
    if (!t.subscription_unblocked_until) return null;
    const fim = new Date(t.subscription_unblocked_until);
    return fim.getTime() > Date.now() ? `Liberada até ${dataCurta(fim, t.tenant_timezone ?? undefined)}` : null;
  };

  const formatCurrency = (val: number | null) => {
    if (val === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  return (
    <>
      <div className="noise-overlay" />

      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
        <CabecalhoDoAdmin nomeDoAdmin={adminName} aoSair={handleLogout} />

        {/* CONTAINER */}
        <main className="flex-1 max-w-[1200px] w-full mx-auto p-8 flex flex-col gap-8 max-md:p-4">
          <section>
            <h2>Barbearias parceiras</h2>
            <p>Gerencie as assinaturas, limites e conexões de WhatsApp de cada barbearia.</p>
          </section>

          <AvisosQueFalharam />

          {/* SEARCH BAR */}
          <section className="w-full mb-3">
            <div className="relative flex items-center [&_svg]:absolute [&_svg]:left-4 [&_svg]:text-text-secondary [&_svg]:pointer-events-none">
              <SearchIcon size={18} />
              <input
                type="text"
                className="w-full pl-12 pr-5 py-4 rounded-xl border border-border bg-bg-secondary text-text-primary text-sm outline-none transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-[0_1px_2px_rgba(45,35,30,0.04)] placeholder:text-text-secondary focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.15)]"
                placeholder="Pesquisar por nome, e-mail ou WhatsApp..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </section>

          {/* LIST / TABLE */}
          <section className="bg-bg-secondary border border-border rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-16 flex flex-col items-center gap-4 text-text-secondary">
                <div className="spinner border-brand-primary border-t-transparent" />
                <span>Carregando barbearias...</span>
              </div>
            ) : tenants.length === 0 ? (
              <div className="py-16 px-8 flex flex-col items-center gap-3 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-bg-primary text-text-secondary mb-1">
                  <InfoIcon size={24} />
                </div>
                <p className="text-base font-semibold text-text-primary m-0">Nenhuma barbearia encontrada</p>
                <p className="text-sm text-text-secondary m-0 max-w-[30ch]">Tente ajustar sua busca ou cadastre uma nova barbearia.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 border-b border-border bg-[rgba(217,108,0,0.03)] text-xs font-semibold text-text-secondary tracking-[0.03em]">Barbearia</th>
                      <th className="px-6 py-4 border-b border-border bg-[rgba(217,108,0,0.03)] text-xs font-semibold text-text-secondary tracking-[0.03em]">Contato</th>
                      <th className="px-6 py-4 border-b border-border bg-[rgba(217,108,0,0.03)] text-xs font-semibold text-text-secondary tracking-[0.03em]">Plano</th>
                      <th className="px-6 py-4 border-b border-border bg-[rgba(217,108,0,0.03)] text-xs font-semibold text-text-secondary tracking-[0.03em]">WhatsApp</th>
                      <th className="px-6 py-4 border-b border-border bg-[rgba(217,108,0,0.03)] text-xs font-semibold text-text-secondary tracking-[0.03em]">Status</th>
                      <th className="px-6 py-4 border-b border-border bg-[rgba(217,108,0,0.03)] text-xs font-semibold text-text-secondary tracking-[0.03em]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t, idx) => (
                      <tr
                        key={t.tenant_id}
                        className="transition-colors duration-200 ease-in animate-[slideUp_0.35s_cubic-bezier(0.32,0.72,0,1)_both] hover:bg-[rgba(217,108,0,0.02)] [&_td]:border-b [&_td]:border-border last:[&_td]:border-b-0"
                        style={{ animationDelay: `${idx * 0.04}s` }}
                      >
                        {/* Barbearia */}
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-base font-semibold text-text-primary">{t.tenant_name}</span>
                            <span className="text-xs text-text-secondary">Cadastrado em: {formatDate(t.tenant_created_at)}</span>
                          </div>
                        </td>

                        {/* Proprietário */}
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm text-text-primary">{t.tenant_email}</span>
                            <span className="text-xs text-text-secondary">{t.tenant_phone}</span>
                          </div>
                        </td>

                        {/* Plano */}
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-brand-primary">{t.plan_name || 'Nenhum'}</span>
                            <span className="text-xs text-text-secondary">{formatCurrency(t.plan_price)}</span>
                          </div>
                        </td>

                        {/* WhatsApp Status */}
                        <td className="px-6 py-5">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE_CLASSES[t.whatsapp_status || 'disconnected']}`}>
                            {ROTULO_DO_WHATSAPP[t.whatsapp_status || 'disconnected']}
                          </span>
                        </td>

                        {/* Subscription Status */}
                        <td className="px-6 py-5">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE_CLASSES[t.subscription_status || 'canceled']}`}>
                              {rotuloDaSituacao(t.subscription_status)}
                            </span>
                            {liberadaAte(t) && <span className="text-xs text-text-secondary">{liberadaAte(t)}</span>}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-5">
                          <button
                            onClick={() => setTenantAberto(t.tenant_id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-transparent text-text-primary cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-brand-primary hover:text-brand-primary active:scale-95"
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* VISÃO DE DETALHE: a assinatura da barbearia e as ações do Proprietário (cada uma com confirmação) */}
      <DetalhesDoTenant tenantId={tenantAberto} aoFechar={() => setTenantAberto(null)} aoMudar={fetchTenants} />

    </>
  );
};
