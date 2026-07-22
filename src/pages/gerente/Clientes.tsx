import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { useToast } from '../../components/Toast';
import { useClientes } from '../../modules/clientes/useClientes';
import type { Customer } from '../../modules/clientes/types';
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
    loadingHistory,
    saveCustomer,
    deleteCustomer,
    loadHistorico,
  } = useClientes(tenant.tenantId);

  // Estados dos Modais e Gaveta de UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '' });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

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

  const handleOpenModal = (customer: Customer | null = null) => {
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

  const handleOpenDrawer = (customer: Customer) => {
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
    <div className="clientes-page page-entry-anim p-6 space-y-6">
      {/* 1. ESTATÍSTICAS DA BASE */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <span className="text-xs uppercase tracking-wider text-slate-400 block font-semibold mb-1">Total da Base</span>
          <span className="text-3xl font-extrabold text-white">{stats.totalCount}</span>
          <span className="text-xs text-slate-500 block mt-1">Clientes na carteira</span>
        </div>
        <div className="stat-card bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <span className="text-xs uppercase tracking-wider text-slate-400 block font-semibold mb-1">Cadastros Completos</span>
          <span className="text-3xl font-extrabold text-emerald-400">{stats.completosCount}</span>
          <span className="text-xs text-slate-500 block mt-1">Dados de nome confirmados</span>
        </div>
        <div className="stat-card bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <span className="text-xs uppercase tracking-wider text-slate-400 block font-semibold mb-1">WhatsApp (Provisórios)</span>
          <span className="text-3xl font-extrabold text-amber-400">{stats.provisoriosCount}</span>
          <span className="text-xs text-slate-500 block mt-1">Apenas primeiro contato</span>
        </div>
      </section>

      {/* 2. CONTROLES E BUSCA */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
          <input 
            type="text" 
            placeholder="Buscar por nome ou telefone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterStatus('todos')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterStatus === 'todos' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilterStatus('completos')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterStatus === 'completos' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'}`}
          >
            Completos
          </button>
          <button 
            onClick={() => setFilterStatus('provisorios')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterStatus === 'provisorios' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'}`}
          >
            WhatsApp
          </button>
        </div>

        <button onClick={() => handleOpenModal(null)} className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors shadow-lg">
          <UserPlusIcon /> Adicionar Cliente
        </button>
      </div>

      {/* 3. TABELA DE CLIENTES */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="inline-block animate-spin w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full mb-2"></div>
            <p>Carregando clientes...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <p>Nenhum cliente encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-4">Nome</th>
                  <th className="p-4">Telefone</th>
                  <th className="p-4">Status Cadastro</th>
                  <th className="p-4">Cadastrado Em</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="customer-row hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <strong className="text-white font-semibold">{customer.name}</strong>
                        {customer.email && <span className="text-xs text-slate-400">{customer.email}</span>}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-slate-300">{customer.phone}</td>
                    <td className="p-4">
                      {customer.cadastro_completo ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-semibold">Cadastrado</span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2.5 py-1 rounded-full font-semibold">WhatsApp (Provisório)</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-400">
                      {new Date(customer.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenDrawer(customer)} 
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-700 transition-colors"
                          aria-label="Ver Detalhes"
                        >
                          Ver Detalhes
                        </button>
                        <button 
                          onClick={() => handleOpenModal(customer)} 
                          className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-md transition-colors"
                          title="Editar"
                          aria-label="Editar"
                        >
                          <EditIcon />
                        </button>
                        <button 
                          onClick={() => handleDeleteSubmit(customer.id)} 
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
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
          </div>
        )}
      </div>

      {/* 4. MODAL DE CADASTRO/EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editingCustomer ? 'Editar Dados do Cliente' : 'Novo Cadastro de Cliente'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1">Nome *</label>
                <input 
                  type="text" 
                  aria-label="Nome"
                  required
                  placeholder="Ex: João da Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1">Telefone (WhatsApp) *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: 11999998888"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1">E-mail (Opcional)</label>
                <input 
                  type="email" 
                  placeholder="Ex: joao@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1">Observações Internas</label>
                <textarea 
                  rows={3}
                  placeholder="Preferências de corte, observações de atendimento..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-950 border border-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 shadow-lg transition-colors"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. GAVETA LATERAL DE DETALHES DO CLIENTE */}
      {isDrawerOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => setIsDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-sky-400">Ficha do Cliente</span>
                  <h3 className="text-xl font-bold text-white mt-0.5">{selectedCustomer.name}</h3>
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <CloseIcon />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Detalhes do Cliente</h4>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold uppercase">Telefone:</span>
                    <span className="font-mono text-white font-semibold">{selectedCustomer.phone}</span>
                  </div>
                  {selectedCustomer.email && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-semibold uppercase">E-mail:</span>
                      <span className="text-slate-200">{selectedCustomer.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold uppercase">Status:</span>
                    {selectedCustomer.cadastro_completo ? (
                      <span className="text-emerald-400 font-semibold">Completo</span>
                    ) : (
                      <span className="text-amber-400 font-semibold">Provisório (WhatsApp)</span>
                    )}
                  </div>
                </div>

                {/* AÇÕES RÁPIDAS DE LINK E WHATSAPP */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Link Exclusivo do Cliente</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleCopyLink(selectedCustomer.token_acesso)}
                      className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                    >
                      <CopyIcon /> Copiar Link
                    </button>
                    <button 
                      onClick={() => handleSendWhatsApp(selectedCustomer.phone, selectedCustomer.token_acesso, selectedCustomer.name)}
                      className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors shadow-lg"
                    >
                      <WhatsappIcon /> Enviar WhatsApp
                    </button>
                  </div>
                </div>

                {/* HISTÓRICO DE VISITAS */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Histórico de Visitas</h4>
                  {history.length === 0 ? (
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
                      Nenhum agendamento encontrado para este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((app) => (
                        <div key={app.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-white font-semibold block">{app.service_name}</span>
                            <span className="text-slate-400 text-2xs">{new Date(app.start_time).toLocaleDateString('pt-BR')} • <span>{app.professional_name}</span></span>
                          </div>
                          <span className="font-mono text-emerald-400 font-bold">R$ {app.service_price.toFixed(2).replace('.', ',')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
