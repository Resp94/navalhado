import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { useToast } from '../../components/Toast';
import { useClientes } from '../../modules/clientes/useClientes';
import type { Cliente } from '../../modules/clientes/types';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

// Ícones Inline SVG
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const UserPlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" x2="19" y1="8" y2="14" />
    <line x1="22" x2="16" y1="11" y2="11" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const WhatsappIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.46h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export const Clientes: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const {
    filteredCustomers,
    stats,
    loading,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    history,
    saveCustomer,
    deleteCustomer,
    loadHistorico,
  } = useClientes(tenant.tenantId);

  // Estados dos Modais e Gaveta de UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '' });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Cliente | null>(null);

  useGSAP(() => {
    if (!loading) {
      gsap.fromTo('.stat-card', 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
      gsap.fromTo('.customer-row', 
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, delay: 0.2, ease: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    }
  }, [loading, filterStatus, searchTerm]);

  const handleOpenModal = (customer: Cliente | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name === 'Cliente' ? '' : customer.name,
        phone: customer.phone,
        email: customer.email || '',
        notes: customer.notes || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', notes: '' });
    }
    setIsModalOpen(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await saveCustomer({
      id: editingCustomer?.id,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      notes: formData.notes,
    });

    if (success) {
      setIsModalOpen(false);
    }
  };

  const handleDeleteSubmit = async (customerId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente definitivamente?')) {
      return;
    }
    const success = await deleteCustomer(customerId);
    if (success && selectedCustomer?.id === customerId) {
      setIsDrawerOpen(false);
    }
  };

  const handleOpenDrawer = (customer: Cliente) => {
    setSelectedCustomer(customer);
    setIsDrawerOpen(true);
    loadHistorico(customer.id);
  };

  const handleCopyLink = (token: string) => {
    const link = `${window.location.origin}/cliente/${token}`;
    navigator.clipboard.writeText(link);
    addToast('Link de agendamento copiado!', 'success');
  };

  const handleSendWhatsApp = (phone: string, token: string, name: string) => {
    const link = `${window.location.origin}/cliente/${token}`;
    const cleanName = name === 'Cliente' ? 'amigo' : name;
    const msg = `Olá, ${cleanName}! Aqui está o seu link exclusivo para agendamento na ${tenant.tenantName}: ${link}`;
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="clientes-page">
      {/* 1. ESTATÍSTICAS DA BASE */}
      <section className="stat-cards-grid">
        <div className="stat-card">
          <span className="stat-card__eyebrow">Total da Base</span>
          <span className="stat-card__number">{stats.totalCount}</span>
          <span className="stat-card__helper">Clientes na carteira</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__eyebrow">Cadastros Completos</span>
          <span className="stat-card__number stat-card__number--success">{stats.completosCount}</span>
          <span className="stat-card__helper">Dados de nome confirmados</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__eyebrow">WhatsApp (Provisórios)</span>
          <span className="stat-card__number stat-card__number--warning">{stats.provisoriosCount}</span>
          <span className="stat-card__helper">Apenas primeiro contato</span>
        </div>
      </section>

      {/* 2. CONTROLES E BUSCA */}
      <div className="clients-controls-bar">
        <div className="search-input-wrapper">
          <span className="search-icon"><SearchIcon /></span>
          <input 
            type="text" 
            placeholder="Buscar por nome ou telefone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
          />
        </div>

        <div className="filter-group-container">
          <button 
            onClick={() => setFilterStatus('todos')} 
            className={`btn-filter ${filterStatus === 'todos' ? 'btn-filter--active' : ''}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilterStatus('completos')} 
            className={`btn-filter ${filterStatus === 'completos' ? 'btn-filter--active' : ''}`}
          >
            Completos
          </button>
          <button 
            onClick={() => setFilterStatus('provisorios')} 
            className={`btn-filter ${filterStatus === 'provisorios' ? 'btn-filter--active' : ''}`}
          >
            WhatsApp
          </button>
        </div>

        <button onClick={() => handleOpenModal(null)} className="btn btn--primary btn-add-client">
          <UserPlusIcon /> Adicionar Cliente
        </button>
      </div>

      {/* 3. TABELA DE CLIENTES */}
      <div className="table-container shadow-glass">
        {loading ? (
          <div className="loading-state">
            <div className="spinner mb-2" />
            <p>Carregando clientes...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum cliente encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <table className="customers-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Status Cadastro</th>
                <th>Cadastrado Em</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="customer-row">
                  <td>
                    <div className="customer-name-wrapper">
                      <strong className="customer-name">{customer.name}</strong>
                      {customer.email && <span className="customer-email">{customer.email}</span>}
                    </div>
                  </td>
                  <td className="font-mono">{customer.phone}</td>
                  <td>
                    {customer.cadastro_completo ? (
                      <span className="badge badge--success">Cadastrado</span>
                    ) : (
                      <span className="badge badge--warning">WhatsApp (Provisório)</span>
                    )}
                  </td>
                  <td>
                    {new Date(customer.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button 
                        onClick={() => handleOpenDrawer(customer)} 
                        className="btn btn--outline btn--xs"
                        aria-label="Ver Detalhes"
                      >
                        Ver Detalhes
                      </button>
                      <button 
                        onClick={() => handleOpenModal(customer)} 
                        className="btn btn-icon-only"
                        title="Editar"
                        aria-label="Editar"
                      >
                        <EditIcon />
                      </button>
                      <button 
                        onClick={() => handleDeleteSubmit(customer.id)} 
                        className="btn btn-icon-only btn-icon-only--danger"
                        title="Excluir"
                        aria-label="Excluir"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. MODAL DE CADASTRO/EDIÇÃO */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content shadow-xl animate-spring">
            <header className="modal-header">
              <h3 className="modal-title">
                {editingCustomer ? 'Editar Dados do Cliente' : 'Novo Cadastro de Cliente'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="btn-close-modal">
                <CloseIcon />
              </button>
            </header>

            <form onSubmit={handleSaveSubmit} className="modal-body">
              <div className="form-group">
                <label htmlFor="name-input">Nome *</label>
                <input 
                  id="name-input"
                  type="text" 
                  aria-label="Nome"
                  required
                  placeholder="Ex: João da Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone-input">Telefone (WhatsApp) *</label>
                <input 
                  id="phone-input"
                  type="text" 
                  required
                  placeholder="Ex: 11999998888"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email-input">E-mail (Opcional)</label>
                <input 
                  id="email-input"
                  type="email" 
                  placeholder="Ex: joao@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes-textarea">Observações Internas</label>
                <textarea 
                  id="notes-textarea"
                  rows={3}
                  placeholder="Preferências de corte, observações de atendimento..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-control"
                />
              </div>

              <footer className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="btn btn--outline"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn--primary"
                >
                  Salvar Cliente
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* 5. GAVETA LATERAL DE DETALHES DO CLIENTE */}
      {isDrawerOpen && selectedCustomer && (
        <>
          <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer-container shadow-xl">
            <header className="drawer-header">
              <div>
                <span className="drawer-header__eyebrow">
                  {selectedCustomer.cadastro_completo ? 'Cadastro Completo' : 'Cliente Provisório'}
                </span>
                <h3 className="drawer-header__title">Detalhes do Cliente</h3>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="btn-close-modal">
                <CloseIcon />
              </button>
            </header>

            <div className="drawer-body">
              <div className="drawer-section card shadow-glass">
                <h4 className="drawer-section__title">Dados Pessoais</h4>
                <div className="drawer-info-list">
                  <div className="drawer-info-item">
                    <span className="info-label">Nome:</span>
                    <strong className="info-value">{selectedCustomer.name}</strong>
                  </div>
                  <div className="drawer-info-item">
                    <span className="info-label">Telefone:</span>
                    <span className="info-value font-mono">{selectedCustomer.phone}</span>
                  </div>
                  {selectedCustomer.email && (
                    <div className="drawer-info-item">
                      <span className="info-label">E-mail:</span>
                      <span className="info-value">{selectedCustomer.email}</span>
                    </div>
                  )}
                  {selectedCustomer.notes && (
                    <div className="drawer-info-item drawer-info-item--full">
                      <span className="info-label">Observações:</span>
                      <p className="info-value text-italic">{selectedCustomer.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* LINK E WHATSAPP */}
              <div className="drawer-section card shadow-glass highlight-section">
                <h4 className="drawer-section__title">Link de Agendamento Exclusivo</h4>
                <p className="highlight-section__text">
                  Este link identifica o cliente e a barbearia automaticamente sem a necessidade de login.
                </p>
                <div className="link-copy-container">
                  <input 
                    type="text" 
                    readOnly 
                    value={`${window.location.origin}/cliente/${selectedCustomer.token_acesso}`}
                    className="form-control link-readonly-input font-mono"
                  />
                  <button 
                    onClick={() => handleCopyLink(selectedCustomer.token_acesso)}
                    className="btn btn--outline btn-copy-icon"
                    title="Copiar Link"
                  >
                    <CopyIcon />
                  </button>
                </div>

                <button 
                  onClick={() => handleSendWhatsApp(selectedCustomer.phone, selectedCustomer.token_acesso, selectedCustomer.name)}
                  className="btn-whatsapp-direct"
                >
                  <WhatsappIcon /> Enviar Link pelo WhatsApp
                </button>
              </div>

              {/* HISTÓRICO DE VISITAS */}
              <div className="drawer-section card shadow-glass">
                <h4 className="drawer-section__title">Histórico de Visitas</h4>
                {history.length === 0 ? (
                  <div className="empty-state empty-state-drawer">
                    Nenhum agendamento encontrado no histórico deste cliente.
                  </div>
                ) : (
                  <div className="appointments-timeline">
                    {history.map((app) => (
                      <div key={app.id} className="appointment-card">
                        <div className="appointment-card__header">
                          <strong className="appointment-service">
                            {app.service_name}
                          </strong>
                          <span className={`badge badge--appt-${app.status}`}>
                            {app.status === 'completed' && 'Concluído'}
                            {app.status === 'confirmed' && 'Confirmado'}
                            {app.status === 'pending' && 'Pendente'}
                            {app.status === 'canceled' && 'Cancelado'}
                          </span>
                        </div>
                        <div className="appointment-card__body">
                          <div>
                            <span className="appt-meta-label">Barbeiro:</span>{' '}
                            <span>{app.professional_name}</span>
                          </div>
                          <div>
                            <span className="appt-meta-label">Data/Hora:</span>{' '}
                            <span>{new Date(app.start_time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                          <div>
                            <span className="appt-meta-label">Valor:</span>{' '}
                            <strong className="text-brand">
                              {`R$ ${app.service_price.toFixed(2).replace('.', ',')}`}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ESTILOS LOCAIS REFINADOS */}
      <style>{`
        .clientes-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .stat-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          box-shadow: var(--shadow-sm);
        }

        .stat-card__eyebrow {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .stat-card__number {
          font-size: var(--font-size-3xl);
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .stat-card__number--success {
          color: var(--color-success);
        }

        .stat-card__number--warning {
          color: var(--color-warning);
        }

        .stat-card__helper {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .clients-controls-bar {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .search-input-wrapper {
          position: relative;
          flex: 1;
          min-width: 250px;
        }

        .search-icon {
          position: absolute;
          left: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
        }

        .search-input-wrapper .form-control {
          padding-left: 2.5rem;
          height: 42px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
          width: 100%;
          outline: none;
          font-size: var(--font-size-sm);
        }

        .search-input-wrapper .form-control:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.1);
        }

        .filter-group-container {
          display: flex;
          background: rgba(45, 35, 30, 0.04);
          padding: 0.25rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
        }

        .btn-filter {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          padding: 0.45rem 1rem;
          cursor: pointer;
          border-radius: calc(var(--radius-md) - 2px);
          transition: all 0.2s ease;
        }

        .btn-filter--active {
          background: var(--color-bg-secondary);
          color: var(--color-brand-primary);
          box-shadow: var(--shadow-sm);
        }

        .table-container {
          overflow: hidden;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
        }

        .loading-state, .empty-state {
          padding: 3rem;
          text-align: center;
          color: var(--color-text-secondary);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .customers-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .customers-table th {
          background-color: rgba(45, 35, 30, 0.02);
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.85rem 1.25rem;
          border-bottom: 1px solid var(--color-border);
        }

        .customers-table td {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--color-border);
          vertical-align: middle;
          font-size: var(--font-size-sm);
        }

        .customer-row {
          transition: background-color 0.2s ease;
        }

        .customer-row:hover {
          background-color: rgba(217, 108, 0, 0.015);
        }

        .customer-name-wrapper {
          display: flex;
          flex-direction: column;
        }

        .customer-name {
          color: var(--color-text-primary);
          font-weight: 600;
        }

        .customer-email {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 0.2rem 0.6rem;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .badge--success {
          background-color: var(--color-success-bg);
          color: var(--color-success);
        }

        .badge--warning {
          background-color: var(--color-warning-bg);
          color: var(--color-warning);
        }

        .actions-cell {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .btn--outline {
          border: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-text-secondary);
        }

        .btn--outline:hover {
          border-color: var(--color-brand-primary);
          color: var(--color-brand-primary);
          background-color: rgba(217, 108, 0, 0.02);
        }

        .btn--xs {
          padding: 0.3rem 0.75rem;
          font-size: var(--font-size-xs);
          border-radius: var(--radius-sm);
        }

        .btn-icon-only {
          background: transparent;
          border: 1px solid transparent;
          color: var(--color-text-secondary);
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-icon-only:hover {
          background-color: rgba(45, 35, 30, 0.04);
          color: var(--color-text-primary);
        }

        .btn-icon-only--danger:hover {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }

        /* MODAL */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(20, 17, 15, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          width: 100%;
          max-width: 500px;
          overflow: hidden;
        }

        .animate-spring {
          animation: springUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
        }

        .modal-title {
          font-size: var(--font-size-base);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .btn-close-modal {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0.2rem;
          border-radius: var(--radius-sm);
        }

        .btn-close-modal:hover {
          background-color: rgba(45, 35, 30, 0.05);
          color: var(--color-text-primary);
        }

        .modal-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-group label {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .form-group .form-control {
          padding: 0.65rem 0.85rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          outline: none;
          font-size: var(--font-size-sm);
        }

        .form-group .form-control:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.1);
        }

        .form-help {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        /* GAVETA LATERAL */
        .drawer-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(20, 17, 15, 0.3);
          backdrop-filter: blur(2px);
          z-index: 900;
        }

        .drawer-container {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-width: 450px;
          background-color: var(--color-bg-primary);
          border-left: 1px solid var(--color-border);
          z-index: 950;
          display: flex;
          flex-direction: column;
          animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .drawer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          background-color: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
        }

        .drawer-header__eyebrow {
          font-size: var(--font-size-xs);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-brand-primary);
          font-weight: 700;
          display: block;
          margin-bottom: 0.15rem;
        }

        .drawer-header__title {
          font-size: var(--font-size-lg);
          font-weight: 700;
          margin: 0;
        }

        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .drawer-section {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
        }

        .drawer-section__title {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 0.4rem;
        }

        .drawer-info-list {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.5rem;
        }

        .drawer-info-item {
          display: flex;
          justify-content: space-between;
          font-size: var(--font-size-sm);
          padding: 0.25rem 0;
        }

        .drawer-info-item--full {
          flex-direction: column;
          gap: 0.25rem;
          margin-top: 0.25rem;
        }

        .info-label {
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        .info-value {
          color: var(--color-text-primary);
        }

        .text-italic {
          font-style: italic;
          color: var(--color-text-secondary);
        }

        .highlight-section {
          background-color: var(--color-brand-lightest);
          border-color: var(--color-brand-soft);
        }

        .highlight-section__text {
          font-size: var(--font-size-xs);
          color: var(--color-brand-deep);
          line-height: 1.4;
        }

        .link-copy-container {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }

        .link-readonly-input {
          font-size: var(--font-size-xs) !important;
          background-color: rgba(255, 255, 255, 0.8) !important;
          flex: 1;
        }

        .btn-copy-icon {
          font-size: var(--font-size-xs) !important;
          padding: 0.5rem 0.75rem !important;
        }

        .btn-whatsapp-direct {
          background-color: #25D366;
          color: #ffffff;
          width: 100%;
          border: none;
          font-weight: 600;
          font-size: var(--font-size-xs);
          padding: 0.65rem 1rem;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(37, 211, 102, 0.15);
          transition: all 0.3s ease;
        }

        .btn-whatsapp-direct:hover {
          background-color: #20BA5A;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(37, 211, 102, 0.25);
        }

        .empty-state-drawer {
          padding: 1.5rem;
          text-align: center;
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          border-style: dashed;
        }

        .appointments-timeline {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .appointment-card {
          padding: 1rem !important;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .appointment-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .appointment-service {
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
        }

        .badge--appt-completed {
          background-color: var(--color-success-bg);
          color: var(--color-success);
        }

        .badge--appt-confirmed {
          background-color: var(--color-info-bg);
          color: var(--color-info);
        }

        .badge--appt-pending {
          background-color: var(--color-warning-bg);
          color: var(--color-warning);
        }

        .badge--appt-canceled {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }

        .appointment-card__body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.4rem;
          font-size: var(--font-size-xs);
        }

        .appt-meta-label {
          color: var(--color-text-secondary);
        }

        .text-brand {
          color: var(--color-brand-primary);
        }

        .font-mono {
          font-family: monospace;
          letter-spacing: 0.02em;
        }
      `}</style>
    </div>
  );
};
