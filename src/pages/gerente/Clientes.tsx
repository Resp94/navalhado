import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { useToast } from '../../components/Toast';
import { useClientes } from '../../modules/clientes/useClientes';
import type { Cliente } from '../../modules/clientes/types';
import { DEFAULT_LTV_METRICS } from '../../modules/clientes/types';
import { formatWhatsAppUrl } from '../../modules/clientes/utils';
import { interpolateTemplate, WHATSAPP_TEMPLATES, sendManualWhatsAppMessage } from '../../lib/whatsapp';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import './Clientes.css';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  UserAdd01Icon,
  Edit01Icon,
  Delete02Icon,
  Cancel01Icon,
  Copy01Icon,
  Tag01Icon,
  Invoice01Icon,
  WhatsappIcon,
  Calendar01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';

// Ícones Oficiais Hugeicons
const SearchIcon = () => <HugeiconsIcon icon={Search01Icon} size={18} />;
const UserPlusIcon = () => <HugeiconsIcon icon={UserAdd01Icon} size={18} />;
const EditIcon = () => <HugeiconsIcon icon={Edit01Icon} size={16} />;
const TrashIcon = () => <HugeiconsIcon icon={Delete02Icon} size={16} />;
const CloseIcon = () => <HugeiconsIcon icon={Cancel01Icon} size={20} />;
const CopyIcon = () => <HugeiconsIcon icon={Copy01Icon} size={16} />;
const TagIcon = () => <HugeiconsIcon icon={Tag01Icon} size={14} />;
const ReceiptIcon = () => <HugeiconsIcon icon={Invoice01Icon} size={14} />;

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
  const [isSaving, setIsSaving] = useState(false);
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

  // Modal de Exclusão
  const [customerToDelete, setCustomerToDelete] = useState<Cliente | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Central 360 do Cliente (Drawer)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Cliente | null>(null);
  const [activeTab360, setActiveTab360] = useState<'dados' | 'historico' | 'metricas'>('dados');
  const [newTagInput, setNewTagInput] = useState('');

  // Modal de Disparo Direto de WhatsApp (Uazapi)
  const [isDirectWhatsAppModalOpen, setIsDirectWhatsAppModalOpen] = useState(false);
  const [whatsAppTemplate, setWhatsAppTemplate] = useState<'retorno' | 'agradecimento' | 'livre'>('retorno');
  const [whatsAppCustomMessage, setWhatsAppCustomMessage] = useState('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Acessibilidade: Fechar modal e drawer ao pressionar Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDirectWhatsAppModalOpen) {
          setIsDirectWhatsAppModalOpen(false);
        } else if (customerToDelete) {
          setCustomerToDelete(null);
        } else if (isModalOpen) {
          setIsModalOpen(false);
        } else if (isDrawerOpen) {
          setIsDrawerOpen(false);
        }
      }
    },
    [isDirectWhatsAppModalOpen, customerToDelete, isModalOpen, isDrawerOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Animação GSAP otimizada: disparada apenas na carga inicial e troca de status/tag
  useGSAP(() => {
    if (!loading) {
      gsap.fromTo(
        '.stat-card',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
      );
      gsap.fromTo(
        '.customer-row',
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.02, delay: 0.1, ease: 'power2.out' }
      );
    }
  }, [loading, filterStatus, selectedTagFilter]);

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
    setIsSaving(true);
    try {
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      const success = await deleteCustomer(customerToDelete.id);
      if (success) {
        addToast('Cliente removido com sucesso.', 'success');
        setCustomerToDelete(null);
        if (selectedCustomer?.id === customerToDelete.id) {
          setIsDrawerOpen(false);
          setSelectedCustomer(null);
        }
      }
    } catch (err: any) {
      console.error('Erro ao excluir cliente:', err);
      addToast(err?.message || 'Erro ao excluir cliente.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenDirectWhatsApp = (customer: Cliente) => {
    setSelectedCustomer(customer);
    const bookingLink = tenant.slug
      ? `${window.location.origin}/${tenant.slug}`
      : `${window.location.origin}/cliente/${customer.token_acesso}`;
    const barbeariaName = tenant.tenantName || 'Barbearia';
    const initialText = interpolateTemplate(WHATSAPP_TEMPLATES.retorno, {
      customer_name: customer.name,
      tenant_name: barbeariaName,
      booking_link: bookingLink,
    });

    setWhatsAppTemplate('retorno');
    setWhatsAppCustomMessage(initialText);
    setIsDirectWhatsAppModalOpen(true);
  };

  const handleSelectTemplate = (template: 'retorno' | 'agradecimento' | 'livre') => {
    setWhatsAppTemplate(template);
    if (!selectedCustomer) return;
    const bookingLink = tenant.slug
      ? `${window.location.origin}/${tenant.slug}`
      : `${window.location.origin}/cliente/${selectedCustomer.token_acesso}`;
    const barbeariaName = tenant.tenantName || 'Barbearia';

    if (template === 'retorno') {
      setWhatsAppCustomMessage(
        interpolateTemplate(WHATSAPP_TEMPLATES.retorno, {
          customer_name: selectedCustomer.name,
          tenant_name: barbeariaName,
          booking_link: bookingLink,
        })
      );
    } else if (template === 'agradecimento') {
      setWhatsAppCustomMessage(
        interpolateTemplate(WHATSAPP_TEMPLATES.agradecimento, {
          customer_name: selectedCustomer.name,
          tenant_name: barbeariaName,
          booking_link: bookingLink,
        })
      );
    } else {
      setWhatsAppCustomMessage('');
    }
  };

  const handleSendDirectWhatsApp = async () => {
    if (!selectedCustomer || !selectedCustomer.phone) {
      addToast('O cliente selecionado não possui telefone cadastrado.', 'warning');
      return;
    }
    if (!whatsAppCustomMessage.trim()) {
      addToast('A mensagem não pode estar vazia.', 'warning');
      return;
    }

    try {
      setIsSendingWhatsApp(true);
      await sendManualWhatsAppMessage(
        tenant.tenantId,
        selectedCustomer.phone,
        whatsAppCustomMessage.trim()
      );

      addToast(`Mensagem disparada com sucesso para ${selectedCustomer.name} via WhatsApp da barbearia!`, 'success');
      setIsDirectWhatsAppModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao enviar mensagem direta pelo WhatsApp:', err);
      addToast(err?.message || 'Erro ao disparar mensagem. Verifique se a instância do WhatsApp está conectada.', 'error');
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleOpenDrawer = (customer: Cliente) => {
    setSelectedCustomer(customer);
    setActiveTab360('dados');
    setIsDrawerOpen(true);
    loadHistorico(customer.id);
  };

  const handleCopyLink = (token: string) => {
    const link = tenant.slug
      ? `${window.location.origin}/${tenant.slug}`
      : `${window.location.origin}/cliente/${token}`;
    navigator.clipboard.writeText(link);
    addToast('Link de agendamento copiado com sucesso!', 'success');
  };

  const handleUpdateCustomerTags = async (updatedTags: string[]) => {
    if (!selectedCustomer) return;
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

  const handleAddTagToCustomer = async (tagText: string) => {
    const clean = tagText.trim().replace(/^#/, '');
    if (!clean || !selectedCustomer) return;
    if (selectedCustomer.tags.includes(clean)) {
      setNewTagInput('');
      return;
    }
    const updatedTags = [...selectedCustomer.tags, clean];
    await handleUpdateCustomerTags(updatedTags);
    setNewTagInput('');
  };

  const handleRemoveTagFromCustomer = async (tagToRemove: string) => {
    if (!selectedCustomer) return;
    const updatedTags = selectedCustomer.tags.filter((t) => t !== tagToRemove);
    await handleUpdateCustomerTags(updatedTags);
  };

  const ltvMetrics = selectedCustomer
    ? calculateLTVMetrics(selectedCustomer.id)
    : DEFAULT_LTV_METRICS;

  return (
    <div className="clientes-page">
      {/* 1. ESTATÍSTICAS DA BASE */}
      <section className="stat-cards-grid" aria-label="Resumo da carteira de clientes">
        <div className="stat-card">
          <span className="stat-card__eyebrow">Total da base</span>
          <span className="stat-card__number">{stats.totalCount}</span>
          <span className="stat-card__helper">Clientes na carteira</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__eyebrow">Cadastros completos</span>
          <span className="stat-card__number stat-card__number--success">{stats.completosCount}</span>
          <span className="stat-card__helper">Nome e dados confirmados</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__eyebrow">Clientes provisórios</span>
          <span className="stat-card__number stat-card__number--warning">{stats.provisoriosCount}</span>
          <span className="stat-card__helper">Cadastros rápidos de balcão</span>
        </div>
      </section>

      {/* 2. CONTROLES E BUSCA */}
      <div className="clients-controls-bar" role="search" aria-label="Controles e busca de clientes">
        <div className="search-input-wrapper">
          <span className="search-icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Buscar por nome, telefone, CPF ou tag..."
            aria-label="Pesquisar na base de clientes"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
          />
        </div>

        <div className="filter-group-container" role="group" aria-label="Filtrar por status de cadastro">
          <button
            type="button"
            onClick={() => setFilterStatus('todos')}
            className={`btn-filter ${filterStatus === 'todos' ? 'btn-filter--active' : ''}`}
            aria-pressed={filterStatus === 'todos'}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('completos')}
            className={`btn-filter ${filterStatus === 'completos' ? 'btn-filter--active' : ''}`}
            aria-pressed={filterStatus === 'completos'}
          >
            Completos
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('provisorios')}
            className={`btn-filter ${filterStatus === 'provisorios' ? 'btn-filter--active' : ''}`}
            aria-pressed={filterStatus === 'provisorios'}
          >
            Provisórios
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal(null)}
          className="btn btn--primary btn-add-client"
          aria-label="Adicionar novo cliente"
        >
          <UserPlusIcon /> Adicionar cliente
        </button>
      </div>

      {/* 2.1 BARRA DE FILTRO POR TAGS */}
      {allAvailableTags.length > 0 && (
        <div className="tags-filter-bar" role="group" aria-label="Filtro de tags">
          <span className="tags-filter-label">
            <TagIcon /> Tags:
          </span>
          <button
            type="button"
            onClick={() => setSelectedTagFilter(null)}
            className={`tag-chip-btn ${selectedTagFilter === null ? 'tag-chip-btn--active' : ''}`}
            aria-pressed={selectedTagFilter === null}
          >
            Todas
          </button>
          {allAvailableTags.map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
              className={`tag-chip-btn ${selectedTagFilter === tag ? 'tag-chip-btn--active' : ''}`}
              aria-pressed={selectedTagFilter === tag}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* 3. TABELA DE CLIENTES */}
      <div className="table-container shadow-glass">
        {loading ? (
          <div className="loading-state" role="status">
            <div className="spinner mb-2" />
            <p>Carregando clientes...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty-state" role="status">
            <p>Nenhum cliente encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <table className="customers-table" aria-label="Lista de clientes">
              <thead>
                <tr>
                  <th scope="col">Nome e perfil</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">Tags</th>
                  <th scope="col">Status</th>
                  <th scope="col">Cadastrado em</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Ações
                  </th>
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
                          <span className="text-muted text-xs">Sem tags</span>
                        )}
                        {customer.tags && customer.tags.length > 2 && (
                          <span className="badge-tag-more">+{customer.tags.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {customer.cadastro_completo ? (
                        <span className="badge badge--success">Completo</span>
                      ) : (
                        <span className="badge badge--warning">Provisório</span>
                      )}
                    </td>
                    <td>{new Date(customer.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div className="actions-cell">
                        <button
                          type="button"
                          onClick={() => handleOpenDirectWhatsApp(customer)}
                          className="btn-icon-only btn-icon-only--whatsapp"
                          title={`WhatsApp para ${customer.name}`}
                          aria-label={`WhatsApp para ${customer.name}`}
                        >
                          <HugeiconsIcon icon={WhatsappIcon} size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDrawer(customer)}
                          className="btn btn--outline btn--xs"
                          aria-label={`Ver detalhes de ${customer.name}`}
                        >
                          Central 360º
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenModal(customer)}
                          className="btn-icon-only"
                          title={`Editar ${customer.name}`}
                          aria-label={`Editar ${customer.name}`}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerToDelete(customer)}
                          className="btn-icon-only btn-icon-only--danger"
                          title={`Excluir ${customer.name}`}
                          aria-label={`Excluir ${customer.name}`}
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

      {/* 4. MODAL DE CADASTRO/EDIÇÃO (SEM HEADER-ICON, ESTRUTURA LUXURY) */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => !isSaving && setIsModalOpen(false)}>
          <div
            className="modal-content shadow-xl animate-spring"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <div className="modal-title-group">
                <span className="modal-eyebrow">
                  {editingCustomer ? 'Perfil do cliente' : 'Novo cadastro'}
                </span>
                <h3 id="modal-title" className="modal-title">
                  {editingCustomer ? 'Editar dados do cliente' : 'Cadastrar novo cliente'}
                </h3>
                <span className="modal-subtitle">
                  {editingCustomer
                    ? `Atualize as informações e preferências de atendimento de ${editingCustomer.name}`
                    : 'Preencha os dados cadastrais para adicionar à carteira da barbearia.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-close-modal"
                aria-label="Fechar janela"
              >
                <CloseIcon />
              </button>
            </header>

            <form onSubmit={handleSaveSubmit} className="modal-body">
              {/* Card 1: Dados principais */}
              <div className="modal-form-card">
                <span className="modal-card-title">
                  <HugeiconsIcon icon={UserAdd01Icon} size={14} /> Dados principais
                </span>
                <div className="form-group">
                  <label htmlFor="name-input">Nome e sobrenome *</label>
                  <input
                    id="name-input"
                    type="text"
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
                    <label htmlFor="birthdate-input">Data de nascimento</label>
                    <input
                      id="birthdate-input"
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Documentação e origem */}
              <div className="modal-form-card">
                <span className="modal-card-title">
                  <HugeiconsIcon icon={Invoice01Icon} size={14} /> Documentação e origem
                </span>
                <div className="form-group-row">
                  <div className="form-group">
                    <label htmlFor="email-input">E-mail (opcional)</label>
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
                    <label htmlFor="cpf-input">CPF (opcional)</label>
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
                  <label htmlFor="channel-select">Como conheceu a barbearia?</label>
                  <select
                    id="channel-select"
                    value={formData.acquisition_channel}
                    onChange={(e) => setFormData({ ...formData, acquisition_channel: e.target.value })}
                    className="form-control"
                  >
                    <option value="">Selecione uma opção...</option>
                    <option value="Instagram">Instagram ou redes sociais</option>
                    <option value="Indicação">Indicação de amigo</option>
                    <option value="Google">Google ou pesquisa no Maps</option>
                    <option value="Passagem">Passou em frente</option>
                    <option value="Tráfego Pago">Anúncio online</option>
                    <option value="Outro">Outro canal</option>
                  </select>
                </div>
              </div>

              {/* Card 3: Preferências e atendimento */}
              <div className="modal-form-card">
                <span className="modal-card-title">
                  <HugeiconsIcon icon={Tag01Icon} size={14} /> Preferências e atendimento
                </span>
                <div className="form-group">
                  <label htmlFor="notes-textarea">Observações do barbeiro</label>
                  <textarea
                    id="notes-textarea"
                    rows={2}
                    placeholder="Preferências de corte, formato da barba, café favorito ou restrições..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <footer className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn--outline"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="btn btn--primary">
                  {isSaving ? 'Salvando...' : editingCustomer ? 'Salvar alterações' : 'Salvar cliente'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (POLISHED & ACESSÍVEL) */}
      {customerToDelete && (
        <div className="modal-backdrop" onClick={() => !isDeleting && setCustomerToDelete(null)}>
          <div
            className="modal-content modal-delete-content shadow-xl animate-spring"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-delete-body">
              <div className="delete-modal-header-group">
                <span className="modal-eyebrow text-danger">Confirmação de exclusão</span>
                <h3 id="delete-dialog-title" className="delete-modal-title">
                  Excluir cadastro do cliente?
                </h3>
                <p id="delete-dialog-desc" className="delete-modal-description">
                  Esta ação é permanente e vai remover o cliente da sua carteira ativa.
                </p>
              </div>

              <div className="delete-customer-card">
                <div className="customer-name-wrapper">
                  <strong className="customer-name">{customerToDelete.name}</strong>
                  <span className="customer-email font-mono">{customerToDelete.phone}</span>
                </div>
                {customerToDelete.cadastro_completo ? (
                  <span className="badge badge--success">Completo</span>
                ) : (
                  <span className="badge badge--warning">Provisório</span>
                )}
              </div>

              <div className="delete-warning-box">
                <HugeiconsIcon icon={AlertCircleIcon} size={18} />
                <span>
                  <strong>Aviso de segurança:</strong> clientes com agendamentos ou comandas registradas não podem ser excluídos para manter a integridade do histórico financeiro.
                </span>
              </div>
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCustomerToDelete(null)}
                className="btn btn--outline"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="btn btn--danger"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, excluir cliente'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* 6. CENTRAL 360 DO CLIENTE (DRAWER LATERAL COM ARIA & COPY REFINADA) */}
      {isDrawerOpen && selectedCustomer && (
        <>
          <div
            className="drawer-backdrop"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            className="drawer-container shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            {/* Header da Central 360 */}
            <header className="drawer-header">
              <div className="drawer-header__main">
                <div className="drawer-header__text-group">
                  <div className="drawer-header__eyebrow-row">
                    <span className="drawer-header__eyebrow">
                      {selectedCustomer.cadastro_completo ? 'Perfil confirmado' : 'Primeiro contato (WhatsApp)'}
                    </span>
                  </div>
                  <h3 id="drawer-title" className="drawer-header__title">
                    {selectedCustomer.name}
                  </h3>
                  <span className="drawer-header__subtitle font-mono">{selectedCustomer.phone}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="btn-close-modal"
                aria-label="Fechar Central 360"
              >
                <CloseIcon />
              </button>
            </header>

            {/* Ações Rápidas de Topo (Copiar Link, WhatsApp e Novo Agendamento) */}
            <div className="drawer-quick-actions" role="toolbar" aria-label="Ações rápidas do cliente">
              <button
                type="button"
                onClick={() => {
                  handleCopyLink(selectedCustomer.token_acesso);
                }}
                className="btn btn-drawer-action"
                title="Copiar link de autoagendamento do cliente"
                aria-label="Copiar link de agendamento"
              >
                <CopyIcon /> Copiar link
              </button>
              {selectedCustomer.phone && (
                <button
                  type="button"
                  onClick={() => handleOpenDirectWhatsApp(selectedCustomer)}
                  className="btn btn-drawer-action btn-drawer-action--whatsapp"
                  title="Disparar mensagem pelo WhatsApp da barbearia"
                  aria-label="Conversar no WhatsApp"
                >
                  <HugeiconsIcon icon={WhatsappIcon} size={15} /> WhatsApp
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  navigate('/agenda', {
                    state: {
                      openNewAppointment: true,
                      customerId: selectedCustomer.id,
                      customerName: selectedCustomer.name,
                    },
                  });
                  addToast(`Iniciando agendamento para ${selectedCustomer.name}`, 'info');
                }}
                className="btn btn--primary btn-drawer-action--primary"
                title="Agendar novo horário na grade"
                aria-label="Novo agendamento"
              >
                <HugeiconsIcon icon={Calendar01Icon} size={15} /> Novo agendamento
              </button>
            </div>

            {/* Abas de Navegação 360 */}
            <div className="drawer-tabs-nav" aria-label="Seções da Central 360">
              <button
                type="button"
                aria-selected={activeTab360 === 'dados'}
                aria-controls="panel-dados"
                id="tab-dados"
                onClick={() => setActiveTab360('dados')}
                className={`drawer-tab-btn ${activeTab360 === 'dados' ? 'drawer-tab-btn--active' : ''}`}
              >
                Dados e tags
              </button>
              <button
                type="button"
                aria-selected={activeTab360 === 'historico'}
                aria-controls="panel-historico"
                id="tab-historico"
                onClick={() => setActiveTab360('historico')}
                className={`drawer-tab-btn ${activeTab360 === 'historico' ? 'drawer-tab-btn--active' : ''}`}
              >
                Linha do tempo ({history.length + comandasHistory.length})
              </button>
              <button
                type="button"
                aria-selected={activeTab360 === 'metricas'}
                aria-controls="panel-metricas"
                id="tab-metricas"
                onClick={() => setActiveTab360('metricas')}
                className={`drawer-tab-btn ${activeTab360 === 'metricas' ? 'drawer-tab-btn--active' : ''}`}
              >
                Métricas e LTV
              </button>
            </div>

            {/* Corpo do Drawer com base na Aba Ativa */}
            <div className="drawer-body">
              {loadingDetails ? (
                <div className="loading-state py-4" role="status">
                  <div className="spinner mb-2" />
                  <p>Carregando perfil 360º...</p>
                </div>
              ) : activeTab360 === 'dados' ? (
                /* ABA 1: DADOS CADASTRAIS E TAGS */
                <div
                  id="panel-dados"
                  role="tabpanel"
                  aria-labelledby="tab-dados"
                  className="tab-content-container"
                >
                  {/* TAGS INTERATIVAS */}
                  <div className="drawer-section card shadow-glass">
                    <h4 className="drawer-section__title">
                      <TagIcon /> Tags e categorias do cliente
                    </h4>
                    <div className="tags-management-container">
                      <div className="tags-chips-list" role="list" aria-label="Tags do cliente">
                        {selectedCustomer.tags && selectedCustomer.tags.length > 0 ? (
                          selectedCustomer.tags.map((t) => (
                            <span key={t} className="badge-tag-interactive" role="listitem">
                              #{t}
                              <button
                                type="button"
                                onClick={() => handleRemoveTagFromCustomer(t)}
                                className="tag-remove-btn"
                                title={`Remover tag ${t}`}
                                aria-label={`Remover tag ${t}`}
                              >
                                &times;
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-muted text-sm">Nenhuma tag atribuída a este cliente ainda.</span>
                        )}
                      </div>
                      <div className="add-tag-inline">
                        <input
                          type="text"
                          placeholder="Adicionar tag (ex: VIP, barba longa)..."
                          aria-label="Nova tag"
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
                          aria-label="Adicionar tag ao cliente"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* INFORMAÇÕES PESSOAIS */}
                  <div className="drawer-section card shadow-glass">
                    <h4 className="drawer-section__title">Dados cadastrais</h4>
                    <div className="drawer-info-list">
                      <div className="drawer-info-item">
                        <span className="info-label">Nome completo:</span>
                        <strong className="info-value">{selectedCustomer.name}</strong>
                      </div>
                      <div className="drawer-info-item">
                        <span className="info-label">Telefone WhatsApp:</span>
                        <span className="info-value font-mono">{selectedCustomer.phone}</span>
                      </div>
                      <div className="drawer-info-item">
                        <span className="info-label">Data de aniversário:</span>
                        <span className="info-value">
                          {selectedCustomer.birth_date
                            ? new Date(selectedCustomer.birth_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'long',
                              })
                            : 'Não informada'}
                        </span>
                      </div>
                      <div className="drawer-info-item">
                        <span className="info-label">Canal de origem:</span>
                        <span className="info-value">{selectedCustomer.acquisition_channel || 'Não informado'}</span>
                      </div>
                      {selectedCustomer.cpf && (
                        <div className="drawer-info-item">
                          <span className="info-label">CPF do cliente:</span>
                          <span className="info-value font-mono">{selectedCustomer.cpf}</span>
                        </div>
                      )}
                      {selectedCustomer.email && (
                        <div className="drawer-info-item">
                          <span className="info-label">E-mail de contato:</span>
                          <span className="info-value">{selectedCustomer.email}</span>
                        </div>
                      )}
                      {selectedCustomer.notes && (
                        <div className="drawer-info-item drawer-info-item--full">
                          <span className="info-label">Observações do atendimento:</span>
                          <p className="info-value text-italic">{selectedCustomer.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : activeTab360 === 'historico' ? (
                /* ABA 2: LINHA DO TEMPO (AGENDAMENTOS E COMANDAS) */
                <div
                  id="panel-historico"
                  role="tabpanel"
                  aria-labelledby="tab-historico"
                  className="tab-content-container"
                >
                  <div className="drawer-section card shadow-glass">
                    <h4 className="drawer-section__title">Linha do tempo de atendimentos</h4>
                    {history.length === 0 && comandasHistory.length === 0 ? (
                      <div className="empty-state empty-state-drawer" role="status">
                        Nenhum atendimento ou comanda registrado até o momento.
                      </div>
                    ) : (
                      <div className="timeline-unified-list">
                        {comandasHistory.map((cmd) => (
                          <div key={cmd.id} className="timeline-card">
                            <div className="timeline-card__header">
                              <span className="timeline-type-badge">
                                <ReceiptIcon /> Comanda #{cmd.comanda_number}
                              </span>
                              <span className={`badge badge--appt-${cmd.status === 'closed' ? 'completed' : 'pending'}`}>
                                {cmd.status === 'closed' ? 'Paga' : 'Em aberto'}
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
                                <span className="appt-meta-label">Profissional:</span>
                                <span>{app.professional_name}</span>
                              </div>
                              <div className="appt-meta-row">
                                <span className="appt-meta-label">Data e horário:</span>
                                <span>
                                  {new Date(app.start_time).toLocaleString('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              </div>
                              <div className="appt-meta-row">
                                <span className="appt-meta-label">Valor cobrado:</span>
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
                <div
                  id="panel-metricas"
                  role="tabpanel"
                  aria-labelledby="tab-metricas"
                  className="tab-content-container"
                >
                  <div className="ltv-bento-grid">
                    <div className="ltv-card card shadow-glass">
                      <span className="ltv-card__label">Total investido (LTV)</span>
                      <span className="ltv-card__value text-brand font-mono">
                        R$ {ltvMetrics.totalSpend.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="ltv-card__hint">Faturamento total gerado por este cliente</span>
                    </div>

                    <div className="ltv-card card shadow-glass">
                      <span className="ltv-card__label">Ticket médio</span>
                      <span className="ltv-card__value font-mono">
                        R$ {ltvMetrics.averageTicket.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="ltv-card__hint">Média gasta em cada atendimento</span>
                    </div>

                    <div className="ltv-card card shadow-glass">
                      <span className="ltv-card__label">Total de visitas</span>
                      <span className="ltv-card__value">{ltvMetrics.totalVisits}</span>
                      <span className="ltv-card__hint">Atendimentos concluídos na barbearia</span>
                    </div>

                    <div className="ltv-card card shadow-glass">
                      <span className="ltv-card__label">Frequência média</span>
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
                        Último atendimento registrado em:{' '}
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

      {/* 5. MODAL DE DISPARO DIRETO DE WHATSAPP (UAZAPI) */}
      {isDirectWhatsAppModalOpen && selectedCustomer && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!isSendingWhatsApp) setIsDirectWhatsAppModalOpen(false);
          }}
        >
          <div
            className="modal-content modal-whatsapp-direct"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-modal-title"
          >
            <header className="modal-header">
              <div className="modal-header__title-group">
                <span className="modal-eyebrow">Mensageria Uazapi</span>
                <h3 id="whatsapp-modal-title" className="modal-title">
                  Enviar WhatsApp para {selectedCustomer.name}
                </h3>
              </div>
              <button
                type="button"
                className="btn-icon-only"
                onClick={() => setIsDirectWhatsAppModalOpen(false)}
                disabled={isSendingWhatsApp}
                aria-label="Fechar modal de WhatsApp"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="modal-body">
              <div className="whatsapp-recipient-card">
                <span className="recipient-label">Destinatário:</span>
                <strong className="recipient-phone font-mono">{selectedCustomer.phone}</strong>
              </div>

              <div className="template-selector-group">
                <label className="form-label">Escolha um modelo rápido:</label>
                <div className="template-chips" role="radiogroup" aria-label="Modelos de mensagem">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={whatsAppTemplate === 'retorno'}
                    className={`btn-template-chip ${whatsAppTemplate === 'retorno' ? 'btn-template-chip--active' : ''}`}
                    onClick={() => handleSelectTemplate('retorno')}
                  >
                    ⚡ Lembrete de retorno
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={whatsAppTemplate === 'agradecimento'}
                    className={`btn-template-chip ${whatsAppTemplate === 'agradecimento' ? 'btn-template-chip--active' : ''}`}
                    onClick={() => handleSelectTemplate('agradecimento')}
                  >
                    🤝 Agradecimento
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={whatsAppTemplate === 'livre'}
                    className={`btn-template-chip ${whatsAppTemplate === 'livre' ? 'btn-template-chip--active' : ''}`}
                    onClick={() => handleSelectTemplate('livre')}
                  >
                    ✍️ Mensagem livre
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="whatsapp-message-textarea" className="form-label">
                  Mensagem que será enviada pelo WhatsApp conectado da barbearia:
                </label>
                <textarea
                  id="whatsapp-message-textarea"
                  rows={4}
                  value={whatsAppCustomMessage}
                  onChange={(e) => setWhatsAppCustomMessage(e.target.value)}
                  placeholder="Digite a mensagem para o cliente..."
                  className="form-control"
                  disabled={isSendingWhatsApp}
                />
              </div>

              <div className="whatsapp-modal-fallback-row">
                <span className="text-muted text-xs">Ou se preferir abrir manualmente no navegador:</span>
                <a
                  href={formatWhatsAppUrl(selectedCustomer.phone, whatsAppCustomMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-whatsapp-web"
                >
                  Abrir no WhatsApp Web ↗
                </a>
              </div>
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                onClick={() => setIsDirectWhatsAppModalOpen(false)}
                className="btn btn--outline"
                disabled={isSendingWhatsApp}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendDirectWhatsApp}
                className="btn btn--primary btn-whatsapp-send"
                disabled={isSendingWhatsApp || !whatsAppCustomMessage.trim()}
              >
                {isSendingWhatsApp ? (
                  <>
                    <span className="spinner spinner--sm" /> Disparando...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={WhatsappIcon} size={16} /> Disparar pelo WhatsApp
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
