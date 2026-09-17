import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { useToast } from '../../components/Toast';
import { useClientes } from '../../modules/clientes/useClientes';
import type { Cliente } from '../../modules/clientes/types';
import { DEFAULT_LTV_METRICS } from '../../modules/clientes/types';
import { formatWhatsAppUrl } from '../../modules/clientes/utils';
import { interpolateTemplate, WHATSAPP_TEMPLATES, sendManualWhatsAppMessage } from '../../lib/whatsapp';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Button, Input, Select, Textarea, SegmentedControl } from '../../components/ui';

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

const TH_CLASS = 'py-[1.15rem] px-5 text-xs font-extrabold uppercase tracking-[0.06em] text-text-primary border-b border-border bg-bg-primary';
const TD_CLASS = 'py-[1.15rem] px-5 text-sm text-text-primary align-middle max-md:block max-md:w-full max-md:py-[0.15rem] max-md:px-0 max-md:border-none';
const TD_LAST_CLASS = `${TD_CLASS} max-md:pt-[0.625rem] max-md:border-t max-md:border-border max-md:mt-1`;

export const Clientes: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast } = useToast();

  const {
    customers,
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
  } = useClientes(tenant.tenantId, tenant.timezone);

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
        registration_origin: editingCustomer ? editingCustomer.registration_origin : 'balcao',
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

  // Abre a Central 360º direto para um cliente vindo de outra tela (spec 038,
  // ticket 09: ação "Central 360º" da página Clientes sem Retorno) via
  // `?customerId=...` na URL -- mesma gaveta usada pelo clique numa linha
  // desta tabela, sem duplicar UI. Remove o parâmetro da URL depois de abrir,
  // para um F5 na página não reabrir a gaveta sozinho.
  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (!customerId || loading) return;
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      handleOpenDrawer(customer);
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('customerId');
    setSearchParams(nextParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, customers, loading]);

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
    <div className="flex flex-col gap-6 w-full animate-[slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)]">
      {/* 1. ESTATÍSTICAS DA BASE */}
      <section className="grid [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] gap-5" aria-label="Resumo da carteira de clientes">
        <div className="stat-card bg-bg-secondary rounded-lg py-5 px-6 flex flex-col gap-[0.35rem] shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-[transform,box-shadow] duration-200 ease-in hover:-translate-y-0.5 hover:shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-md)]">
          <span className="text-xs text-text-secondary uppercase tracking-[0.08em] font-bold">Total da base</span>
          <span className="text-3xl font-extrabold text-text-primary leading-[1.2]">{stats.totalCount}</span>
          <span className="text-xs text-text-secondary">Clientes na carteira</span>
        </div>
        <div className="stat-card bg-bg-secondary rounded-lg py-5 px-6 flex flex-col gap-[0.35rem] shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-[transform,box-shadow] duration-200 ease-in hover:-translate-y-0.5 hover:shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-md)]">
          <span className="text-xs text-text-secondary uppercase tracking-[0.08em] font-bold">Cadastros completos</span>
          <span className="text-3xl font-extrabold leading-[1.2] text-success">{stats.completosCount}</span>
          <span className="text-xs text-text-secondary">Nome e dados confirmados</span>
        </div>
        <div className="stat-card bg-bg-secondary rounded-lg py-5 px-6 flex flex-col gap-[0.35rem] shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-[transform,box-shadow] duration-200 ease-in hover:-translate-y-0.5 hover:shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-md)]">
          <span className="text-xs text-text-secondary uppercase tracking-[0.08em] font-bold">Clientes provisórios</span>
          <span className="text-3xl font-extrabold leading-[1.2] text-warning">{stats.provisoriosCount}</span>
          <span className="text-xs text-text-secondary">Cadastros rápidos de balcão</span>
        </div>
      </section>

      {/* 2. CONTROLES E BUSCA */}
      <div className="flex items-center gap-4 flex-wrap max-[640px]:flex-col max-[640px]:flex-nowrap max-[640px]:items-stretch" role="search" aria-label="Controles e busca de clientes">
        <div className="relative flex-1 min-w-0 sm:min-w-[260px]">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary flex items-center pointer-events-none" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Buscar por nome, telefone, CPF ou tag..."
            aria-label="Pesquisar na base de clientes"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-11 rounded-md bg-bg-secondary text-text-primary w-full outline-none text-sm shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-shadow duration-200 ease-in focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)]"
          />
        </div>

        <SegmentedControl
          options={[
            { id: 'todos', label: 'Todos' },
            { id: 'completos', label: 'Completos' },
            { id: 'provisorios', label: 'Provisórios' },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
          size="sm"
          fullWidth={false}
          aria-label="Filtrar por status de cadastro"
          className="max-[640px]:w-full max-[640px]:flex"
        />

        <button
          type="button"
          onClick={() => handleOpenModal(null)}
          className="bg-brand-lightest text-text-primary shadow-[0_0_0_1px_var(--color-text-primary)] rounded-full font-semibold inline-flex items-center gap-2 cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] whitespace-nowrap h-11 px-5 enabled:hover:bg-brand-soft enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_0_0_1px_var(--color-text-primary),0_4px_12px_rgba(45,35,30,0.08)] active:scale-[0.97] max-[640px]:w-full max-[640px]:justify-center"
          aria-label="Adicionar novo cliente"
        >
          <UserPlusIcon /> Adicionar cliente
        </button>
      </div>

      {/* 2.1 BARRA DE FILTRO POR TAGS */}
      {allAvailableTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap py-1" role="group" aria-label="Filtro de tags">
          <span className="text-xs font-extrabold text-text-secondary flex items-center gap-[0.35rem] uppercase tracking-[0.06em]">
            <TagIcon /> Tags:
          </span>
          <button
            type="button"
            onClick={() => setSelectedTagFilter(null)}
            className={`bg-bg-secondary border py-[0.35rem] px-[0.85rem] min-h-8 rounded-full text-xs font-bold cursor-pointer inline-flex items-center justify-center transition-all duration-150 ease-in focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 ${selectedTagFilter === null ? 'bg-brand-primary border-brand-primary text-white hover:bg-brand-hover hover:border-brand-hover' : 'border-border text-text-primary hover:border-brand-hover hover:text-brand-hover'}`}
            aria-pressed={selectedTagFilter === null}
          >
            Todas
          </button>
          {allAvailableTags.map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
              className={`bg-bg-secondary border py-[0.35rem] px-[0.85rem] min-h-8 rounded-full text-xs font-bold cursor-pointer inline-flex items-center justify-center transition-all duration-150 ease-in focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 ${selectedTagFilter === tag ? 'bg-brand-primary border-brand-primary text-white hover:bg-brand-hover hover:border-brand-hover' : 'border-border text-text-primary hover:border-brand-hover hover:text-brand-hover'}`}
              aria-pressed={selectedTagFilter === tag}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* 3. TABELA DE CLIENTES */}
      <div className="bg-bg-secondary border border-border rounded-lg overflow-x-auto [-webkit-overflow-scrolling:touch] shadow-sm">
        {loading ? (
          <div role="status">
            <div className="spinner mb-2" />
            <p>Carregando clientes...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div role="status">
            <p>Nenhum cliente encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left max-md:block max-md:w-full" aria-label="Lista de clientes">
              <thead className="max-md:hidden">
                <tr>
                  <th scope="col" className={TH_CLASS}>Nome e perfil</th>
                  <th scope="col" className={TH_CLASS}>Telefone</th>
                  <th scope="col" className={TH_CLASS}>Tags</th>
                  <th scope="col" className={`${TH_CLASS} bg-brand-lightest`}>Status</th>
                  <th scope="col" className={TH_CLASS}>Cadastrado em</th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="max-md:block max-md:w-full">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="customer-row transition-colors duration-150 ease-in hover:bg-[rgba(217,108,0,0.04)] max-md:block max-md:w-full max-md:bg-bg-secondary max-md:border max-md:border-border max-md:rounded-lg max-md:p-4 max-md:mb-3 max-md:shadow-[0_2px_8px_rgba(0,0,0,0.05)] max-md:flex max-md:flex-col max-md:gap-[0.4rem]"
                  >
                    <td className={TD_CLASS}>
                      <div className="flex flex-col gap-[0.15rem]">
                        <strong className="font-extrabold text-text-primary text-sm">{customer.name}</strong>
                        {customer.email && <span className="text-xs text-text-secondary">{customer.email}</span>}
                      </div>
                    </td>
                    <td className={`${TD_CLASS} font-mono`}>{customer.phone}</td>
                    <td className={TD_CLASS}>
                      <div className="flex gap-[0.35rem] items-center flex-wrap">
                        {customer.tags && customer.tags.length > 0 ? (
                          customer.tags.slice(0, 2).map((t) => (
                            <span key={t} className="text-[11px] font-bold bg-[rgba(217,108,0,0.12)] text-brand-hover py-0.5 px-2 rounded-sm inline-flex items-center">
                              #{t}
                            </span>
                          ))
                        ) : (
                          <span className="text-text-secondary text-xs">Sem tags</span>
                        )}
                        {customer.tags && customer.tags.length > 2 && (
                          <span className="text-[11px] font-bold text-text-secondary">+{customer.tags.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className={TD_CLASS}>
                      {customer.cadastro_completo ? (
                        <span className="text-xs font-semibold text-success">Completo</span>
                      ) : (
                        <span className="text-xs font-semibold text-warning">Provisório</span>
                      )}
                    </td>
                    <td className={TD_CLASS}>{new Date(customer.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className={TD_LAST_CLASS}>
                      <div className="flex items-center justify-end gap-2 max-md:justify-start max-md:flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDirectWhatsApp(customer)}
                          className="w-9 h-9 p-0 inline-flex items-center justify-center rounded-md cursor-pointer transition-all duration-150 ease-in text-[#25d366] bg-[rgba(37,211,102,0.1)] shadow-[0_0_0_0.8px_var(--color-text-primary)] hover:bg-[rgba(37,211,102,0.2)] hover:shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-sm)] max-md:min-h-10 max-md:min-w-10 [touch-action:manipulation]"
                          title={`WhatsApp para ${customer.name}`}
                          aria-label={`WhatsApp para ${customer.name}`}
                        >
                          <HugeiconsIcon icon={WhatsappIcon} size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDrawer(customer)}
                          className="h-9 px-3 inline-flex items-center justify-center rounded-md bg-bg-secondary text-text-primary shadow-[0_0_0_0.8px_var(--color-text-primary)] text-xs font-bold cursor-pointer transition-all duration-150 ease-in whitespace-nowrap hover:bg-bg-primary hover:shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-sm)] focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 max-md:min-h-10 max-md:px-[0.85rem] [touch-action:manipulation]"
                          aria-label={`Ver detalhes de ${customer.name}`}
                        >
                          Central 360º
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenModal(customer)}
                          className="w-9 h-9 p-0 inline-flex items-center justify-center rounded-md bg-bg-secondary text-text-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] cursor-pointer transition-all duration-150 ease-in hover:text-text-primary hover:bg-bg-primary hover:shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-sm)] focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 max-md:min-h-10 max-md:min-w-10 [touch-action:manipulation]"
                          title={`Editar ${customer.name}`}
                          aria-label={`Editar ${customer.name}`}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerToDelete(customer)}
                          className="w-9 h-9 p-0 inline-flex items-center justify-center rounded-md text-error shadow-[0_0_0_0.8px_var(--color-text-primary)] cursor-pointer transition-all duration-150 ease-in hover:text-error hover:bg-error-bg hover:shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-sm)] focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 max-md:min-h-10 max-md:min-w-10 [touch-action:manipulation]"
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
        <div
          className="fixed inset-0 bg-[rgba(20,17,15,0.7)] backdrop-blur-[8px] z-[1100] grid place-items-center p-5 overflow-y-auto"
          onClick={() => !isSaving && setIsModalOpen(false)}
        >
          <div
            className="bg-bg-secondary border border-border rounded-xl w-full max-w-[620px] max-h-[90vh] flex flex-col overflow-hidden shadow-xl animate-dialog-in max-[640px]:max-h-[95vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="py-6 px-7 border-b border-border bg-bg-secondary flex items-start justify-between gap-4 max-[640px]:p-5">
              <div className="flex flex-col gap-[0.15rem]">
                <h3 id="modal-title" className="text-xl font-extrabold text-text-primary leading-[1.25]">
                  {editingCustomer ? 'Editar dados do cliente' : 'Cadastrar novo cliente'}
                </h3>
                <span className="text-xs text-text-secondary">
                  {editingCustomer
                    ? `Atualize as informações e preferências de atendimento de ${editingCustomer.name}`
                    : 'Preencha os dados cadastrais para adicionar à carteira da barbearia.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="bg-bg-primary border border-border text-text-secondary cursor-pointer w-[34px] h-[34px] rounded-full flex items-center justify-center transition-all duration-150 ease-in shrink-0 hover:text-text-primary hover:border-text-secondary hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2"
                aria-label="Fechar janela"
              >
                <CloseIcon />
              </button>
            </header>

            <form
              onSubmit={handleSaveSubmit}
              className="py-4 px-7 overflow-y-auto flex flex-col gap-6 bg-bg-secondary max-[640px]:px-5 max-[640px]:gap-5"
            >
              {/* Card 1: Dados principais */}
              <div className="flex flex-col gap-[0.85rem]">
                <span className="text-[11px] uppercase tracking-[0.08em] font-extrabold text-text-primary flex items-center gap-2">
                  <HugeiconsIcon icon={UserAdd01Icon} size={14} /> Dados principais
                </span>
                <Input
                  id="name-input"
                  label="Nome e sobrenome *"
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                  <Input
                    id="phone-input"
                    label="Telefone (WhatsApp) *"
                    type="text"
                    required
                    placeholder="Ex: 11999998888"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                  <Input
                    id="birthdate-input"
                    label="Data de nascimento"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Card 2: Documentação e origem */}
              <div className="flex flex-col gap-[0.85rem]">
                <span className="text-[11px] uppercase tracking-[0.08em] font-extrabold text-text-primary flex items-center gap-2">
                  <HugeiconsIcon icon={Invoice01Icon} size={14} /> Documentação e origem
                </span>
                <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                  <Input
                    id="email-input"
                    label="E-mail (opcional)"
                    type="email"
                    placeholder="Ex: joao@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  <Input
                    id="cpf-input"
                    label="CPF (opcional)"
                    type="text"
                    placeholder="Ex: 000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  />
                </div>

                <Select
                  id="channel-select"
                  label="Como conheceu a barbearia?"
                  value={formData.acquisition_channel}
                  onChange={(e) => setFormData({ ...formData, acquisition_channel: e.target.value })}
                  options={[
                    { value: '', label: 'Selecione uma opção...' },
                    { value: 'Instagram', label: 'Instagram ou redes sociais' },
                    { value: 'Indicação', label: 'Indicação de amigo' },
                    { value: 'Google', label: 'Google ou pesquisa no Maps' },
                    { value: 'Passagem', label: 'Passou em frente' },
                    { value: 'Tráfego Pago', label: 'Anúncio online' },
                    { value: 'Outro', label: 'Outro canal' },
                  ]}
                />
              </div>

              {/* Card 3: Preferências e atendimento */}
              <div className="flex flex-col gap-[0.85rem]">
                <span className="text-[11px] uppercase tracking-[0.08em] font-extrabold text-text-primary flex items-center gap-2">
                  <HugeiconsIcon icon={Tag01Icon} size={14} /> Preferências e atendimento
                </span>
                <Textarea
                  id="notes-textarea"
                  label="Observações do barbeiro"
                  rows={2}
                  placeholder="Preferências de corte, formato da barba, café favorito ou restrições..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <footer className="p-0 border-none bg-transparent shadow-none flex items-center justify-end gap-[0.85rem] mt-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="warning"
                  disabled={isSaving}
                  loading={isSaving}
                >
                  {editingCustomer ? 'Salvar alterações' : 'Salvar cliente'}
                </Button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (POLISHED & ACESSÍVEL) */}
      {customerToDelete && (
        <div
          className="fixed inset-0 bg-[rgba(20,17,15,0.7)] backdrop-blur-[8px] z-[1100] grid place-items-center p-5 overflow-y-auto"
          onClick={() => !isDeleting && setCustomerToDelete(null)}
        >
          <div
            className="max-w-[480px] bg-bg-secondary rounded-xl shadow-[0_20px_50px_rgba(45,35,30,0.25),0_0_0_1px_rgba(240,82,82,0.15)] w-full max-h-[90vh] flex flex-col overflow-hidden animate-dialog-in max-[640px]:max-h-[95vh]"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-7 px-7 pb-5 flex flex-col gap-[1.15rem]">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-[0.08em] font-extrabold text-error">Confirmação de exclusão</span>
                <h3 id="delete-dialog-title" className="text-xl font-extrabold text-text-primary m-0 tracking-[-0.01em]">
                  Excluir cadastro do cliente?
                </h3>
                <p id="delete-dialog-desc" className="text-sm text-text-secondary leading-relaxed m-0">
                  Esta ação é permanente e vai remover o cliente da sua carteira ativa.
                </p>
              </div>

              <div className="bg-bg-primary border border-border rounded-lg py-4 px-5 w-full flex items-center justify-between text-left">
                <div className="flex flex-col gap-[0.15rem]">
                  <strong className="font-extrabold text-text-primary text-sm">{customerToDelete.name}</strong>
                  <span className="text-xs text-text-secondary font-mono">{customerToDelete.phone}</span>
                </div>
                {customerToDelete.cadastro_completo ? (
                  <span className="text-xs font-semibold text-success">Completo</span>
                ) : (
                  <span className="text-xs font-semibold text-warning">Provisório</span>
                )}
              </div>

              <div className="bg-warning-bg border border-[rgba(217,119,6,0.3)] rounded-md py-[0.85rem] px-[1.15rem] text-xs text-brand-deep leading-[1.45] text-left flex gap-[0.65rem] items-start [&_svg]:shrink-0 [&_svg]:text-warning [&_svg]:mt-px">
                <HugeiconsIcon icon={AlertCircleIcon} size={18} />
                <span>
                  <strong>Aviso de segurança:</strong> clientes com agendamentos ou comandas registradas não podem ser excluídos para manter a integridade do histórico financeiro.
                </span>
              </div>
            </div>

            <footer className="py-5 px-7 border-t border-border bg-bg-primary flex items-center justify-end gap-[0.85rem] max-[640px]:py-4 max-[640px]:px-5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCustomerToDelete(null)}
                className="btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="bg-error text-white border border-error font-bold inline-flex items-center justify-center gap-2 rounded-md cursor-pointer px-5 py-3 text-sm transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:brightness-90 focus-visible:outline-2 focus-visible:outline-error focus-visible:outline-offset-2"
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
            className="fixed inset-0 bg-[rgba(20,17,15,0.6)] backdrop-blur-[6px] z-[1000]"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed top-0 right-0 bottom-0 w-full max-w-[520px] bg-bg-primary border-l border-border z-[1001] flex flex-col shadow-xl animate-slide-in-right max-md:w-full max-md:max-w-full max-md:rounded-t-[20px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            {/* Header da Central 360 */}
            <header className="py-6 px-7 border-b border-border flex items-start justify-between bg-bg-secondary gap-4">
              <div className="flex items-start flex-1">
                <div className="flex flex-col gap-[0.2rem]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase tracking-[0.08em] font-extrabold text-brand-hover">
                      {selectedCustomer.cadastro_completo ? 'Perfil confirmado' : 'Primeiro contato (WhatsApp)'}
                    </span>
                  </div>
                  <h3 id="drawer-title" className="text-[1.35rem] font-extrabold my-[0.1rem] text-text-primary tracking-[-0.01em]">
                    {selectedCustomer.name}
                  </h3>
                  <span className="text-sm text-text-secondary font-mono">{selectedCustomer.phone}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="bg-bg-primary border border-border text-text-secondary cursor-pointer w-[34px] h-[34px] rounded-full flex items-center justify-center transition-all duration-150 ease-in shrink-0 hover:text-text-primary hover:border-text-secondary hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2"
                aria-label="Fechar Central 360"
              >
                <CloseIcon />
              </button>
            </header>

            {/* Ações Rápidas de Topo (Copiar Link, WhatsApp e Novo Agendamento) */}
            <div
              className="grid [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))] gap-[0.65rem] py-4 px-7 bg-bg-secondary border-b border-border"
              role="toolbar"
              aria-label="Ações rápidas do cliente"
            >
              <button
                type="button"
                onClick={() => {
                  handleCopyLink(selectedCustomer.token_acesso);
                }}
                className="w-full inline-flex items-center justify-center gap-[0.45rem] py-[0.6rem] px-[0.85rem] text-xs font-bold no-underline rounded-md text-text-primary bg-bg-primary border border-border cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-brand-hover hover:border-brand-primary hover:bg-[rgba(217,108,0,0.08)] hover:-translate-y-px active:translate-y-0"
                title="Copiar link de autoagendamento do cliente"
                aria-label="Copiar link de agendamento"
              >
                <CopyIcon /> Copiar link
              </button>
              {selectedCustomer.phone && (
                <button
                  type="button"
                  onClick={() => handleOpenDirectWhatsApp(selectedCustomer)}
                  className="w-full inline-flex items-center justify-center gap-[0.45rem] py-[0.6rem] px-[0.85rem] text-xs font-bold no-underline rounded-md text-text-primary bg-bg-primary border border-border cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-brand-hover hover:border-brand-primary hover:bg-[rgba(217,108,0,0.08)] active:translate-y-0"
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
                className="w-full inline-flex items-center justify-center gap-[0.45rem] py-[0.6rem] px-[0.85rem] text-xs font-bold no-underline rounded-md cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] bg-brand-primary text-bg-primary border border-brand-primary hover:bg-brand-hover hover:border-brand-hover"
                title="Agendar novo horário na grade"
                aria-label="Novo agendamento"
              >
                <HugeiconsIcon icon={Calendar01Icon} size={15} /> Novo agendamento
              </button>
            </div>

            {/* Abas de Navegação 360 */}
            <div className="flex border-b border-border bg-bg-secondary" aria-label="Seções da Central 360">
              <button
                type="button"
                aria-selected={activeTab360 === 'dados'}
                aria-controls="panel-dados"
                id="tab-dados"
                onClick={() => setActiveTab360('dados')}
                className={`flex-1 py-[0.85rem] px-2 border-none bg-transparent text-xs font-bold uppercase tracking-[0.05em] cursor-pointer border-b-2 transition-all duration-200 ease-in focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-[-2px] ${
                  activeTab360 === 'dados'
                    ? 'text-brand-hover border-b-brand-primary bg-[rgba(217,108,0,0.04)]'
                    : 'text-text-secondary border-b-transparent hover:text-text-primary'
                }`}
              >
                Dados e tags
              </button>
              <button
                type="button"
                aria-selected={activeTab360 === 'historico'}
                aria-controls="panel-historico"
                id="tab-historico"
                onClick={() => setActiveTab360('historico')}
                className={`flex-1 py-[0.85rem] px-2 border-none bg-transparent text-xs font-bold uppercase tracking-[0.05em] cursor-pointer border-b-2 transition-all duration-200 ease-in focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-[-2px] ${
                  activeTab360 === 'historico'
                    ? 'text-brand-hover border-b-brand-primary bg-[rgba(217,108,0,0.04)]'
                    : 'text-text-secondary border-b-transparent hover:text-text-primary'
                }`}
              >
                Linha do tempo ({history.length + comandasHistory.length})
              </button>
              <button
                type="button"
                aria-selected={activeTab360 === 'metricas'}
                aria-controls="panel-metricas"
                id="tab-metricas"
                onClick={() => setActiveTab360('metricas')}
                className={`flex-1 py-[0.85rem] px-2 border-none bg-transparent text-xs font-bold uppercase tracking-[0.05em] cursor-pointer border-b-2 transition-all duration-200 ease-in focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-[-2px] ${
                  activeTab360 === 'metricas'
                    ? 'text-brand-hover border-b-brand-primary bg-[rgba(217,108,0,0.04)]'
                    : 'text-text-secondary border-b-transparent hover:text-text-primary'
                }`}
              >
                Métricas e LTV
              </button>
            </div>

            {/* Corpo do Drawer com base na Aba Ativa */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {loadingDetails ? (
                <div className="py-4" role="status">
                  <div className="spinner mb-2" />
                  <p>Carregando perfil 360º...</p>
                </div>
              ) : activeTab360 === 'dados' ? (
                /* ABA 1: DADOS CADASTRAIS E TAGS */
                <div
                  id="panel-dados"
                  role="tabpanel"
                  aria-labelledby="tab-dados"
                  className="flex flex-col gap-5"
                >
                  {/* TAGS INTERATIVAS */}
                  <div className="bg-bg-secondary border border-border rounded-lg p-5 flex flex-col gap-4 shadow-sm">
                    <h4 className="text-sm font-extrabold text-text-primary flex items-center gap-2 uppercase tracking-[0.04em]">
                      <TagIcon /> Tags e categorias do cliente
                    </h4>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2" role="list" aria-label="Tags do cliente">
                        {selectedCustomer.tags && selectedCustomer.tags.length > 0 ? (
                          selectedCustomer.tags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-[0.4rem] bg-[rgba(217,108,0,0.12)] text-brand-hover font-bold text-xs py-1 px-2.5 rounded-sm border border-[rgba(217,108,0,0.15)]"
                              role="listitem"
                            >
                              #{t}
                              <button
                                type="button"
                                onClick={() => handleRemoveTagFromCustomer(t)}
                                className="bg-transparent border-none text-brand-hover font-extrabold cursor-pointer py-0.5 px-1 text-sm leading-none rounded-sm inline-flex items-center justify-center transition-all duration-150 ease-in hover:bg-[rgba(217,108,0,0.2)] hover:text-brand-deep focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-1"
                                title={`Remover tag ${t}`}
                                aria-label={`Remover tag ${t}`}
                              >
                                &times;
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-text-secondary text-sm">Nenhuma tag atribuída a este cliente ainda.</span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-1">
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
                          className="pl-4 h-9 rounded-md bg-bg-secondary text-text-primary flex-1 min-w-0 outline-none text-sm shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-shadow duration-200 ease-in focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddTagToCustomer(newTagInput)}
                          className="btn py-[0.4rem] px-[0.875rem] text-xs"
                          aria-label="Adicionar tag ao cliente"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* INFORMAÇÕES PESSOAIS */}
                  <div className="bg-bg-secondary border border-border rounded-lg p-5 flex flex-col gap-4 shadow-sm">
                    <h4 className="text-sm font-extrabold text-text-primary flex items-center gap-2 uppercase tracking-[0.04em]">Dados cadastrais</h4>
                    <div className="grid grid-cols-2 gap-[0.85rem] max-[640px]:grid-cols-1">
                      <div className="flex flex-col gap-[0.15rem]">
                        <span className="text-xs text-text-secondary font-semibold uppercase tracking-[0.04em]">Nome completo:</span>
                        <strong className="text-sm text-text-primary">{selectedCustomer.name}</strong>
                      </div>
                      <div className="flex flex-col gap-[0.15rem]">
                        <span className="text-xs text-text-secondary font-semibold uppercase tracking-[0.04em]">Telefone WhatsApp:</span>
                        <span className="text-sm text-text-primary font-mono">{selectedCustomer.phone}</span>
                      </div>
                      <div className="flex flex-col gap-[0.15rem]">
                        <span className="text-xs text-text-secondary font-semibold uppercase tracking-[0.04em]">Data de aniversário:</span>
                        <span className="text-sm text-text-primary">
                          {selectedCustomer.birth_date
                            ? new Date(selectedCustomer.birth_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'long',
                              })
                            : 'Não informada'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-[0.15rem]">
                        <span className="text-xs text-text-secondary font-semibold uppercase tracking-[0.04em]">Canal de origem:</span>
                        <span className="text-sm text-text-primary">{selectedCustomer.acquisition_channel || 'Não informado'}</span>
                      </div>
                      {selectedCustomer.cpf && (
                        <div className="flex flex-col gap-[0.15rem]">
                          <span className="text-xs text-text-secondary font-semibold uppercase tracking-[0.04em]">CPF do cliente:</span>
                          <span className="text-sm text-text-primary font-mono">{selectedCustomer.cpf}</span>
                        </div>
                      )}
                      {selectedCustomer.email && (
                        <div className="flex flex-col gap-[0.15rem]">
                          <span className="text-xs text-text-secondary font-semibold uppercase tracking-[0.04em]">E-mail de contato:</span>
                          <span className="text-sm text-text-primary">{selectedCustomer.email}</span>
                        </div>
                      )}
                      {selectedCustomer.notes && (
                        <div className="flex flex-col gap-[0.15rem] col-span-full">
                          <span className="text-xs text-text-secondary font-semibold uppercase tracking-[0.04em]">Observações do atendimento:</span>
                          <p className="text-sm text-text-primary italic">{selectedCustomer.notes}</p>
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
                  className="flex flex-col gap-5"
                >
                  <div className="bg-bg-secondary border border-border rounded-lg p-5 flex flex-col gap-4 shadow-sm">
                    <h4 className="text-sm font-extrabold text-text-primary flex items-center gap-2 uppercase tracking-[0.04em]">Linha do tempo de atendimentos</h4>
                    {history.length === 0 && comandasHistory.length === 0 ? (
                      <div role="status">
                        Nenhum atendimento ou comanda registrado até o momento.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {comandasHistory.map((cmd) => (
                          <div key={cmd.id} className="border border-border rounded-md p-4 bg-bg-secondary transition-colors duration-150 ease-in hover:border-brand-soft">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-brand-hover flex items-center gap-1">
                                <ReceiptIcon /> Comanda #{cmd.comanda_number}
                              </span>
                              <span>
                                {cmd.status === 'fechada' && 'Paga'}
                                {cmd.status === 'aberta' && 'Em aberto'}
                                {cmd.status === 'cancelada' && 'Cancelada'}
                              </span>
                            </div>
                            <div>
                              <div className="flex flex-col gap-[0.35rem] text-xs">
                                {cmd.items.map((it) => (
                                  <div key={it.id} className="flex justify-between text-text-primary">
                                    <span>
                                      {it.quantity}x {it.name}
                                    </span>
                                    <span className="font-mono">
                                      R$ {(it.quantity * it.unit_price).toFixed(2).replace('.', ',')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed border-border">
                                <span className="text-text-secondary text-xs">
                                  {new Date(cmd.closed_at || cmd.created_at).toLocaleString('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })}
                                </span>
                                <strong>
                                  Total: R$ {cmd.total_final.toFixed(2).replace('.', ',')}
                                </strong>
                              </div>
                            </div>
                          </div>
                        ))}

                        {history.map((app) => (
                          <div key={app.id} className="border border-border rounded-md p-4 bg-bg-secondary transition-colors duration-150 ease-in hover:border-brand-soft">
                            <div className="flex items-center justify-between mb-2">
                              <strong className="text-sm font-bold text-text-primary">{app.service_name}</strong>
                              <span>
                                {app.status === 'completed' && 'Concluído'}
                                {app.status === 'confirmed' && 'Confirmado'}
                                {app.status === 'pending' && 'Pendente'}
                                {app.status === 'canceled' && 'Cancelado'}
                              </span>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-text-secondary">Profissional:</span>
                                <span>{app.professional_name}</span>
                              </div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-text-secondary">Data e horário:</span>
                                <span>
                                  {new Date(app.start_time).toLocaleString('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-text-secondary">Valor cobrado:</span>
                                <strong>
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
                  className="flex flex-col gap-5"
                >
                  <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                    <div className="p-[1.15rem] flex flex-col gap-1 bg-bg-secondary border border-border rounded-lg shadow-sm">
                      <span className="text-[11px] uppercase tracking-[0.05em] font-bold text-text-secondary">Total investido (LTV)</span>
                      <span className="text-2xl font-extrabold text-text-primary text-brand-primary font-mono">
                        R$ {ltvMetrics.totalSpend.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-[11px] text-text-secondary">Faturamento total gerado por este cliente</span>
                    </div>

                    <div className="p-[1.15rem] flex flex-col gap-1 bg-bg-secondary border border-border rounded-lg shadow-sm">
                      <span className="text-[11px] uppercase tracking-[0.05em] font-bold text-text-secondary">Ticket médio</span>
                      <span className="text-2xl font-extrabold text-text-primary font-mono">
                        R$ {ltvMetrics.averageTicket.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-[11px] text-text-secondary">Média gasta em cada atendimento</span>
                    </div>

                    <div className="p-[1.15rem] flex flex-col gap-1 bg-bg-secondary border border-border rounded-lg shadow-sm">
                      <span className="text-[11px] uppercase tracking-[0.05em] font-bold text-text-secondary">Total de visitas</span>
                      <span className="text-2xl font-extrabold text-text-primary">{ltvMetrics.totalVisits}</span>
                      <span className="text-[11px] text-text-secondary">Atendimentos concluídos na barbearia</span>
                    </div>

                    <div className="p-[1.15rem] flex flex-col gap-1 bg-bg-secondary border border-border rounded-lg shadow-sm">
                      <span className="text-[11px] uppercase tracking-[0.05em] font-bold text-text-secondary">Frequência média</span>
                      <span className="text-2xl font-extrabold text-text-primary">
                        {ltvMetrics.averageDaysBetweenVisits > 0
                          ? `${ltvMetrics.averageDaysBetweenVisits} dias`
                          : 'Primeira visita'}
                      </span>
                      <span className="text-[11px] text-text-secondary">Intervalo médio entre retornos</span>
                    </div>
                  </div>

                  {ltvMetrics.lastVisitDate && (
                    <div className="bg-bg-secondary border border-border rounded-md py-[0.85rem] px-4 mt-3">
                      <span className="text-sm text-text-secondary">
                        Último atendimento registrado em:{' '}
                        <strong>
                          {/* lastVisitDate já é o dia de negócio; meio-dia UTC evita virar o dia ao formatar */}
                          {new Date(`${ltvMetrics.lastVisitDate}T12:00:00Z`).toLocaleDateString('pt-BR', {
                            dateStyle: 'long',
                            timeZone: 'UTC',
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
          className="fixed inset-0 bg-[rgba(20,17,15,0.7)] backdrop-blur-[8px] z-[1100] grid place-items-center p-5 overflow-y-auto"
          onClick={() => {
            if (!isSendingWhatsApp) setIsDirectWhatsAppModalOpen(false);
          }}
        >
          <div
            className="bg-bg-secondary border border-border rounded-xl w-full max-w-[540px] max-h-[90vh] flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(45,35,30,0.2),0_0_0_1px_rgba(217,108,0,0.08)] max-[640px]:max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-modal-title"
          >
            <header className="py-6 px-7 border-b border-border bg-bg-secondary flex items-start justify-between gap-4 max-[640px]:p-5">
              <div className="flex flex-col gap-[0.15rem]">
                <span className="text-[11px] uppercase tracking-[0.08em] font-extrabold text-brand-hover">Mensageria Uazapi</span>
                <h3 id="whatsapp-modal-title" className="text-xl font-extrabold text-text-primary leading-[1.25]">
                  Enviar WhatsApp para {selectedCustomer.name}
                </h3>
              </div>
              <button
                type="button"
                className="w-9 h-9 p-0 inline-flex items-center justify-center rounded-md bg-bg-secondary text-text-secondary shadow-[0_0_0_0.8px_var(--color-text-primary)] cursor-pointer transition-all duration-150 ease-in hover:text-text-primary hover:bg-bg-primary hover:shadow-[0_0_0_0.8px_var(--color-text-primary),var(--shadow-sm)] focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2"
                onClick={() => setIsDirectWhatsAppModalOpen(false)}
                disabled={isSendingWhatsApp}
                aria-label="Fechar modal de WhatsApp"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="py-4 px-7 overflow-y-auto flex flex-col gap-6 bg-bg-secondary max-[640px]:px-5 max-[640px]:gap-5">
              <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-md py-3 px-4 mb-5">
                <span className="text-xs text-text-secondary font-medium">Destinatário:</span>
                <strong className="text-sm text-brand-primary tracking-[0.05em] font-mono">{selectedCustomer.phone}</strong>
              </div>

              <div className="mb-5 flex flex-col gap-2">
                <label className="text-[0.85rem] font-semibold text-text-primary">Escolha um modelo rápido:</label>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Modelos de mensagem">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={whatsAppTemplate === 'retorno'}
                    className={`bg-bg-secondary border rounded-full text-xs py-[0.4rem] px-[0.85rem] cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] inline-flex items-center gap-[0.35rem] ${
                      whatsAppTemplate === 'retorno'
                        ? 'bg-brand-lightest border-brand-primary text-brand-primary font-bold'
                        : 'border-border text-text-secondary font-semibold hover:bg-bg-primary hover:border-brand-primary hover:text-text-primary'
                    }`}
                    onClick={() => handleSelectTemplate('retorno')}
                  >
                    ⚡ Lembrete de retorno
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={whatsAppTemplate === 'agradecimento'}
                    className={`bg-bg-secondary border rounded-full text-xs py-[0.4rem] px-[0.85rem] cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] inline-flex items-center gap-[0.35rem] ${
                      whatsAppTemplate === 'agradecimento'
                        ? 'bg-brand-lightest border-brand-primary text-brand-primary font-bold'
                        : 'border-border text-text-secondary font-semibold hover:bg-bg-primary hover:border-brand-primary hover:text-text-primary'
                    }`}
                    onClick={() => handleSelectTemplate('agradecimento')}
                  >
                    🤝 Agradecimento
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={whatsAppTemplate === 'livre'}
                    className={`bg-bg-secondary border rounded-full text-xs py-[0.4rem] px-[0.85rem] cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] inline-flex items-center gap-[0.35rem] ${
                      whatsAppTemplate === 'livre'
                        ? 'bg-brand-lightest border-brand-primary text-brand-primary font-bold'
                        : 'border-border text-text-secondary font-semibold hover:bg-bg-primary hover:border-brand-primary hover:text-text-primary'
                    }`}
                    onClick={() => handleSelectTemplate('livre')}
                  >
                    ✍️ Mensagem livre
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-[0.4rem]">
                <label htmlFor="whatsapp-message-textarea" className="text-[0.85rem] font-semibold text-text-primary">
                  Mensagem que será enviada pelo WhatsApp conectado da barbearia:
                </label>
                <textarea
                  id="whatsapp-message-textarea"
                  rows={4}
                  value={whatsAppCustomMessage}
                  onChange={(e) => setWhatsAppCustomMessage(e.target.value)}
                  placeholder="Digite a mensagem para o cliente..."
                  className="pl-4 pr-4 py-3 rounded-md bg-bg-secondary text-text-primary w-full outline-none text-sm shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-shadow duration-200 ease-in focus:shadow-[0_0_0_1.5px_var(--color-brand-primary)]"
                  disabled={isSendingWhatsApp}
                />
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-border flex-wrap gap-2">
                <span className="text-text-secondary text-xs">Ou se preferir abrir manualmente no navegador:</span>
                <a
                  href={formatWhatsAppUrl(selectedCustomer.phone, whatsAppCustomMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-brand-primary no-underline transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-brand-hover hover:underline"
                >
                  Abrir no WhatsApp Web ↗
                </a>
              </div>
            </div>

            <footer className="py-5 px-7 border-t border-border bg-bg-primary flex items-center justify-end gap-[0.85rem] max-[640px]:py-4 max-[640px]:px-5">
              <button
                type="button"
                onClick={() => setIsDirectWhatsAppModalOpen(false)}
                className="btn"
                disabled={isSendingWhatsApp}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendDirectWhatsApp}
                className="btn btn--primary inline-flex items-center gap-2"
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
