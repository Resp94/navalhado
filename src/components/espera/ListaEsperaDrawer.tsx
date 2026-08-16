import React, { useState, useEffect, useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  PlusSignIcon,
  UserGroupIcon,
  WhatsappIcon,
} from '@hugeicons/core-free-icons';
import { EsperaRepository } from '../../modules/espera/EsperaRepository';
import { SupabaseEsperaAdapter } from '../../modules/espera/adapters/SupabaseEsperaAdapter';
import type { WaitingListEntry } from '../../modules/espera/types';

interface ProfessionalOption {
  id: string;
  name: string;
}

interface ServiceOption {
  id: string;
  name: string;
  price: number;
}

interface ListaEsperaDrawerProps {
  isOpen: boolean;
  tenantId: string;
  currentDateIso: string;
  professionals: ProfessionalOption[];
  services: ServiceOption[];
  onClose: () => void;
  onEncaixar: (entry: WaitingListEntry) => void;
  esperaRepo?: EsperaRepository;
}

export const ListaEsperaDrawer: React.FC<ListaEsperaDrawerProps> = ({
  isOpen,
  tenantId,
  currentDateIso,
  professionals,
  services,
  onClose,
  onEncaixar,
  esperaRepo,
}) => {
  const repo = esperaRepo || new EsperaRepository(new SupabaseEsperaAdapter());

  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // Form states
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [profId, setProfId] = useState<string>('');
  const [servId, setServId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await repo.listByDate(tenantId, currentDateIso);
      setEntries(data);
    } catch (err) {
      console.error('Erro ao carregar lista de espera:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, currentDateIso, repo]);

  useEffect(() => {
    if (isOpen) {
      fetchEntries();
    }
  }, [isOpen, fetchEntries]);

  if (!isOpen) return null;

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerName.trim()) {
      setErrorMsg('Informe o nome do cliente.');
      return;
    }

    setIsSubmitting(true);
    try {
      await repo.addEntry({
        tenant_id: tenantId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        professional_id: profId || null,
        service_id: servId || null,
        notes: notes.trim() || null,
        status: 'aguardando',
      });

      setCustomerName('');
      setCustomerPhone('');
      setProfId('');
      setServId('');
      setNotes('');
      setShowAddForm(false);
      fetchEntries();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao adicionar cliente à lista de espera.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'atendido' | 'cancelado') => {
    try {
      await repo.setStatus(id, newStatus);
      fetchEntries();
    } catch (err) {
      console.error('Erro ao atualizar status da lista de espera:', err);
    }
  };

  const handleNotifyWhatsApp = (entry: WaitingListEntry) => {
    const cleanPhone = entry.customer_phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(
      `Olá ${entry.customer_name}! Temos uma vaga disponível para você na barbearia agora. Deseja confirmar seu encaixe?`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  const aguardandoEntries = entries.filter((e) => e.status === 'aguardando');
  const finalizadasEntries = entries.filter((e) => e.status !== 'aguardando');

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-espera-title"
    >
      <div className="w-full max-w-md h-full bg-[var(--color-bg-primary,#121214)] border-l border-[var(--color-border-subtle,rgba(255,255,255,0.1))] flex flex-col shadow-2xl text-[var(--color-text-primary,#fff)] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-subtle,rgba(255,255,255,0.08))]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-primary,#D4AF37)]/15 flex items-center justify-center text-[var(--color-brand-primary,#D4AF37)]">
              <HugeiconsIcon icon={UserGroupIcon} size={22} />
            </div>
            <div>
              <h3 id="drawer-espera-title" className="text-lg font-bold">
                Lista de Espera do Dia
              </h3>
              <p className="text-xs text-[var(--color-text-secondary,#A1A1AA)]">
                {aguardandoEntries.length} cliente(s) aguardando vaga
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-[var(--color-text-secondary,#A1A1AA)] hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Fechar"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[var(--color-brand-primary,#D4AF37)] text-[var(--color-brand-primary,#D4AF37)] hover:bg-[var(--color-brand-primary,#D4AF37)]/10 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} />
              <span>Adicionar Cliente na Espera</span>
            </button>
          ) : (
            <form onSubmit={handleAddSubmit} className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Novo na Espera</h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-[var(--color-text-secondary,#A1A1AA)] hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              {errorMsg && (
                <div className="p-2 rounded-lg bg-[var(--color-error,#EF4444)]/15 border border-[var(--color-error,#EF4444)]/30 text-xs text-[var(--color-error,#EF4444)]">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary,#A1A1AA)] mb-1">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Pedro Henrique"
                  className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary,#A1A1AA)] mb-1">
                  WhatsApp / Celular
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-text-secondary,#A1A1AA)] mb-1">
                    Profissional Preferido
                  </label>
                  <select
                    value={profId}
                    onChange={(e) => setProfId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white"
                  >
                    <option value="">Qualquer Barbeiro (Rodízio)</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-text-secondary,#A1A1AA)] mb-1">
                    Serviço
                  </label>
                  <select
                    value={servId}
                    onChange={(e) => setServId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white"
                  >
                    <option value="">Selecione...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary,#A1A1AA)] mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Pode vir até as 17h..."
                  className="w-full px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-[var(--color-brand-primary,#D4AF37)] text-black font-bold text-xs rounded-lg hover:opacity-90 transition-opacity"
              >
                {isSubmitting ? 'Salvando...' : 'Confirmar na Lista'}
              </button>
            </form>
          )}

          {/* Lista de Aguardando */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)]">
              Aguardando ({aguardandoEntries.length})
            </h4>

            {loading ? (
              <p className="text-xs text-[var(--color-text-secondary,#A1A1AA)]">Carregando...</p>
            ) : aguardandoEntries.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary,#A1A1AA)] italic">
                Nenhum cliente na fila de espera hoje.
              </p>
            ) : (
              aguardandoEntries.map((entry, index) => {
                const prof = professionals.find((p) => p.id === entry.professional_id);
                const serv = services.find((s) => s.id === entry.service_id);

                return (
                  <div
                    key={entry.id}
                    className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                          #{index + 1}
                        </span>
                        <strong className="text-sm text-white">{entry.customer_name}</strong>
                      </div>
                      <span className="text-[11px] text-[var(--color-text-secondary,#A1A1AA)] flex items-center gap-1">
                        <HugeiconsIcon icon={Clock01Icon} size={12} />
                        {entry.created_at ? new Date(entry.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div className="text-xs text-[var(--color-text-secondary,#A1A1AA)] space-y-0.5">
                      {prof ? (
                        <p>Barbeiro: <span className="text-white font-medium">{prof.name}</span></p>
                      ) : (
                        <p className="text-[var(--color-brand-primary,#D4AF37)] font-medium">Qualquer Barbeiro (Rodízio)</p>
                      )}
                      {serv && <p>Serviço: <span className="text-white font-medium">{serv.name}</span></p>}
                      {entry.notes && <p className="italic">Obs: {entry.notes}</p>}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      {entry.customer_phone && (
                        <button
                          type="button"
                          onClick={() => handleNotifyWhatsApp(entry)}
                          className="p-1.5 rounded-lg bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 transition-colors"
                          title="Chamar no WhatsApp"
                        >
                          <HugeiconsIcon icon={WhatsappIcon} size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEncaixar(entry)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-[var(--color-brand-primary,#D4AF37)] text-black text-xs font-bold flex items-center justify-center gap-1 hover:opacity-90 transition-opacity"
                      >
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} />
                        <span>Encaixar na Grade</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(entry.id, 'cancelado')}
                        className="p-1.5 rounded-lg text-[var(--color-text-secondary,#A1A1AA)] hover:text-[var(--color-error,#EF4444)] hover:bg-white/5 transition-colors"
                        title="Desistir / Cancelar"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Histórico do Dia */}
          {finalizadasEntries.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-white/10 opacity-75">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)]">
                Atendidos / Desistências ({finalizadasEntries.length})
              </h4>
              {finalizadasEntries.map((entry) => (
                <div key={entry.id} className="p-2.5 rounded-lg bg-black/20 text-xs flex items-center justify-between">
                  <span>{entry.customer_name}</span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${entry.status === 'atendido' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {entry.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
