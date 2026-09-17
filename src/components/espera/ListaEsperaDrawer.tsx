import React, { useState, useEffect, useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  Calendar03Icon,
  Clock01Icon,
  PlusSignIcon,
  WhatsappIcon,
} from '@hugeicons/core-free-icons';
import { EsperaRepository } from '../../modules/espera/EsperaRepository';
import { SupabaseEsperaAdapter } from '../../modules/espera/adapters/SupabaseEsperaAdapter';
import type { WaitingListEntry } from '../../modules/espera/types';
import { Select } from '../../components/ui';
import { openWhatsApp } from '../../lib/whatsapp';
import { CustomDatePicker } from '../CustomDatePicker';

const formatDateDisplay = (isoDate: string) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return isoDate;
};

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
  onDateChange?: (dateIso: string) => void;
  esperaRepo?: EsperaRepository;
}

const INPUT_CLASSES =
  'w-full h-[42px] px-[0.85rem] text-sm font-[inherit] text-text-primary bg-bg-secondary border-[1.5px] border-zinc-800 rounded-md outline-none transition-colors duration-150 box-border leading-[40px] overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden placeholder:text-gray-400 focus:outline-none focus:border-zinc-800 focus:shadow-none [@media(pointer:coarse)]:min-h-11';

export const ListaEsperaDrawer: React.FC<ListaEsperaDrawerProps> = ({
  isOpen,
  tenantId,
  currentDateIso,
  professionals,
  services,
  onClose,
  onEncaixar,
  onDateChange,
  esperaRepo,
}) => {
  const repo = esperaRepo || new EsperaRepository(new SupabaseEsperaAdapter());

  const [activeDate, setActiveDate] = useState<string>(currentDateIso);
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(true);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

  useEffect(() => {
    setActiveDate(currentDateIso);
  }, [currentDateIso]);

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
      const data = await repo.listByDate(tenantId, activeDate);
      setEntries(data);
    } catch (err) {
      console.error('Erro ao carregar lista de espera:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, activeDate, repo]);

  useEffect(() => {
    if (isOpen) {
      fetchEntries();
    }
  }, [isOpen, fetchEntries]);

  // Trava o scroll da página de fundo quando o drawer estiver aberto
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // Auto-formatação de telefone brasileiro (11) 99999-9999
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (val.length > 10) {
      val = val.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (val.length > 6) {
      val = val.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    } else if (val.length > 2) {
      val = val.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    } else if (val.length > 0) {
      val = val.replace(/^(\d*)$/, '($1');
    }
    setCustomerPhone(val);
  };

  if (!isOpen) return null;

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerName.trim()) {
      setErrorMsg('Por favor, informe o nome do cliente para continuar.');
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
    if (!entry.customer_phone) return;
    openWhatsApp(
      entry.customer_phone,
      `Olá ${entry.customer_name}! Temos uma vaga disponível para você na barbearia agora. Deseja confirmar seu encaixe?`
    );
  };

  const aguardandoEntries = entries.filter((e) => e.status === 'aguardando');
  const finalizadasEntries = entries.filter((e) => e.status !== 'aguardando');

  return (
    <>
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[1055] animate-fade-in overscroll-contain touch-none"
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-bg-secondary border-l border-border shadow-[-4px_0_24px_rgba(0,0,0,0.12)] z-[1060] flex flex-col font-base text-text-primary animate-slide-in-right box-border overflow-hidden overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-espera-title"
      >
        {/* 1. Header idêntico ao mockup */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-bg-secondary shrink-0 box-border w-full">
          <h3 id="drawer-espera-title" className="text-xl font-bold text-text-primary m-0 tracking-[-0.01em]">
            Fila de espera da barbearia
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-md border-none bg-transparent text-text-primary inline-flex items-center justify-center cursor-pointer transition-colors duration-150 outline-none hover:bg-black/5 focus:outline-none focus-visible:outline-none"
            aria-label="Fechar"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {/* 2. Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 flex flex-col gap-[0.85rem] bg-bg-secondary box-border w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden overscroll-contain">
          {/* Card: Data da fila */}
          <div className="relative z-20 flex items-center justify-between gap-3 py-[0.85rem] px-5 bg-bg-secondary border-[1.5px] border-zinc-800 rounded-lg box-border">
            <label htmlFor="drawer-date-input" className="text-[0.925rem] font-bold text-text-primary">
              Data da fila:
            </label>
            <div
              className="relative inline-flex items-center gap-2 py-[0.45rem] px-[0.85rem] border-[1.5px] border-zinc-800 rounded-md bg-transparent cursor-pointer box-border h-[38px] select-none transition-colors duration-150 hover:bg-black/[0.04] focus:outline-none focus-visible:outline-none focus-within:outline-none"
              onClick={() => setIsDatePickerOpen((prev) => !prev)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsDatePickerOpen((prev) => !prev);
                }
              }}
              title="Escolher data na agenda"
              aria-label="Escolher data na agenda"
              aria-expanded={isDatePickerOpen}
            >
              <span className="text-sm font-bold text-text-primary tracking-[0.02em] pointer-events-none select-none">
                {formatDateDisplay(activeDate)}
              </span>
              <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-text-primary pointer-events-none shrink-0" />

              <input
                id="drawer-date-input"
                type="date"
                value={activeDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setActiveDate(newDate);
                  onDateChange?.(newDate);
                }}
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none border-none bg-transparent p-0 m-0"
                aria-label="Data da fila:"
                tabIndex={-1}
                aria-hidden="true"
              />

              {isDatePickerOpen && (
                <CustomDatePicker
                  selectedDate={activeDate}
                  timezone="America/Sao_Paulo"
                  onSelectDate={(newDate) => {
                    setActiveDate(newDate);
                    onDateChange?.(newDate);
                    setIsDatePickerOpen(false);
                  }}
                  onClose={() => setIsDatePickerOpen(false)}
                  position="right"
                />
              )}
            </div>
          </div>

          {/* Card: Formulário Novo Cliente na Fila */}
          {showAddForm ? (
            <form
              onSubmit={handleAddSubmit}
              className="p-5 rounded-[14px] bg-bg-secondary border-[1.5px] border-zinc-800 flex flex-col gap-[0.85rem] box-border"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[0.825rem] font-extrabold uppercase tracking-[0.02em] text-text-primary">
                  NOVO CLIENTE NA FILA
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="bg-transparent border-[1.5px] border-zinc-800 rounded-[6px] py-1 px-[0.85rem] text-text-primary text-[0.8rem] font-semibold cursor-pointer transition-colors duration-150 hover:bg-black/5 focus:outline-none focus-visible:outline-none [@media(pointer:coarse)]:min-h-11"
                >
                  Cancelar
                </button>
              </div>

              {errorMsg && (
                <div
                  className="py-[0.6rem] px-[0.85rem] rounded-md bg-error-bg border border-error text-error text-[0.8rem] font-semibold"
                  role="alert"
                >
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col gap-[0.35rem] flex-1 min-w-0">
                <label
                  htmlFor="espera-nome"
                  className="text-xs font-extrabold text-text-primary uppercase tracking-[0.02em] leading-[1.25] min-h-[1.25em] whitespace-nowrap overflow-hidden text-ellipsis block"
                >
                  NOME DO CLIENTE *
                </label>
                <input
                  id="espera-nome"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Pedro Henrique"
                  className={INPUT_CLASSES}
                  required
                />
              </div>

              <div className="flex flex-col gap-[0.35rem] flex-1 min-w-0">
                <label
                  htmlFor="espera-telefone"
                  className="text-xs font-extrabold text-text-primary uppercase tracking-[0.02em] leading-[1.25] min-h-[1.25em] whitespace-nowrap overflow-hidden text-ellipsis block"
                >
                  WHATSAPP OU CELULAR
                </label>
                <input
                  id="espera-telefone"
                  type="tel"
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  placeholder="(11) 99999-9999"
                  className={INPUT_CLASSES}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-start max-[420px]:grid-cols-1">
                <div className="flex flex-col gap-[0.35rem] flex-1 min-w-0">
                  <Select
                    label="Profissional"
                    id="espera-prof"
                    value={profId}
                    onChange={(e) => setProfId(e.target.value)}
                  >
                    <option value="">Qualquer barbeiro disponível</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-[0.35rem] flex-1 min-w-0">
                  <Select
                    label="Serviço"
                    id="espera-servico"
                    value={servId}
                    onChange={(e) => setServId(e.target.value)}
                  >
                    <option value="">Selecione um serviço...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (R$ {s.price.toFixed(2)})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-[0.35rem] flex-1 min-w-0">
                <label
                  htmlFor="espera-obs"
                  className="text-xs font-extrabold text-text-primary uppercase tracking-[0.02em] leading-[1.25] min-h-[1.25em] whitespace-nowrap overflow-hidden text-ellipsis block"
                >
                  OBSERVAÇÕES
                </label>
                <input
                  id="espera-obs"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Chegou com pressa, ligar se liberar"
                  className={INPUT_CLASSES}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-[0.35rem] w-full py-[0.8rem] px-4 rounded-md border-none bg-[#EAA96B] text-[#18181b] text-sm font-extrabold cursor-pointer inline-flex items-center justify-center gap-2 transition-colors duration-150 enabled:hover:bg-[#df9e60] enabled:active:scale-[0.99] disabled:opacity-65 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-800 focus-visible:outline-offset-2 [@media(pointer:coarse)]:min-h-11"
              >
                {isSubmitting ? (
                  <span>Salvando...</span>
                ) : (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                      className="shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Adicionar à fila de espera</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full py-[0.85rem] px-4 border-[1.5px] border-zinc-800 rounded-xl bg-transparent text-text-primary text-[0.85rem] font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors duration-150 box-border hover:bg-black/[0.04] focus:outline-none focus-visible:outline-none [@media(pointer:coarse)]:min-h-11"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} />
              <span>Novo cliente na fila</span>
            </button>
          )}

          {/* Seção: Aguardando na Casa */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[0.85rem] font-extrabold uppercase tracking-[0.02em] text-text-primary mt-2 mb-0">
              AGUARDANDO NA CASA ({aguardandoEntries.length})
            </h4>

            {loading ? (
              <div className="py-9 px-6 text-center text-sm text-zinc-600 bg-bg-secondary rounded-[14px] border-[1.5px] border-zinc-800 font-medium">
                Carregando lista...
              </div>
            ) : aguardandoEntries.length === 0 ? (
              <div className="py-9 px-6 text-center text-sm text-zinc-600 bg-bg-secondary rounded-[14px] border-[1.5px] border-zinc-800 font-medium">
                Nenhum cliente na fila de espera hoje.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {aguardandoEntries.map((entry, idx) => {
                  const prof = professionals.find((p) => p.id === entry.professional_id);
                  const serv = services.find((s) => s.id === entry.service_id);
                  const createdTime = entry.created_at
                    ? new Date(entry.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '--:--';

                  return (
                    <div
                      key={entry.id}
                      className="p-[1.15rem] rounded-lg bg-bg-secondary border-[1.5px] border-zinc-800 flex flex-col gap-[0.65rem]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-[0.65rem]">
                          <span className="w-[26px] h-[26px] rounded-full bg-zinc-800 text-white text-xs font-extrabold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <div>
                            <strong className="block text-sm font-bold text-text-primary">{entry.customer_name}</strong>
                            {entry.customer_phone && (
                              <span className="block text-xs text-zinc-500">{entry.customer_phone}</span>
                            )}
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500">
                          <HugeiconsIcon icon={Clock01Icon} size={13} />
                          <span>{createdTime}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-[0.4rem]">
                        {serv && (
                          <span className="text-[0.7rem] font-bold py-1 px-[0.55rem] rounded-[6px] bg-brand-lightest text-brand-deep">
                            {serv.name}
                          </span>
                        )}
                        <span className="text-[0.7rem] font-bold py-1 px-[0.55rem] rounded-[6px] bg-bg-secondary text-text-secondary border border-border">
                          {prof ? `Pref: ${prof.name}` : 'Qualquer barbeiro'}
                        </span>
                      </div>

                      {entry.notes && (
                        <p className="text-[0.775rem] italic text-zinc-500 m-0">"{entry.notes}"</p>
                      )}

                      <div className="flex items-center gap-2 pt-[0.35rem]">
                        {entry.customer_phone && (
                          <button
                            type="button"
                            onClick={() => handleNotifyWhatsApp(entry)}
                            className="py-[0.45rem] px-3 rounded-[6px] border-[1.5px] border-success bg-success-bg text-success text-xs font-bold inline-flex items-center gap-[0.3rem] cursor-pointer [@media(pointer:coarse)]:min-h-11"
                            title="Avisar no WhatsApp que a vez chegou"
                          >
                            <HugeiconsIcon icon={WhatsappIcon} size={14} />
                            <span>Avisar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStatusChange(entry.id, 'cancelado')}
                          className="py-[0.45rem] px-3 rounded-[6px] border-[1.5px] border-border bg-transparent text-error text-xs font-semibold inline-flex items-center gap-[0.3rem] cursor-pointer [@media(pointer:coarse)]:min-h-11"
                          title="Desistiu / Cancelar"
                        >
                          <HugeiconsIcon icon={Cancel01Icon} size={14} />
                          <span>Desistiu</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onEncaixar(entry)}
                          className="flex-1 py-[0.45rem] px-[0.85rem] rounded-[6px] border-none bg-[#EAA96B] text-[#18181b] text-xs font-extrabold inline-flex items-center justify-center gap-[0.35rem] cursor-pointer transition-colors duration-150 hover:bg-[#df9e60] [@media(pointer:coarse)]:min-h-11"
                          title="Puxar para a cadeira"
                          aria-label="Puxar para a cadeira"
                        >
                          <HugeiconsIcon icon={PlusSignIcon} size={14} />
                          <span>Puxar para a cadeira</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção Finalizados (Histórico) */}
          {finalizadasEntries.length > 0 && (
            <div className="flex flex-col gap-3">
              <h4 className="text-[0.85rem] font-extrabold uppercase tracking-[0.02em] text-text-primary mt-2 mb-0">
                HISTÓRICO DE HOJE ({finalizadasEntries.length})
              </h4>
              <div className="flex flex-col gap-3">
                {finalizadasEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="py-[0.85rem] px-4 rounded-md bg-bg-secondary border-[1.5px] border-zinc-800 opacity-80"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[0.85rem] font-semibold text-text-primary">{entry.customer_name}</span>
                      <span
                        className={`text-[0.7rem] font-bold py-[0.2rem] px-2 rounded-[4px] uppercase ${
                          entry.status === 'atendido'
                            ? 'bg-success-bg text-success'
                            : 'bg-error-bg text-error'
                        }`}
                      >
                        {entry.status === 'atendido' ? 'Encaixado' : 'Cancelado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
