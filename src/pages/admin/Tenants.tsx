import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { AvisosQueFalharam } from '../../components/admin/AvisosQueFalharam';
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
  whatsapp_status: 'connected' | 'disconnected' | 'pairing' | null;
  /** Até quando uma barbearia bloqueada foi liberada à mão (o fim de um dia no fuso dela), ou nulo. */
  subscription_unblocked_until: string | null;
  tenant_timezone: string | null;
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  connected: 'bg-success-bg text-success',
  active: 'bg-success-bg text-success',
  pairing: 'bg-warning-bg text-warning',
  blocked: 'bg-warning-bg text-warning',
  trialing: 'bg-info-bg text-info',
  courtesy: 'bg-info-bg text-info',
  disconnected: 'bg-error-bg text-error',
  past_due: 'bg-error-bg text-error',
  canceled: 'bg-error-bg text-error',
};

export const Tenants: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
        {/* HEADER */}
        <header className="flex justify-between items-center px-8 py-4 bg-[radial-gradient(ellipse_40%_60%_at_15%_50%,rgba(217,108,0,0.05)_0%,transparent_60%),radial-gradient(ellipse_40%_60%_at_85%_50%,rgba(217,108,0,0.03)_0%,transparent_55%),linear-gradient(145deg,rgba(255,255,255,0.78)_0%,rgba(255,241,230,0.5)_45%,rgba(255,255,255,0.72)_100%)] backdrop-blur-[28px] backdrop-saturate-[200%] border-b border-[rgba(255,255,255,0.25)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(255,255,255,0.15),0_8px_40px_-8px_rgba(45,35,30,0.1),0_1px_4px_rgba(45,35,30,0.04)] sticky top-0 z-[100] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] max-md:px-4 max-md:py-4">
          <div
            className="flex items-center gap-3 cursor-pointer transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02]"
            onClick={() => navigate('/admin/dashboard')}
          >
            <div className="flex items-center justify-center">
              <img src="/simbolo.svg" alt="Navalhado" className="w-[34px] h-[34px] block" />
            </div>
            <div>
              <h1 className="text-lg font-bold m-0 leading-[1.1]">Navalhado</h1>
            </div>
          </div>

          {/* Navegação Central Coesa */}
          <nav className="flex items-center gap-[0.35rem] bg-[radial-gradient(ellipse_50%_100%_at_30%_50%,rgba(217,108,0,0.04)_0%,transparent_70%),rgba(255,255,255,0.45)] p-1 rounded-lg border border-[rgba(255,255,255,0.35)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[12px] backdrop-saturate-[160%]">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className={`flex items-center gap-2 bg-transparent border border-transparent text-sm font-medium cursor-pointer px-4 py-[0.45rem] rounded-md no-underline transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] ${
                location.pathname === '/admin/dashboard'
                  ? 'text-brand-primary bg-bg-secondary border-[rgba(234,222,214,0.8)] font-semibold shadow-[0_1px_2px_rgba(45,35,30,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]'
                  : 'text-text-secondary hover:text-brand-primary hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(234,222,214,0.6)]'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/admin/tenants')}
              className={`flex items-center gap-2 bg-transparent border border-transparent text-sm font-medium cursor-pointer px-4 py-[0.45rem] rounded-md no-underline transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] ${
                location.pathname === '/admin/tenants'
                  ? 'text-brand-primary bg-bg-secondary border-[rgba(234,222,214,0.8)] font-semibold shadow-[0_1px_2px_rgba(45,35,30,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]'
                  : 'text-text-secondary hover:text-brand-primary hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(234,222,214,0.6)]'
              }`}
            >
              Barbearias
            </button>
          </nav>

          <div className="flex items-center gap-6">
            <div className="flex flex-col text-right max-md:hidden">
              <span className="text-sm font-semibold">{adminName}</span>
              <span className="text-xs text-text-secondary">Proprietário</span>
            </div>
            <button
              onClick={handleLogout}
              className="btn border border-error bg-transparent text-error px-4 py-2 text-xs transition-colors duration-200 ease-in hover:bg-error-bg"
            >
              Sair
            </button>
          </div>
        </header>

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
                            {t.whatsapp_status === 'connected' ? 'Conectado' : t.whatsapp_status === 'pairing' ? 'Pareando' : 'Desconectado'}
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
