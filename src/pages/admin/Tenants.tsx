import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { 
  WarningIcon, 
  InfoIcon,
  SuccessIcon,
  ErrorIcon,
  SearchIcon
} from '../../components/Icons';

interface TenantManagementItem {
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string;
  tenant_logo_url: string | null;
  tenant_created_at: string;
  plan_name: string | null;
  plan_price: number | null;
  subscription_status: 'active' | 'suspended' | 'past_due' | 'canceled' | null;
  subscription_end_date: string | null;
  whatsapp_status: 'connected' | 'disconnected' | 'pairing' | null;
}

export const Tenants: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantManagementItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<TenantManagementItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<'active' | 'suspended' | 'canceled'>('active');
  const [actionLoading, setActionLoading] = useState(false);
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

  const handleOpenStatusModal = (tenant: TenantManagementItem, status: 'active' | 'suspended' | 'canceled') => {
    setSelectedTenant(tenant);
    setNewStatus(status);
    setIsModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedTenant) return;
    try {
      setActionLoading(true);
      
      // Atualizar o status da assinatura correspondente na tabela tenant_subscriptions
      const { error } = await supabase
        .from('tenant_subscriptions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('tenant_id', selectedTenant.tenant_id);

      if (error) throw error;

      addToast(`Status da barbearia "${selectedTenant.tenant_name}" atualizado para ${newStatus === 'active' ? 'Ativo' : newStatus === 'suspended' ? 'Suspenso' : 'Cancelado'}.`, 'success');
      setIsModalOpen(false);
      setSelectedTenant(null);
      fetchTenants(); // Recarregar lista
    } catch (error: any) {
      console.error('Error updating tenant subscription status:', error);
      addToast('Não foi possível alterar o status da assinatura.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('pt-BR');
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

      <div className="admin-layout">
        {/* HEADER */}
        <header className="admin-header">
          <div className="admin-header__brand" onClick={() => navigate('/admin/dashboard')} style={{ cursor: 'pointer' }}>
            <div className="admin-header__logo">
              <img src="/simbolo.svg" alt="Navalhado" style={{ width: '34px', height: '34px', display: 'block' }} />
            </div>
            <div>
              <h1 className="admin-header__title">Navalhado</h1>
            </div>
          </div>

          {/* Navegação Central Coesa */}
          <nav className="admin-header__nav">
            <button 
              onClick={() => navigate('/admin/dashboard')} 
              className={`admin-header__nav-link ${location.pathname === '/admin/dashboard' ? 'admin-header__nav-link--active' : ''}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => navigate('/admin/tenants')} 
              className={`admin-header__nav-link ${location.pathname === '/admin/tenants' ? 'admin-header__nav-link--active' : ''}`}
            >
              Barbearias
            </button>
          </nav>

          <div className="admin-header__user">
            <div className="admin-header__user-info">
              <span className="admin-header__user-name">{adminName}</span>
              <span className="admin-header__user-role">Proprietário</span>
            </div>
            <button onClick={handleLogout} className="btn btn--outline-danger btn--sm">
              Sair
            </button>
          </div>
        </header>

        {/* CONTAINER */}
        <main className="admin-container">
          <section className="welcome-banner">
            <h2>Barbearias parceiras</h2>
            <p>Gerencie as assinaturas, limites e conexões de WhatsApp de cada barbearia.</p>
          </section>

          {/* SEARCH BAR */}
          <section className="search-section">
            <div className="search-wrapper">
              <SearchIcon size={18} />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Pesquisar por nome, e-mail ou WhatsApp..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </section>

          {/* LIST / TABLE */}
          <section className="table-card">
            {loading ? (
              <div className="table-loading">
                <div className="spinner" style={{ borderColor: 'var(--color-brand-primary)', borderTopColor: 'transparent' }} />
                <span>Carregando barbearias...</span>
              </div>
            ) : tenants.length === 0 ? (
              <div className="table-empty">
                <div className="table-empty__icon">
                  <InfoIcon size={24} />
                </div>
                <p className="table-empty__title">Nenhuma barbearia encontrada</p>
                <p className="table-empty__desc">Tente ajustar sua busca ou cadastre uma nova barbearia.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="tenants-table">
                  <thead>
                    <tr>
                      <th>Barbearia</th>
                      <th>Contato</th>
                      <th>Plano</th>
                      <th>WhatsApp</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t, idx) => (
                      <tr key={t.tenant_id} style={{ animationDelay: `${idx * 0.04}s` }}>
                        {/* Barbearia */}
                        <td>
                          <div className="tenant-cell-name">
                            <span className="tenant-name-main">{t.tenant_name}</span>
                            <span className="tenant-date-sub">Cadastrado em: {formatDate(t.tenant_created_at)}</span>
                          </div>
                        </td>

                        {/* Proprietário */}
                        <td>
                          <div className="tenant-cell-contact">
                            <span className="tenant-email">{t.tenant_email}</span>
                            <span className="tenant-phone">{t.tenant_phone}</span>
                          </div>
                        </td>

                        {/* Plano */}
                        <td>
                          <div className="tenant-cell-plan">
                            <span className="plan-name-tag">{t.plan_name || 'Nenhum'}</span>
                            <span className="plan-price-label">{formatCurrency(t.plan_price)}</span>
                          </div>
                        </td>

                        {/* WhatsApp Status */}
                        <td>
                          <span className={`status-badge status-badge--${t.whatsapp_status || 'disconnected'}`}>
                            {t.whatsapp_status === 'connected' ? 'Conectado' : t.whatsapp_status === 'pairing' ? 'Pareando' : 'Desconectado'}
                          </span>
                        </td>

                        {/* Subscription Status */}
                        <td>
                          <span className={`status-badge status-badge--${t.subscription_status || 'canceled'}`}>
                            {t.subscription_status === 'active' ? 'Ativa' : t.subscription_status === 'suspended' ? 'Suspensa' : t.subscription_status === 'past_due' ? 'Vencida' : 'Cancelada'}
                          </span>
                        </td>

                        {/* Ações */}
                        <td>
                          <div className="actions-cell">
                            {t.subscription_status !== 'active' && (
                              <button 
                                onClick={() => handleOpenStatusModal(t, 'active')} 
                                className="btn btn--xs btn-action btn-action--success"
                              >
                                Ativar
                              </button>
                            )}
                            {t.subscription_status === 'active' && (
                              <button 
                                onClick={() => handleOpenStatusModal(t, 'suspended')} 
                                className="btn btn--xs btn-action btn-action--warning"
                              >
                                Suspender
                              </button>
                            )}
                            {t.subscription_status !== 'canceled' && (
                              <button 
                                onClick={() => handleOpenStatusModal(t, 'canceled')} 
                                className="btn btn--xs btn-action btn-action--danger"
                              >
                                Bloquear
                              </button>
                            )}
                          </div>
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

      {/* CONFIRMATION MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTenant(null);
        }}
        title="Alterar assinatura"
      >
        {selectedTenant && (
          <div className="status-modal-content">
            <div className="status-modal-icon">
              <WarningIcon size={24} />
            </div>

            <p className="status-modal-desc">
              Deseja alterar o status de <strong>{selectedTenant.tenant_name}</strong> para 
              <span className={`status-badge status-badge--inline status-badge--${newStatus}`}>
                {newStatus === 'active' ? 'Ativo' : newStatus === 'suspended' ? 'Suspenso' : 'Cancelado'}
              </span>?
            </p>

            <div className="modal-alert-box">
              {newStatus === 'suspended' && (
                <p><WarningIcon size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} /><strong>Atenção:</strong> Os barbeiros perderão o acesso às agendas e os clientes não conseguirão agendar novos horários.</p>
              )}
              {newStatus === 'canceled' && (
                <p><ErrorIcon size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} /><strong>Importante:</strong> O acesso do gerente e dos funcionários será bloqueado permanentemente, e os agendamentos públicos serão desativados.</p>
              )}
              {newStatus === 'active' && (
                <p><SuccessIcon size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />A barbearia voltará a funcionar normalmente, com login e agendamentos liberados.</p>
              )}
            </div>

            <div className="status-modal-buttons">
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedTenant(null);
                }} 
                className="btn btn--outline" 
                disabled={actionLoading}
              >
                Cancelar
              </button>
              
              <button 
                onClick={handleUpdateStatus} 
                className={`btn btn--primary`}
                style={{ backgroundColor: newStatus === 'active' ? 'var(--color-success)' : 'var(--color-error)' }}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processando…' : 'Confirmar alteração'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        .admin-layout {
          min-height: 100vh;
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          display: flex;
          flex-direction: column;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          /* Liquid glass — gradient-tinted to match app theme */
          background: 
            radial-gradient(ellipse 40% 60% at 15% 50%, rgba(217, 108, 0, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse 40% 60% at 85% 50%, rgba(217, 108, 0, 0.03) 0%, transparent 55%),
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.78) 0%,
              rgba(255, 241, 230, 0.5) 45%,
              rgba(255, 255, 255, 0.72) 100%
            );
          backdrop-filter: blur(28px) saturate(200%);
          -webkit-backdrop-filter: blur(28px) saturate(200%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            inset 0 -1px 0 rgba(255, 255, 255, 0.15),
            0 8px 40px -8px rgba(45, 35, 30, 0.1),
            0 1px 4px rgba(45, 35, 30, 0.04);
          position: sticky;
          top: 0;
          z-index: 100;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .admin-header__brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .admin-header__brand:hover {
          transform: scale(1.02);
        }

        .admin-header__nav {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: 
            radial-gradient(ellipse 50% 100% at 30% 50%, rgba(217, 108, 0, 0.04) 0%, transparent 70%),
            rgba(255, 255, 255, 0.45);
          padding: 0.25rem;
          border-radius: var(--radius-lg);
          border: 1px solid rgba(255, 255, 255, 0.35);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(12px) saturate(160%);
          -webkit-backdrop-filter: blur(12px) saturate(160%);
        }

        .admin-header__nav-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: transparent;
          border: 1px solid transparent;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          font-weight: 500;
          cursor: pointer;
          padding: 0.45rem 1rem;
          border-radius: var(--radius-md);
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .admin-header__nav-link:hover {
          color: var(--color-brand-primary);
          background-color: rgba(255, 255, 255, 0.5);
          border-color: rgba(234, 222, 214, 0.6);
        }

        .admin-header__nav-link--active {
          color: var(--color-brand-primary);
          background-color: var(--color-bg-secondary);
          border-color: rgba(234, 222, 214, 0.8);
          font-weight: 600;
          box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }

        .admin-header__nav-link:active {
          transform: scale(0.97);
        }

        .admin-header__logo {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .admin-header__title {
          font-size: var(--font-size-lg);
          font-weight: 700;
          margin: 0;
          line-height: 1.1;
        }

        .admin-header__user {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .admin-header__user-info {
          display: flex;
          flex-direction: column;
          text-align: right;
        }

        .admin-header__user-name {
          font-size: var(--font-size-sm);
          font-weight: 600;
        }

        .admin-header__user-role {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .admin-container {
          flex: 1;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .search-section {
          width: 100%;
          margin-bottom: 0.75rem;
        }

        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-wrapper svg {
          position: absolute;
          left: 1rem;
          color: var(--color-text-secondary);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 1rem 1.25rem 1rem 3rem;
          border-radius: var(--radius-xl);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          outline: none;
          transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
          box-shadow: 0 1px 2px rgba(45, 35, 30, 0.04);
        }

        .search-input:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }

        .search-input::placeholder {
          color: var(--color-text-secondary);
        }

        .table-card {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }

        .table-loading {
          padding: 4rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: var(--color-text-secondary);
        }

        .table-empty {
          padding: 4rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          text-align: center;
        }

        .table-empty__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: var(--radius-full);
          background-color: var(--color-bg-primary);
          color: var(--color-text-secondary);
          margin-bottom: 0.25rem;
        }

        .table-empty__title {
          font-size: var(--font-size-base);
          font-weight: 600;
          color: var(--color-text-primary);
          margin: 0;
        }

        .table-empty__desc {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin: 0;
          max-width: 30ch;
        }

        .table-responsive {
          overflow-x: auto;
          width: 100%;
        }

        .tenants-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .tenants-table th,
        .tenants-table td {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
        }

        .tenants-table thead th {
          background-color: rgba(217, 108, 0, 0.03);
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-text-secondary);
          letter-spacing: 0.03em;
          padding-top: 1rem;
          padding-bottom: 1rem;
        }

        .tenants-table tbody tr {
          transition: background-color 0.2s ease;
          animation: slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1) both;
        }

        .tenants-table tbody tr:hover {
          background-color: rgba(217, 108, 0, 0.02);
        }

        .tenants-table tbody tr:last-child td {
          border-bottom: none;
        }

        /* Cells */
        .tenant-cell-name {
          display: flex;
          flex-direction: column;
        }

        .tenant-name-main {
          font-size: var(--font-size-base);
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .tenant-date-sub {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .tenant-cell-contact {
          display: flex;
          flex-direction: column;
        }

        .tenant-email {
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
        }

        .tenant-phone {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .tenant-cell-plan {
          display: flex;
          flex-direction: column;
        }

        .plan-name-tag {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-brand-primary);
        }

        .plan-price-label {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        /* Badges */
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: 600;
          text-transform: capitalize;
        }

        .status-badge--connected,
        .status-badge--active {
          background-color: var(--color-success-bg);
          color: var(--color-success);
        }

        .status-badge--pairing,
        .status-badge--suspended {
          background-color: var(--color-warning-bg);
          color: var(--color-warning);
        }

        .status-badge--disconnected,
        .status-badge--past_due,
        .status-badge--canceled {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }

        .status-badge--inline {
          margin: 0 0.35rem;
        }

        /* Actions */
        .actions-cell {
          display: flex;
          gap: 0.375rem;
        }

        .btn--xs {
          padding: 0.3rem 0.65rem;
          font-size: 0.7rem;
          font-weight: 600;
          border-radius: var(--radius-md);
          border: none;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
          color: #fff;
        }

        .btn--xs:active {
          transform: scale(0.95);
        }

        .btn-action--success {
          background-color: var(--color-success);
        }

        .btn-action--success:hover {
          background-color: #0c8c5f;
        }

        .btn-action--warning {
          background-color: var(--color-warning);
        }

        .btn-action--warning:hover {
          background-color: #b86405;
        }

        .btn-action--danger {
          background-color: var(--color-error);
        }

        .btn-action--danger:hover {
          background-color: #d83f3f;
        }

        .btn--outline {
          border: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-text-primary);
        }

        .btn--outline:hover {
          background-color: var(--color-bg-primary);
        }

        .btn--outline-danger {
          border: 1px solid var(--color-error);
          background: transparent;
          color: var(--color-error);
          transition: all 0.2s ease;
        }

        .btn--outline-danger:hover {
          background-color: var(--color-error-bg);
        }

        .btn--sm {
          padding: 0.5rem 1rem;
          font-size: var(--font-size-xs);
        }

        /* Modal content */
        .status-modal-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
          text-align: center;
        }

        .status-modal-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3.5rem;
          height: 3.5rem;
          border-radius: var(--radius-full);
          background-color: var(--color-warning-bg);
          color: var(--color-warning);
        }

        .status-modal-desc {
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
          line-height: 1.5;
          margin: 0;
        }

        .modal-alert-box {
          background-color: var(--color-bg-primary);
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-md);
          padding: 1rem;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          text-align: left;
          line-height: 1.6;
          width: 100%;
        }

        .status-modal-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          width: 100%;
          margin-top: 0.5rem;
        }
      `}</style>
    </>
  );
};
