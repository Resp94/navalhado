import React, { useState, useEffect, useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  PlusSignIcon,
  WhatsappIcon,
} from '@hugeicons/core-free-icons';
import { EsperaRepository } from '../../modules/espera/EsperaRepository';
import { SupabaseEsperaAdapter } from '../../modules/espera/adapters/SupabaseEsperaAdapter';
import type { WaitingListEntry } from '../../modules/espera/types';
import { openWhatsApp } from '../../lib/whatsapp';

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
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

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
        {/* Header */}
        <div className="drawer-header">
          <div>
            <h3 id="drawer-espera-title" className="drawer-title">
              Fila de espera da barbearia
            </h3>
            <p className="drawer-subtitle">
              {aguardandoEntries.length} cliente(s) aguardando atendimento
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="drawer-close-btn"
            aria-label="Fechar"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="drawer-body">
          {/* Seletor de Data */}
          <div className="drawer-date-bar">
            <label htmlFor="drawer-date-input" className="drawer-date-label">
              Data da fila:
            </label>
            <input
              id="drawer-date-input"
              type="date"
              value={activeDate}
              onChange={(e) => {
                const newDate = e.target.value;
                setActiveDate(newDate);
                onDateChange?.(newDate);
              }}
              className="drawer-date-input"
            />
          </div>

          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="btn-add-espera"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} />
              <span>Adicionar cliente na fila</span>
            </button>
          ) : (
            <form onSubmit={handleAddSubmit} className="espera-add-form">
              <div className="espera-form-header">
                <h4 className="espera-form-title">Novo cliente na fila</h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="espera-btn-cancel-link"
                >
                  Cancelar
                </button>
              </div>

              {errorMsg && (
                <div className="espera-error-alert">
                  {errorMsg}
                </div>
              )}

              <div className="espera-form-group">
                <label className="espera-label">
                  Nome do cliente *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex: Pedro Henrique"
                  className="espera-input"
                  required
                />
              </div>

              <div className="espera-form-group">
                <label className="espera-label">
                  WhatsApp ou celular
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="espera-input"
                />
              </div>

              <div className="espera-form-row">
                <div className="espera-form-group">
                  <label className="espera-label">
                    Profissional de preferência
                  </label>
                  <select
                    value={profId}
                    onChange={(e) => setProfId(e.target.value)}
                    className="espera-select"
                  >
                    <option value="">Qualquer barbeiro (rodízio do balcão)</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="espera-form-group">
                  <label className="espera-label">
                    Serviço
                  </label>
                  <select
                    value={servId}
                    onChange={(e) => setServId(e.target.value)}
                    className="espera-select"
                  >
                    <option value="">Selecione o serviço...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (R$ {s.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="espera-form-group">
                <label className="espera-label">
                  Observações
                </label>
                <input
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
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} />
                    <span>Adicionar à fila de espera</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Seção Fila Ativa */}
          <div className="espera-section">
            <h4 className="espera-section-title">
              Aguardando na casa ({aguardandoEntries.length})
            </h4>

            {loading ? (
              <div className="espera-loading">Carregando lista...</div>
            ) : aguardandoEntries.length === 0 ? (
              <div className="espera-empty">
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
                    <div key={entry.id} className="espera-card">
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

          {/* Seção Finalizados */}
          {finalizadasEntries.length > 0 && (
            <div className="espera-section">
              <h4 className="espera-section-title">
                Histórico de Hoje ({finalizadasEntries.length})
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
          background-color: rgba(20, 17, 15, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 1055;
          animation: fadeIn 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .drawer-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-width: 440px;
          background-color: var(--color-bg-secondary);
          border-left: 1px solid var(--color-border);
          box-shadow: var(--shadow-xl);
          z-index: 1060;
          display: flex;
          flex-direction: column;
          font-family: var(--font-family-base);
          color: var(--color-text-primary);
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
        }

        .drawer-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .drawer-icon-badge {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .drawer-title {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .drawer-subtitle {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0.2rem 0 0 0;
        }

        .drawer-close-btn {
          min-width: 44px;
          min-height: 44px;
          border-radius: var(--radius-full);
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .drawer-close-btn:hover {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }

        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .drawer-date-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.65rem 0.85rem;
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
        }

        .drawer-date-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .drawer-date-input {
          padding: 0.4rem 0.65rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          outline: none;
        }

        .drawer-date-input:focus {
          border-color: var(--color-brand-primary);
        }

        .btn-add-espera {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1.5px dashed var(--color-brand-primary);
          border-radius: var(--radius-lg);
          background: transparent;
          color: var(--color-brand-primary);
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-add-espera:hover {
          background-color: var(--color-brand-lightest);
        }

        .espera-add-form {
          padding: 1rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .espera-form-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .espera-form-title {
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
          color: var(--color-text-primary);
          margin: 0;
        }

        .espera-btn-cancel-link {
          background: none;
          border: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          cursor: pointer;
        }

        .espera-btn-cancel-link:hover {
          color: var(--color-text-primary);
        }

        .espera-error-alert {
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-sm);
          background-color: var(--color-error-bg);
          border: 1px solid var(--color-error);
          color: var(--color-error);
          font-size: var(--font-size-xs);
          font-weight: 600;
        }

        .espera-form-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          flex: 1;
        }

        .espera-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
        }

        .espera-input,
        .espera-select {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: var(--font-size-xs);
          color: var(--color-text-primary);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          outline: none;
          transition: all 0.2s ease;
        }

        .espera-input:focus,
        .espera-select:focus {
          border-color: var(--color-brand-primary);
        }

        .espera-form-row {
          display: flex;
          gap: 0.5rem;
        }

        .espera-btn-submit {
          margin-top: 0.25rem;
          padding: 0.6rem 1rem;
          border-radius: var(--radius-md);
          border: none;
          background-color: var(--color-brand-primary);
          color: white;
          font-size: var(--font-size-xs);
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          transition: all 0.2s ease;
        }

        .espera-btn-submit:hover:not(:disabled) {
          background-color: var(--color-brand-hover);
        }

        .espera-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .espera-section-title {
          font-size: var(--font-size-xs);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .espera-empty,
        .espera-loading {
          padding: 1.5rem;
          text-align: center;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          background-color: var(--color-bg-primary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
        }

        .espera-cards-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .espera-card {
          padding: 1rem;
          border-radius: var(--radius-lg);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          box-shadow: var(--shadow-sm);
        }

        .espera-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .espera-client-info {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .espera-pos-badge {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-full);
          background-color: var(--color-brand-primary);
          color: white;
          font-size: 0.7rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .espera-client-name {
          display: block;
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .espera-client-phone {
          display: block;
          font-size: 0.7rem;
          color: var(--color-text-secondary);
        }

        .espera-time-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .espera-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .espera-meta-tag {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-sm);
        }

        .espera-meta-service {
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-deep);
        }

        .espera-meta-prof {
          background-color: var(--color-bg-secondary);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border);
        }

        .espera-card-notes {
          font-size: 0.75rem;
          font-style: italic;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .espera-card-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-top: 0.25rem;
        }

        .espera-action-whatsapp {
          padding: 0.4rem 0.65rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-success);
          background-color: var(--color-success-bg);
          color: var(--color-success);
          font-size: 0.7rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
        }

        .espera-action-cancel {
          padding: 0.4rem 0.65rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
          color: var(--color-error);
          font-size: 0.7rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
        }

        .espera-action-encaixar {
          flex: 1;
          padding: 0.4rem 0.75rem;
          border-radius: var(--radius-md);
          border: none;
          background-color: var(--color-brand-primary);
          color: white;
          font-size: 0.7rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          cursor: pointer;
        }

        .espera-action-encaixar:hover {
          background-color: var(--color-brand-hover);
        }

        .espera-card-history {
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          opacity: 0.75;
        }

        .flex-between {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .history-client-name {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .history-status-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.15rem 0.4rem;
          border-radius: var(--radius-sm);
          text-transform: uppercase;
        }

        .history-status-done {
          background-color: var(--color-success-bg);
          color: var(--color-success);
        }

        .history-status-canceled {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }
      `}</style>
    </>
  );
};
