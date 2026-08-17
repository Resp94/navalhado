import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
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

const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <path d="M7 7h.01" />
  </svg>
);

const ReceiptIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
    <path d="M8 7h8" />
    <path d="M8 11h8" />
    <path d="M8 15h6" />
  </svg>
);

export const Clientes: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const {
    filteredCustomers,
    stats,
    loading,
    loadingDetails,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    selectedTagFilter,
    setSelectedTagFilter,
    allAvailableTags,
    history,
    comandasHistory,
    calculateLTVMetrics,
    saveCustomer,
    deleteCustomer,
    loadHistorico,
  } = useClientes(tenant.tenantId);

  // Estados dos Modais e Gaveta de UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birth_date: '',
    acquisition_channel: '',
    cpf: '',
    notes: '',
    tags: [] as string[],
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Cliente | null>(null);
  const [activeTab360, setActiveTab360] = useState<'dados' | 'historico' | 'metricas'>('dados');
  const [newTagInput, setNewTagInput] = useState('');

  useGSAP(() => {
    if (!loading) {
      gsap.fromTo(
        '.stat-card',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
      gsap.fromTo(
        '.customer-row',
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, delay: 0.2, ease: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    }
  }, [loading, filterStatus, searchTerm, selectedTagFilter]);

  const handleOpenModal = (customer: Cliente | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name === 'Cliente' ? '' : customer.name,
        phone: customer.phone,
        email: customer.email || '',
        birth_date: customer.birth_date || '',
        acquisition_channel: customer.acquisition_channel || '',
        cpf: customer.cpf || '',
        notes: customer.notes || '',
        tags: customer.tags || [],
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        birth_date: '',
        acquisition_channel: '',
        cpf: '',
        notes: '',
        tags: [],
      });
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
      birth_date: formData.birth_date || null,
      acquisition_channel: formData.acquisition_channel || null,
      cpf: formData.cpf || null,
      notes: formData.notes,
      tags: formData.tags,
    });

    if (success) {
      setIsModalOpen(false);
      if (selectedCustomer && selectedCustomer.id === editingCustomer?.id) {
        setSelectedCustomer({
          ...selectedCustomer,
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          birth_date: formData.birth_date || null,
          acquisition_channel: formData.acquisition_channel || null,
          cpf: formData.cpf || null,
          notes: formData.notes || null,
          tags: formData.tags,
        });
      }
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
    setActiveTab360('dados');
    setIsDrawerOpen(true);
    loadHistorico(customer.id);
  };

  const handleCopyLink = (token: string) => {
    const link = `${window.location.origin}/cliente/${token}`;
    navigator.clipboard.writeText(link);
    addToast('Link de agendamento copiado!', 'success');
  };

  const handleAddTagToCustomer = async (tagText: string) => {
    const clean = tagText.trim().replace(/^#/, '');
    if (!clean || !selectedCustomer) return;
    if (selectedCustomer.tags.includes(clean)) {
      setNewTagInput('');
      return;
    }
    const updatedTags = [...selectedCustomer.tags, clean];
    const success = await saveCustomer({
      id: selectedCustomer.id,
      name: selectedCustomer.name,
      phone: selectedCustomer.phone,
      tags: updatedTags,
    });
    if (success) {
      setSelectedCustomer({ ...selectedCustomer, tags: updatedTags });
      setNewTagInput('');
    }
  };

  const handleRemoveTagFromCustomer = async (tagToRemove: string) => {
    if (!selectedCustomer) return;
    const updatedTags = selectedCustomer.tags.filter((t) => t !== tagToRemove);
    const success = await saveCustomer({
      id: selectedCustomer.id,
      name: selectedCustomer.name,
      phone: selectedCustomer.phone,
      tags: updatedTags,
    });
    if (success) {
      setSelectedCustomer({ ...selectedCustomer, tags: updatedTags });
    }
  };

  const ltvMetrics = selectedCustomer
    ? calculateLTVMetrics(selectedCustomer.id)
    : { totalSpend: 0, averageTicket: 0, totalVisits: 0, averageDaysBetweenVisits: 0, lastVisitDate: null };

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
          <span className="stat-card__helper">Nome e sobrenome confirmados</span>
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
          <span className="search-icon">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Buscar por nome, telefone, CPF ou tag..."
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

      {/* 2.1 BARRA DE FILTRO POR TAGS */}
      {allAvailableTags.length > 0 && (
        <div className="tags-filter-bar">
          <span className="tags-filter-label">
            <TagIcon /> Tags:
          </span>
          <button
            onClick={() => setSelectedTagFilter(null)}
            className={`tag-chip-btn ${selectedTagFilter === null ? 'tag-chip-btn--active' : ''}`}
          >
            Todas
          </button>
          {allAvailableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
              className={`tag-chip-btn ${selectedTagFilter === tag ? 'tag-chip-btn--active' : ''}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

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
                <th>Nome e Perfil</th>
                <th>Telefone</th>
                <th>Tags</th>
                <th>Status</th>
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
                    <div className="customer-tags-inline">
                      {customer.tags && customer.tags.length > 0 ? (
                        customer.tags.slice(0, 2).map((t) => (
                          <span key={t} className="badge-tag">
                            #{t}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                      {customer.tags && customer.tags.length > 2 && (
                        <span className="badge-tag-more">+{customer.tags.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {customer.cadastro_completo ? (
                      <span className="badge badge--success">Cadastrado</span>
                    ) : (
                      <span className="badge badge--warning">WhatsApp</span>
                    )}
                  </td>
                  <td>{new Date(customer.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div className="actions-cell">
                      <button
                        onClick={() => handleOpenDrawer(customer)}
                        className="btn btn--outline btn--xs"
                        aria-label="Ver Detalhes"
                      >
                        Central 360º
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

      {/* 4. MODAL DE CADASTRO/EDIÇÃO (DOUBLE-BEZEL) */}
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
                <label htmlFor="name-input">Nome e Sobrenome *</label>
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

              <div className="form-group-row">
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
                  <label htmlFor="birthdate-input">Data de Nascimento</label>
                  <input
                    id="birthdate-input"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group-row">
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
                  <label htmlFor="cpf-input">CPF (Opcional)</label>
                  <input
                    id="cpf-input"
                    type="text"
                    placeholder="Ex: 000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="channel-select">Canal de Aquisição</label>
                <select
                  id="channel-select"
                  value={formData.acquisition_channel}
                  onChange={(e) => setFormData({ ...formData, acquisition_channel: e.target.value })}
                  className="form-control"
                >
                  <option value="">Selecione como conheceu...</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Indicação">Indicação de Amigo</option>
                  <option value="Google">Google / Pesquisa</option>
                  <option value="Passagem">Passou em frente</option>
                  <option value="Tráfego Pago">Anúncio Online</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="notes-textarea">Observações de Atendimento</label>
                <textarea
                  id="notes-textarea"
                  rows={2}
                  placeholder="Preferências de corte, café preferido, restrições..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-control"
                />
              </div>

              <footer className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn--outline">
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary">
                  Salvar Cliente
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* 5. CENTRAL 360 DO CLIENTE (DRAWER LATERAL GSAP) */}
      {isDrawerOpen && selectedCustomer && (
        <>
          <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />
          <div className="drawer-container shadow-xl animate-drawer">
            {/* Header da Central 360 */}
            <header className="drawer-header">
              <div className="drawer-header__main">
                <div className="customer-avatar-badge">
                  {selectedCustomer.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'CL'}
                </div>
                <div>
                  <div className="drawer-header__eyebrow-row">
                    <span className="drawer-header__eyebrow">
                      {selectedCustomer.cadastro_completo ? 'Perfil Confirmado' : 'Cliente Provisório'}
                    </span>
                  </div>
                  <h3 className="drawer-header__title">{selectedCustomer.name}</h3>
                  <span className="drawer-header__subtitle font-mono">{selectedCustomer.phone}</span>
                </div>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="btn-close-modal">
                <CloseIcon />
              </button>
            </header>

            {/* Ações Rápidas de Topo */}
            <div className="drawer-quick-actions">
              <button
                onClick={() => {
                  handleCopyLink(selectedCustomer.token_acesso);
                }}
                className="btn btn--outline btn--xs"
                title="Copiar link exclusivo do cliente"
              >
                <CopyIcon /> Copiar Link
              </button>
              <button
                onClick={() => {
                  navigate('/agenda');
                  addToast(`Iniciando agendamento para ${selectedCustomer.name}`, 'info');
                }}
                className="btn btn--outline btn--xs"
              >
                <ReceiptIcon /> Nova Comanda
              </button>
              <button onClick={() => handleOpenModal(selectedCustomer)} className="btn btn--primary btn--xs">
                <EditIcon /> Editar
              </button>
            </div>

            {/* Abas de Navegação 360 */}
            <div className="drawer-tabs-nav">
              <button
                onClick={() => setActiveTab360('dados')}
                className={`drawer-tab-btn ${activeTab360 === 'dados' ? 'drawer-tab-btn--active' : ''}`}
              >
                Dados e Tags
              </button>
              <button
                onClick={() => setActiveTab360('historico')}
                className={`drawer-tab-btn ${activeTab360 === 'historico' ? 'drawer-tab-btn--active' : ''}`}
              >
                Linha do Tempo ({history.length + comandasHistory.length})
              </button>
              <button
                onClick={() => setActiveTab360('metricas')}
                className={`drawer-tab-btn ${activeTab360 === 'metricas' ? 'drawer-tab-btn--active' : ''}`}
              >
                Métricas e LTV
              </button>
            </div>

            {/* Corpo do Drawer com base na Aba Ativa */}
            <div className="drawer-body">
              {loadingDetails ? (
                <div className="loading-state py-4">
                  <div className="spinner mb-2" />
                  <p>Carregando perfil 360º...</p>
                </div>
              ) : activeTab360 === 'dados' ? (
                /* ABA 1: DADOS CADASTRAIS E TAGS */
                <div className="tab-content-container">
                  {/* TAGS INTERATIVAS */}
                  <div className="drawer-section card shadow-glass">
                    <h4 className="drawer-section__title">
                      <TagIcon /> Tags e Categorias do Cliente
                    </h4>
                    <div className="tags-management-container">
                      <div className="tags-chips-list">
                        {selectedCustomer.tags && selectedCustomer.tags.length > 0 ? (
                          selectedCustomer.tags.map((t) => (
                            <span key={t} className="badge-tag-interactive">
                              #{t}
                              <button
                                onClick={() => handleRemoveTagFromCustomer(t)}
                                className="tag-remove-btn"
                                title="Remover tag"
                              >
                                &times;
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-muted text-sm">Nenhuma tag atribuída a este cliente.</span>
                        )}
                      </div>
                      <div className="add-tag-inline">
                        <input
                          type="text"
                          placeholder="Adicionar nova tag (ex: VIP, Barba Longa)..."
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTagToCustomer(newTagInput);
                            }
                          }}
                          className="form-control form-control--sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddTagToCustomer(newTagInput)}
                          className="btn btn--outline btn--sm"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* INFORMAÇÕES PESSOAIS */}
                  <div className="drawer-section card shadow-glass">
                    <h4 className="drawer-section__title">Dados Cadastrais</h4>
                    <div className="drawer-info-list">
                      <div className="drawer-info-item">
                        <span className="info-label">Nome:</span>
                        <strong className="info-value">{selectedCustomer.name}</strong>
                      </div>
                      <div className="drawer-info-item">
                        <span className="info-label">Telefone:</span>
                        <span className="info-value font-mono">{selectedCustomer.phone}</span>
                      </div>
                      <div className="drawer-info-item">
                        <span className="info-label">Aniversário:</span>
                        <span className="info-value">
                          {selectedCustomer.birth_date
                            ? new Date(selectedCustomer.birth_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'long',
                              })
                            : 'Não informado'}
                        </span>
                      </div>
                      <div className="drawer-info-item">
                        <span className="info-label">Canal de Aquisição:</span>
                        <span className="info-value">{selectedCustomer.acquisition_channel || 'Não informado'}</span>
                      </div>
                      {selectedCustomer.cpf && (
                        <div className="drawer-info-item">
                          <span className="info-label">CPF:</span>
                          <span className="info-value font-mono">{selectedCustomer.cpf}</span>
                        </div>
                      )}
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
                </div>
              ) : activeTab360 === 'historico' ? (
                /* ABA 2: LINHA DO TEMPO (AGENDAMENTOS E COMANDAS) */
                <div className="tab-content-container">
                  <div className="drawer-section card shadow-glass">
                    <h4 className="drawer-section__title">Linha do Tempo de Atendimentos</h4>
                    {history.length === 0 && comandasHistory.length === 0 ? (
                      <div className="empty-state empty-state-drawer">
                        Nenhum atendimento ou comanda encontrado no histórico.
                      </div>
                    ) : (
                      <div className="timeline-unified-list">
                        {comandasHistory.map((cmd) => (
                          <div key={cmd.id} className="timeline-card timeline-card--comanda">
                            <div className="timeline-card__header">
                              <span className="timeline-type-badge">
                                <ReceiptIcon /> Comanda #{cmd.comanda_number}
                              </span>
                              <span className={`badge badge--appt-${cmd.status === 'closed' ? 'completed' : 'pending'}`}>
                                {cmd.status === 'closed' ? 'Paga' : 'Aberta'}
                              </span>
                            </div>
                            <div className="timeline-card__body">
                              <div className="timeline-items-list">
                                {cmd.items.map((it) => (
                                  <div key={it.id} className="timeline-item-row">
                                    <span>
                                      {it.quantity}x {it.name}
                                    </span>
                                    <span className="font-mono">
                                      R$ {(it.quantity * it.unit_price).toFixed(2).replace('.', ',')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="timeline-footer-row">
                                <span className="text-muted text-xs">
                                  {new Date(cmd.closed_at || cmd.created_at).toLocaleString('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })}
                                </span>
                                <strong className="text-brand">
                                  Total: R$ {cmd.total_final.toFixed(2).replace('.', ',')}
                                </strong>
                              </div>
                            </div>
                          </div>
                        ))}

                        {history.map((app) => (
                          <div key={app.id} className="timeline-card">
                            <div className="timeline-card__header">
                              <strong className="appointment-service">{app.service_name}</strong>
                              <span className={`badge badge--appt-${app.status}`}>
                                {app.status === 'completed' && 'Concluído'}
                                {app.status === 'confirmed' && 'Confirmado'}
                                {app.status === 'pending' && 'Pendente'}
                                {app.status === 'canceled' && 'Cancelado'}
                              </span>
                            </div>
                            <div className="timeline-card__body">
                              <div className="appt-meta-row">
                                <span className="appt-meta-label">Barbeiro:</span>
                                <span>{app.professional_name}</span>
                              </div>
                              <div className="appt-meta-row">
                                <span className="appt-meta-label">Data/Hora:</span>
                                <span>
                                  {new Date(app.start_time).toLocaleString('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              </div>
                              <div className="appt-meta-row">
                                <span className="appt-meta-label">Valor:</span>
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
              ) : (
                /* ABA 3: MÉTRICAS E LTV */
                <div className="tab-content-container">
                  <div className="ltv-bento-grid">
                    <div className="ltv-card card shadow-glass">
                      <span className="ltv-card__label">Total Investido (LTV)</span>
                      <span className="ltv-card__value text-brand font-mono">
                        R$ {ltvMetrics.totalSpend.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="ltv-card__hint">Faturamento acumulado do cliente</span>
                    </div>

                    <div className="ltv-card card shadow-glass">
                      <span className="ltv-card__label">Ticket Médio</span>
                      <span className="ltv-card__value font-mono">
                        R$ {ltvMetrics.averageTicket.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="ltv-card__hint">Gasto médio por visita</span>
                    </div>

                    <div className="ltv-card card shadow-glass">
                      <span className="ltv-card__label">Total de Visitas</span>
                      <span className="ltv-card__value">{ltvMetrics.totalVisits}</span>
                      <span className="ltv-card__hint">Atendimentos concluídos</span>
                    </div>

                    <div className="ltv-card card shadow-glass">
                      <span className="ltv-card__label">Frequência Média</span>
                      <span className="ltv-card__value">
                        {ltvMetrics.averageDaysBetweenVisits > 0
                          ? `${ltvMetrics.averageDaysBetweenVisits} dias`
                          : 'Primeira visita'}
                      </span>
                      <span className="ltv-card__hint">Intervalo médio entre retornos</span>
                    </div>
                  </div>

                  {ltvMetrics.lastVisitDate && (
                    <div className="last-visit-banner card shadow-glass mt-3">
                      <span className="text-sm text-secondary">
                        Última visita registrada em:{' '}
                        <strong>
                          {new Date(ltvMetrics.lastVisitDate).toLocaleDateString('pt-BR', {
                            dateStyle: 'long',
                          })}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ESTILOS LOCAIS DA CENTRAL 360 */}
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

        .tags-filter-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          padding: 0.5rem 0.25rem;
        }

        .tags-filter-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          display: flex;
          align-items: center;
          gap: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .tag-chip-btn {
          background: rgba(45, 35, 30, 0.05);
          border: 1px solid var(--color-border);
          padding: 0.25rem 0.65rem;
          border-radius: 9999px;
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tag-chip-btn:hover {
          border-color: var(--color-brand-primary);
          color: var(--color-brand-primary);
        }

        .tag-chip-btn--active {
          background: var(--color-brand-primary);
          border-color: var(--color-brand-primary);
          color: #ffffff;
        }

        .customer-tags-inline {
          display: flex;
          gap: 0.35rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .badge-tag {
          font-size: 11px;
          font-weight: 700;
          background: rgba(217, 108, 0, 0.1);
          color: var(--color-brand-primary);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .badge-tag-more {
          font-size: 10px;
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          z-index: 1000;
        }

        .drawer-container {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-width: 520px;
          background: var(--color-bg-primary);
          border-left: 1px solid var(--color-border);
          z-index: 1001;
          display: flex;
          flex-direction: column;
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.15);
        }

        .drawer-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          background: var(--color-bg-secondary);
        }

        .drawer-header__main {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .customer-avatar-badge {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--color-brand-primary) 0%, #b85d00 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 1.25rem;
          display: grid;
          place-items: center;
          box-shadow: 0 4px 12px rgba(217, 108, 0, 0.25);
        }

        .drawer-header__eyebrow {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 800;
          color: var(--color-brand-primary);
        }

        .drawer-header__title {
          font-size: 1.25rem;
          font-weight: 800;
          margin: 0.15rem 0;
          color: var(--color-text-primary);
        }

        .drawer-header__subtitle {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
        }

        .drawer-quick-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: rgba(255, 255, 255, 0.4);
          border-bottom: 1px solid var(--color-border);
        }

        .drawer-tabs-nav {
          display: flex;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
        }

        .drawer-tab-btn {
          flex: 1;
          padding: 0.85rem 0.5rem;
          border: none;
          background: transparent;
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .drawer-tab-btn:hover {
          color: var(--color-text-primary);
        }

        .drawer-tab-btn--active {
          color: var(--color-brand-primary);
          border-bottom-color: var(--color-brand-primary);
          background: rgba(217, 108, 0, 0.03);
        }

        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .tab-content-container {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .tags-management-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .tags-chips-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .badge-tag-interactive {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(217, 108, 0, 0.12);
          color: var(--color-brand-primary);
          font-weight: 700;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 6px;
        }

        .tag-remove-btn {
          background: none;
          border: none;
          color: var(--color-brand-primary);
          font-weight: 800;
          cursor: pointer;
          padding: 0;
          font-size: 14px;
          line-height: 1;
        }

        .add-tag-inline {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }

        .ltv-bento-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .ltv-card {
          padding: 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .ltv-card__label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .ltv-card__value {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .ltv-card__hint {
          font-size: 11px;
          color: var(--color-text-secondary);
        }

        .timeline-unified-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .timeline-card {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.85rem 1rem;
          background: rgba(255, 255, 255, 0.6);
        }

        .timeline-card--comanda {
          border-left: 3px solid var(--color-brand-primary);
        }

        .timeline-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .timeline-type-badge {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-brand-primary);
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .timeline-items-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: var(--font-size-xs);
        }

        .timeline-item-row {
          display: flex;
          justify-content: space-between;
          color: var(--color-text-primary);
        }

        .timeline-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px dashed var(--color-border);
        }

        .form-group-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
      `}</style>
    </div>
  );
};
