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
      <div className="drawer-backdrop" onClick={onClose} />
      <div
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-espera-title"
      >
        {/* 1. Header idêntico ao mockup */}
        <div className="drawer-header">
          <h3 id="drawer-espera-title" className="drawer-title">
            Fila de espera da barbearia
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="drawer-close-btn"
            aria-label="Fechar"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {/* 2. Content */}
        <div className="drawer-body">
          {/* Card: Data da fila */}
          <div className="drawer-date-card">
            <label htmlFor="drawer-date-input" className="drawer-date-label">
              Data da fila:
            </label>
            <div
              className="drawer-date-picker-box"
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
              <span className="drawer-date-text">{formatDateDisplay(activeDate)}</span>
              <HugeiconsIcon icon={Calendar03Icon} size={16} className="drawer-date-icon" />

              <input
                id="drawer-date-input"
                type="date"
                value={activeDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setActiveDate(newDate);
                  onDateChange?.(newDate);
                }}
                className="drawer-date-native-input"
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
            <form onSubmit={handleAddSubmit} className="espera-add-card">
              <div className="espera-card-header">
                <span className="espera-card-title">NOVO CLIENTE NA FILA</span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="espera-btn-cancelar"
                >
                  Cancelar
                </button>
              </div>

              {errorMsg && (
                <div className="espera-error-alert" role="alert">
                  {errorMsg}
                </div>
              )}

              <div className="espera-form-field">
                <label htmlFor="espera-nome" className="espera-label">
                  NOME DO CLIENTE *
                </label>
                <input
                  id="espera-nome"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Pedro Henrique"
                  className="espera-input"
                  required
                />
              </div>

              <div className="espera-form-field">
                <label htmlFor="espera-telefone" className="espera-label">
                  WHATSAPP OU CELULAR
                </label>
                <input
                  id="espera-telefone"
                  type="tel"
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  placeholder="(11) 99999-9999"
                  className="espera-input"
                />
              </div>

              <div className="espera-form-grid-2">
                <div className="espera-form-field">
                  <label htmlFor="espera-prof" className="espera-label">
                    PROFISSIONAL
                  </label>
                  <select
                    id="espera-prof"
                    value={profId}
                    onChange={(e) => setProfId(e.target.value)}
                    className="espera-select"
                  >
                    <option value="">Qualquer barbeiro disponível</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="espera-form-field">
                  <label htmlFor="espera-servico" className="espera-label">
                    SERVIÇO
                  </label>
                  <select
                    id="espera-servico"
                    value={servId}
                    onChange={(e) => setServId(e.target.value)}
                    className="espera-select"
                  >
                    <option value="">Selecione um serviço...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (R$ {s.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="espera-form-field">
                <label htmlFor="espera-obs" className="espera-label">
                  OBSERVAÇÕES
                </label>
                <input
                  id="espera-obs"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Chegou com pressa, ligar se liberar"
                  className="espera-input"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="espera-btn-submit"
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
                      className="espera-check-icon"
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
              className="btn-add-espera-reopen"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} />
              <span>Novo cliente na fila</span>
            </button>
          )}

          {/* Seção: Aguardando na Casa */}
          <div className="espera-section">
            <h4 className="espera-section-heading">
              AGUARDANDO NA CASA ({aguardandoEntries.length})
            </h4>

            {loading ? (
              <div className="espera-empty-card">Carregando lista...</div>
            ) : aguardandoEntries.length === 0 ? (
              <div className="espera-empty-card">
                Nenhum cliente na fila de espera hoje.
              </div>
            ) : (
              <div className="espera-cards-list">
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
                    <div key={entry.id} className="espera-entry-card">
                      <div className="espera-card-top">
                        <div className="espera-client-info">
                          <span className="espera-pos-badge">#{idx + 1}</span>
                          <div>
                            <strong className="espera-client-name">{entry.customer_name}</strong>
                            {entry.customer_phone && (
                              <span className="espera-client-phone">{entry.customer_phone}</span>
                            )}
                          </div>
                        </div>

                        <div className="espera-time-tag">
                          <HugeiconsIcon icon={Clock01Icon} size={13} />
                          <span>{createdTime}</span>
                        </div>
                      </div>

                      <div className="espera-card-meta">
                        {serv && (
                          <span className="espera-meta-tag espera-meta-service">
                            {serv.name}
                          </span>
                        )}
                        <span className="espera-meta-tag espera-meta-prof">
                          {prof ? `Pref: ${prof.name}` : 'Qualquer barbeiro'}
                        </span>
                      </div>

                      {entry.notes && (
                        <p className="espera-card-notes">"{entry.notes}"</p>
                      )}

                      <div className="espera-card-actions">
                        {entry.customer_phone && (
                          <button
                            type="button"
                            onClick={() => handleNotifyWhatsApp(entry)}
                            className="espera-action-whatsapp"
                            title="Avisar no WhatsApp que a vez chegou"
                          >
                            <HugeiconsIcon icon={WhatsappIcon} size={14} />
                            <span>Avisar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStatusChange(entry.id, 'cancelado')}
                          className="espera-action-cancel"
                          title="Desistiu / Cancelar"
                        >
                          <HugeiconsIcon icon={Cancel01Icon} size={14} />
                          <span>Desistiu</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onEncaixar(entry)}
                          className="espera-action-encaixar"
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
            <div className="espera-section">
              <h4 className="espera-section-heading">
                HISTÓRICO DE HOJE ({finalizadasEntries.length})
              </h4>
              <div className="espera-cards-list">
                {finalizadasEntries.map((entry) => (
                  <div key={entry.id} className="espera-card-history">
                    <div className="flex-between">
                      <span className="history-client-name">{entry.customer_name}</span>
                      <span
                        className={`history-status-badge ${
                          entry.status === 'atendido' ? 'history-status-done' : 'history-status-canceled'
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

      <style>{`
        .drawer-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 1055;
          animation: fadeIn 0.2s cubic-bezier(0.32, 0.72, 0, 1);
          overscroll-behavior: contain;
          touch-action: none;
        }

        .drawer-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-width: 480px;
          background-color: var(--color-bg-secondary, #FFFFFF);
          border-left: 1px solid var(--color-border, #EADED6);
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
          z-index: 1060;
          display: flex;
          flex-direction: column;
          font-family: var(--font-family-base, 'Outfit', sans-serif);
          color: var(--color-text-primary, #18181b);
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
          overflow: hidden;
          overscroll-behavior: contain;
        }

        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* 1. Header */
        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border, #E5E7EB);
          background-color: var(--color-bg-secondary, #FFFFFF);
          flex-shrink: 0;
          box-sizing: border-box;
          width: 100%;
        }

        .drawer-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text-primary, #18181b);
          margin: 0;
          letter-spacing: -0.01em;
        }

        .drawer-close-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--color-text-primary, #18181b);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease;
          outline: none;
        }

        .drawer-close-btn:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .drawer-close-btn:focus,
        .drawer-close-btn:focus-visible {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* 2. Body */
        .drawer-body {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          background-color: var(--color-bg-secondary, #FFFFFF);
          box-sizing: border-box;
          width: 100%;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE e Edge */
          overscroll-behavior: contain;
          overscroll-behavior-y: contain;
        }

        .drawer-body::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Edge */
          width: 0;
          height: 0;
        }

        /* 3. Card Data da Fila */
        .drawer-date-card {
          position: relative;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.85rem 1.25rem;
          background-color: var(--color-bg-secondary, #FFFFFF);
          border: 1.5px solid #27272a;
          border-radius: 12px;
          box-sizing: border-box;
        }

        .drawer-date-label {
          font-size: 0.925rem;
          font-weight: 700;
          color: var(--color-text-primary, #18181b);
        }

        .drawer-date-picker-box {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 0.85rem;
          border: 1.5px solid #27272a;
          border-radius: 8px;
          background-color: transparent;
          cursor: pointer;
          box-sizing: border-box;
          height: 38px;
          user-select: none;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .drawer-date-picker-box:hover {
          background-color: rgba(0, 0, 0, 0.04);
        }

        .dark-theme .drawer-date-picker-box:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .drawer-date-text {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--color-text-primary, #18181b);
          letter-spacing: 0.02em;
          pointer-events: none;
          user-select: none;
        }

        .drawer-date-icon {
          color: var(--color-text-primary, #18181b);
          pointer-events: none;
          flex-shrink: 0;
        }

        .drawer-date-native-input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          pointer-events: none;
          border: none;
          background: transparent;
          padding: 0;
          margin: 0;
        }

        .drawer-date-picker-box:focus,
        .drawer-date-picker-box:focus-visible,
        .drawer-date-picker-box:focus-within {
          outline: none !important;
          border-color: #27272a !important;
          box-shadow: none !important;
        }

        /* 4. Card Novo Cliente na Fila */
        .espera-add-card {
          padding: 1.25rem;
          border-radius: 14px;
          background-color: var(--color-bg-secondary, #FFFFFF);
          border: 1.5px solid #27272a;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          box-sizing: border-box;
        }

        .espera-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.25rem;
        }

        .espera-card-title {
          font-size: 0.825rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: var(--color-text-primary, #18181b);
        }

        .espera-btn-cancelar {
          background: transparent;
          border: 1.5px solid #27272a;
          border-radius: 6px;
          padding: 0.25rem 0.85rem;
          color: var(--color-text-primary, #18181b);
          font-size: 0.8rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .espera-btn-cancelar:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .espera-btn-cancelar:focus,
        .espera-btn-cancelar:focus-visible {
          outline: none !important;
          border-color: #27272a !important;
          box-shadow: none !important;
        }

        .btn-add-espera-reopen {
          width: 100%;
          padding: 0.85rem 1rem;
          border: 1.5px solid #27272a;
          border-radius: 12px;
          background: transparent;
          color: var(--color-text-primary, #18181b);
          font-size: 0.85rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: background-color 0.15s ease;
          box-sizing: border-box;
        }

        .btn-add-espera-reopen:hover {
          background-color: rgba(0, 0, 0, 0.04);
        }

        .btn-add-espera-reopen:focus,
        .btn-add-espera-reopen:focus-visible {
          outline: none !important;
          border-color: #27272a !important;
          box-shadow: none !important;
        }

        .espera-error-alert {
          padding: 0.6rem 0.85rem;
          border-radius: 8px;
          background-color: var(--color-error-bg, #FDE8E8);
          border: 1px solid var(--color-error, #F05252);
          color: var(--color-error, #F05252);
          font-size: 0.8rem;
          font-weight: 600;
        }

        .espera-form-field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          flex: 1;
          min-width: 0;
        }

        .espera-label {
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--color-text-primary, #18181b);
          text-transform: uppercase;
          letter-spacing: 0.02em;
          line-height: 1.25;
          min-height: 1.25em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }

        .espera-input,
        .espera-select {
          width: 100%;
          height: 42px;
          padding: 0 0.85rem;
          font-size: 0.875rem;
          font-family: inherit;
          color: var(--color-text-primary, #18181b);
          background-color: var(--color-bg-secondary, #FFFFFF);
          border: 1.5px solid #27272a;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.15s ease;
          box-sizing: border-box;
          line-height: 40px;
          overflow: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .espera-input::-webkit-scrollbar,
        .espera-select::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .espera-input::placeholder {
          color: #9CA3AF;
        }

        .espera-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2318181b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          background-size: 1rem;
          padding-right: 2.25rem;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Remove qualquer efeito de stroker / borda laranja ao clicar ou focar */
        .espera-input:focus,
        .espera-select:focus,
        .espera-input:focus-visible,
        .espera-select:focus-visible {
          outline: none !important;
          border-color: #27272a !important;
          box-shadow: none !important;
        }

        .espera-form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          align-items: start;
        }

        @media (max-width: 420px) {
          .espera-form-grid-2 {
            grid-template-columns: 1fr;
          }
        }

        /* 5. Botão Adicionar à Fila (Âmbar idêntico ao print) */
        .espera-btn-submit {
          margin-top: 0.35rem;
          width: 100%;
          padding: 0.8rem 1rem;
          border-radius: 8px;
          border: none;
          background-color: #EAA96B;
          color: #18181b;
          font-size: 0.875rem;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: background-color 0.15s ease, transform 0.05s ease;
        }

        .espera-btn-submit:hover:not(:disabled) {
          background-color: #df9e60;
        }

        .espera-btn-submit:active:not(:disabled) {
          transform: scale(0.99);
        }

        .espera-btn-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .espera-btn-submit:focus-visible {
          outline: 2px solid #27272a;
          outline-offset: 2px;
        }

        .espera-check-icon {
          flex-shrink: 0;
        }

        /* 6. Seção Aguardando na Casa */
        .espera-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .espera-section-heading {
          font-size: 0.85rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: var(--color-text-primary, #18181b);
          margin: 0.5rem 0 0 0;
        }

        .espera-empty-card {
          padding: 2.25rem 1.5rem;
          text-align: center;
          font-size: 0.875rem;
          color: #52525B;
          background-color: var(--color-bg-secondary, #FFFFFF);
          border-radius: 14px;
          border: 1.5px solid #27272a;
          font-weight: 500;
        }

        /* 7. Cards de Clientes na Fila */
        .espera-cards-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .espera-entry-card {
          padding: 1.15rem;
          border-radius: 12px;
          background-color: var(--color-bg-secondary, #FFFFFF);
          border: 1.5px solid #27272a;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .espera-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .espera-client-info {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }

        .espera-pos-badge {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background-color: #27272a;
          color: #FFFFFF;
          font-size: 0.75rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .espera-client-name {
          display: block;
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--color-text-primary, #18181b);
        }

        .espera-client-phone {
          display: block;
          font-size: 0.75rem;
          color: #71717A;
        }

        .espera-time-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #71717A;
        }

        .espera-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .espera-meta-tag {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.25rem 0.55rem;
          border-radius: 6px;
        }

        .espera-meta-service {
          background-color: var(--color-brand-lightest, #FFF1E6);
          color: var(--color-brand-deep, #6A2E00);
        }

        .espera-meta-prof {
          background-color: var(--color-bg-secondary, #FFFFFF);
          color: var(--color-text-secondary, #70625B);
          border: 1px solid var(--color-border, #EADED6);
        }

        .espera-card-notes {
          font-size: 0.775rem;
          font-style: italic;
          color: #71717A;
          margin: 0;
        }

        .espera-card-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-top: 0.35rem;
        }

        .espera-action-whatsapp {
          padding: 0.45rem 0.75rem;
          border-radius: 6px;
          border: 1.5px solid var(--color-success, #0E9F6E);
          background-color: var(--color-success-bg, #E6F4EA);
          color: var(--color-success, #0E9F6E);
          font-size: 0.75rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          cursor: pointer;
        }

        .espera-action-cancel {
          padding: 0.45rem 0.75rem;
          border-radius: 6px;
          border: 1.5px solid var(--color-border, #EADED6);
          background-color: transparent;
          color: var(--color-error, #F05252);
          font-size: 0.75rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          cursor: pointer;
        }

        .espera-action-encaixar {
          flex: 1;
          padding: 0.45rem 0.85rem;
          border-radius: 6px;
          border: none;
          background-color: #EAA96B;
          color: #18181b;
          font-size: 0.75rem;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .espera-action-encaixar:hover {
          background-color: #df9e60;
        }

        .espera-card-history {
          padding: 0.85rem 1rem;
          border-radius: 8px;
          background-color: var(--color-bg-secondary, #FFFFFF);
          border: 1.5px solid #27272a;
          opacity: 0.8;
        }

        .flex-between {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .history-client-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-text-primary, #18181b);
        }

        .history-status-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .history-status-done {
          background-color: var(--color-success-bg, #E6F4EA);
          color: var(--color-success, #0E9F6E);
        }

        .history-status-canceled {
          background-color: var(--color-error-bg, #FDE8E8);
          color: var(--color-error, #F05252);
        }

        /* 8. Suporte ao Modo Escuro */
        .dark-theme .drawer-panel,
        .dark-theme .drawer-header,
        .dark-theme .drawer-body {
          background-color: #18181B;
          color: #F4F4F5;
        }

        .dark-theme .drawer-date-card,
        .dark-theme .espera-add-card,
        .dark-theme .espera-empty-card,
        .dark-theme .espera-entry-card,
        .dark-theme .espera-card-history {
          background-color: #1F1F23;
          border-color: #3F3F46;
        }

        .dark-theme .drawer-title,
        .dark-theme .drawer-date-label,
        .dark-theme .drawer-date-input,
        .dark-theme .espera-card-title,
        .dark-theme .espera-btn-cancelar,
        .dark-theme .espera-label,
        .dark-theme .espera-input,
        .dark-theme .espera-select,
        .dark-theme .espera-section-heading,
        .dark-theme .espera-client-name,
        .dark-theme .history-client-name,
        .dark-theme .btn-add-espera-reopen {
          color: #F4F4F5;
        }

        .dark-theme .drawer-close-btn {
          color: #F4F4F5;
        }

        .dark-theme .drawer-date-input,
        .dark-theme .drawer-date-picker-box,
        .dark-theme .espera-input,
        .dark-theme .espera-select,
        .dark-theme .espera-btn-cancelar,
        .dark-theme .btn-add-espera-reopen {
          border-color: #3F3F46;
          background-color: #1F1F23;
        }

        .dark-theme .drawer-date-text,
        .dark-theme .drawer-date-icon {
          color: #F4F4F5;
        }

        .dark-theme .espera-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23F4F4F5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        }

        .dark-theme .drawer-date-input::-webkit-calendar-picker-indicator {
          filter: invert(0.9);
        }

        .dark-theme .espera-empty-card {
          color: #A1A1AA;
        }

        /* 9. Acessibilidade Mobile e Touch Target */
        @media (pointer: coarse) {
          .drawer-close-btn,
          .espera-btn-cancelar,
          .espera-btn-submit,
          .btn-add-espera-reopen,
          .espera-action-encaixar,
          .espera-action-cancel,
          .espera-action-whatsapp {
            min-height: 44px;
          }
          .drawer-date-input,
          .espera-input,
          .espera-select {
            min-height: 44px;
          }
        }
      `}</style>
    </>
  );
};
