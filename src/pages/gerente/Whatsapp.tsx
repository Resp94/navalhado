import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

interface EvolutionInstance {
  id: string;
  tenant_id: string;
  instance_name: string;
  qr_code: string | null;
  status: 'connected' | 'disconnected' | 'pairing';
  send_confirmation: boolean;
  send_reminders: boolean;
  reminder_hours: number;
  send_cancellation: boolean;
}

type EvolutionSetting =
  | 'send_confirmation'
  | 'send_reminders'
  | 'reminder_hours'
  | 'send_cancellation';

const EVOLUTION_INSTANCE_COLUMNS =
  'id, tenant_id, instance_name, qr_code, status, send_confirmation, send_reminders, reminder_hours, send_cancellation';

const toEvolutionInstance = (row: Record<string, any>): EvolutionInstance => ({
  id: row.id,
  tenant_id: row.tenant_id,
  instance_name: row.instance_name,
  qr_code: row.qr_code,
  status: row.status,
  send_confirmation: row.send_confirmation,
  send_reminders: row.send_reminders,
  reminder_hours: row.reminder_hours,
  send_cancellation: row.send_cancellation,
});

const formatHoursToReadable = (hours: number): string =>
  `${hours} ${hours === 1 ? 'hora' : 'horas'}`;

export const Whatsapp: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const [instance, setInstance] = useState<EvolutionInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste do sistema Navalhado.');

  useEffect(() => {
    const fetchInstance = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('evolution_api_instances')
          .select(EVOLUTION_INSTANCE_COLUMNS)
          .eq('tenant_id', tenant.tenantId)
          .maybeSingle();

        if (error) throw error;
        setInstance(data ? toEvolutionInstance(data) : null);
      } catch (error) {
        console.error('Error fetching whatsapp instance:', error);
        addToast('Não foi possível carregar o status do WhatsApp.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchInstance();

    const channel = supabase
      .channel(`evolution_api_instances:${tenant.tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'evolution_api_instances',
          filter: `tenant_id=eq.${tenant.tenantId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setInstance(null);
            return;
          }

          setInstance(toEvolutionInstance(payload.new));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addToast, tenant.tenantId]);

  useGSAP(() => {
    if (!loading) {
      gsap.fromTo('.card-whatsapp', 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'cubic-bezier(0.32, 0.72, 0, 1)' }
      );
      gsap.fromTo('.rule-row', 
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, delay: 0.35, ease: 'cubic-bezier(0.32, 0.72, 0, 1)' }
      );
    }
  }, [loading]);

  const handleCreateInstance = async () => {
    try {
      setActionLoading(true);
      const cleanName = tenant.tenantName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 15);
      
      const instanceName = `nav_${cleanName}_${Math.floor(1000 + Math.random() * 9000)}`;
      const apiKey = `key_${crypto.randomUUID().substring(0, 18)}`;

      const { data, error } = await supabase
        .from('evolution_api_instances')
        .insert([
          {
            tenant_id: tenant.tenantId,
            instance_name: instanceName,
            api_key: apiKey,
            status: 'disconnected',
            qr_code: null
          }
        ])
        .select(EVOLUTION_INSTANCE_COLUMNS)
        .single();

      if (error) throw error;
      setInstance(toEvolutionInstance(data));
      addToast('Instância criada com sucesso! Conecte seu celular.', 'success');
    } catch (error: any) {
      console.error('Error creating instance:', error);
      addToast('Erro ao inicializar o WhatsApp da barbearia.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!instance) return;
    try {
      setActionLoading(true);
      
      const { data, error } = await supabase
        .from('evolution_api_instances')
        .update({
          status: 'pairing',
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', instance.id)
        .select(EVOLUTION_INSTANCE_COLUMNS)
        .single();

      if (error) throw error;
      setInstance(toEvolutionInstance(data));
      addToast('Solicitação de QR Code enviada. Aguarde a geração.', 'info');

    } catch (error) {
      console.error('Error connecting whatsapp instance:', error);
      addToast('Erro ao solicitar conexão de WhatsApp.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!instance) return;
    try {
      setActionLoading(true);

      const { data, error } = await supabase
        .from('evolution_api_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', instance.id)
        .select(EVOLUTION_INSTANCE_COLUMNS)
        .single();

      if (error) throw error;
      setInstance(toEvolutionInstance(data));
      addToast('WhatsApp desconectado da barbearia.', 'warning');
    } catch (error) {
      console.error('Error disconnecting whatsapp instance:', error);
      addToast('Erro ao desconectar WhatsApp.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateConfig = async (
    key: EvolutionSetting,
    value: boolean | number
  ) => {
    if (!instance) return;

    try {
      const { data, error } = await supabase
        .from('evolution_api_instances')
        .update({
          [key]: value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', instance.id)
        .select(EVOLUTION_INSTANCE_COLUMNS)
        .single();

      if (error) throw error;
      setInstance(toEvolutionInstance(data));
      addToast('Configurações do WhatsApp atualizadas com sucesso!', 'success');
    } catch (error) {
      console.error('Error updating whatsapp config:', error);
      addToast('Erro ao atualizar configurações de disparo.', 'error');
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      addToast('Informe o número de telefone do destinatário.', 'warning');
      return;
    }

    try {
      setActionLoading(true);

      const { error } = await supabase.functions.invoke('whatsapp-integration/send-test', {
        body: {
          tenant_id: tenant.tenantId,
          number: testPhone,
          text: testMessage,
        },
      });

      if (error) throw error;

      addToast(`Mensagem de teste disparada com sucesso para ${testPhone}!`, 'success');
    } catch (error: any) {
      console.error('Error sending test message:', error);
      addToast(error?.message || 'Erro ao disparar mensagem de teste.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="whatsapp-page">
      <div className="whatsapp-header">
        <h2>Notificações de WhatsApp</h2>
        <p>Alerte seus clientes automaticamente sobre novos agendamentos, reagendamentos e lembretes de horários.</p>
      </div>

      {loading ? (
        <div className="card loading-state">
          <div className="spinner" style={{ borderColor: 'var(--color-brand-primary)', borderTopColor: 'transparent' }} />
          <p>Carregando status do serviço...</p>
        </div>
      ) : !instance ? (
        <div className="card empty-state">
          <div className="icon-badge">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <h4>WhatsApp desativado no momento</h4>
          <p>Para ativar os disparos automáticos e notificar seus clientes sobre horários agendados, ative a integração.</p>
          <button 
            onClick={handleCreateInstance} 
            disabled={actionLoading}
            className="btn btn--primary"
            style={{ marginTop: '1.5rem' }}
          >
            {actionLoading ? <div className="spinner spinner--sm" /> : 'Ativar Integração do WhatsApp'}
          </button>
        </div>
      ) : (
        <div className="whatsapp-grid">
          {/* ═══ Card: Status da Integração ═══ */}
          <div className="card-whatsapp">
            <div className="card-whatsapp__header">
              <div>
                <span className="card-whatsapp__eyebrow">Conexão</span>
                <h3 className="card-whatsapp__title">Status da Integração</h3>
              </div>
              <span className={`card-whatsapp__pill card-whatsapp__pill--${instance.status}`}>
                {instance.status === 'connected' && 'Conectado'}
                {instance.status === 'disconnected' && 'Desconectado'}
                {instance.status === 'pairing' && 'Pareando'}
              </span>
            </div>

            <div className="card-whatsapp__body">
              <div className="info-rows">
                <div className="info-row">
                  <span className="info-row__label">Instância</span>
                  <code className="info-row__value">{instance.instance_name}</code>
                </div>
                <div className="info-row">
                  <span className="info-row__label">API</span>
                  <span className="info-row__value info-row__value--green">Online</span>
                </div>
              </div>

              {instance.status === 'disconnected' && (
                <div className="card-whatsapp__actions">
                  <p className="helper-text">Inicie o pareamento para conectar o celular da barbearia.</p>
                  <button onClick={handleConnect} disabled={actionLoading} className="btn btn--primary">
                    {actionLoading ? <div className="spinner spinner--sm" /> : 'Gerar QR Code de Conexão'}
                  </button>
                </div>
              )}

              {instance.status === 'pairing' && (
                <div className="card-whatsapp__qr">
                  <p className="qr-label">Leia o QR Code abaixo</p>
                  <p className="qr-desc">Abra o WhatsApp no seu celular, vá em <strong>Aparelhos Conectados &gt; Conectar um Aparelho</strong> e aponte a câmera.</p>
                  <div className="qr-frame">
                    {instance.qr_code ? (
                      <img
                        src={instance.qr_code.startsWith('data:') ? instance.qr_code : `data:image/png;base64,${instance.qr_code}`}
                        alt="QR Code WhatsApp"
                      />
                    ) : (
                      <div className="qr-loading">
                        <div className="spinner spinner--qr" />
                        <span>Gerando código...</span>
                      </div>
                    )}
                  </div>
                  <button onClick={handleDisconnect} disabled={actionLoading} className="btn btn--outline-danger">
                    {actionLoading ? <div className="spinner spinner--sm" /> : 'Cancelar Pareamento'}
                  </button>
                </div>
              )}

              {instance.status === 'connected' && (
                <div className="card-whatsapp__success">
                  <div className="success-icon">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <path d="m9 11 3 3L22 4" />
                    </svg>
                  </div>
                  <p className="success-msg">Sistema pronto para enviar notificações!</p>
                  <button onClick={handleDisconnect} disabled={actionLoading} className="btn btn--outline-danger">
                    {actionLoading ? <div className="spinner spinner--sm" /> : 'Desconectar Aparelho'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Card: Configuração de Notificações ═══ */}
          <div className="card-whatsapp">
            <div className="card-whatsapp__header">
              <div>
                <span className="card-whatsapp__eyebrow">Notificações</span>
                <h3 className="card-whatsapp__title">Configuração de Disparos</h3>
              </div>
            </div>
            <div className="card-whatsapp__body">
              <div className="rules-list">
                <div className="rule-row">
                  <div className="rule-row__icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2z" />
                      <path d="M6 6V5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1" />
                      <path d="M6 6h12l1.5 11.5a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3L6 6z" />
                    </svg>
                  </div>
                  <div className="rule-row__content">
                    <label htmlFor="send-confirmation" className="rule-row__title">
                      Confirmação Automática
                    </label>
                    <span className="rule-row__desc">Envia o link de agendamento por WhatsApp assim que o cliente reserva.</span>
                  </div>
                  <label className="switch">
                    <input
                      id="send-confirmation"
                      type="checkbox"
                      checked={instance.send_confirmation}
                      onChange={(event) => handleUpdateConfig('send_confirmation', event.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>

                <div className="rule-row rule-row--reminder">
                  <div className="rule-row__main">
                    <div className="rule-row__icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="rule-row__content">
                      <label htmlFor="send-reminders" className="rule-row__title">
                        Lembretes de Agendamento
                      </label>
                      <span className="rule-row__desc">Envia lembrete com opção de cancelamento antes do horário.</span>
                    </div>
                    <label className="switch">
                      <input
                        id="send-reminders"
                        type="checkbox"
                        checked={instance.send_reminders}
                        onChange={(event) => handleUpdateConfig('send_reminders', event.target.checked)}
                      />
                      <span className="slider" />
                    </label>
                  </div>

                  <div className="reminder-settings">
                    <div className="reminder-settings__field">
                      <label htmlFor="reminder-hours" className="helper-text">
                        Tempo de antecedência do lembrete:
                      </label>
                      <select
                        id="reminder-hours"
                        aria-label="Tempo de antecedência do lembrete"
                        value={instance.reminder_hours}
                        onChange={(event) => handleUpdateConfig('reminder_hours', Number(event.target.value))}
                        disabled={!instance.send_reminders || actionLoading}
                        className="form-select"
                      >
                        {[1, 2, 3, 4, 6, 12, 24].map((hours) => (
                          <option key={hours} value={hours}>
                            {hours} {hours === 1 ? 'hora antes' : 'horas antes'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="reminder-settings__summary">
                      Lembrete enviado {formatHoursToReadable(instance.reminder_hours)} antes do agendamento
                    </span>
                  </div>
                </div>

                <div className="rule-row">
                  <div className="rule-row__icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <div className="rule-row__content">
                    <label htmlFor="send-cancellation" className="rule-row__title">
                      Alerta de Cancelamento
                    </label>
                    <span className="rule-row__desc">Notifica se o barbeiro ou cliente cancelar o agendamento.</span>
                  </div>
                  <label className="switch">
                    <input
                      id="send-cancellation"
                      type="checkbox"
                      checked={instance.send_cancellation}
                      onChange={(event) => handleUpdateConfig('send_cancellation', event.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Card: Mensagem de Teste (só quando conectado) ═══ */}
          {instance.status === 'connected' && (
            <div className="card-whatsapp">
              <div className="card-whatsapp__header">
                <div>
                  <span className="card-whatsapp__eyebrow">Teste</span>
                  <h3 className="card-whatsapp__title">Disparar Mensagem</h3>
                </div>
              </div>
              <div className="card-whatsapp__body">
                <form onSubmit={handleSendTestMessage} className="test-form">
                  <div className="form-group">
                    <label htmlFor="test-phone">Número com DDD (Apenas números)</label>
                    <input id="test-phone" type="text" placeholder="Ex: 11999999999" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="test-msg">Mensagem</label>
                    <textarea id="test-msg" rows={3} value={testMessage} onChange={(e) => setTestMessage(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={actionLoading} className="btn btn--primary">
                    {actionLoading ? <div className="spinner spinner--sm" /> : 'Enviar Mensagem de Teste'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        /* ═══════════════════════════════════════
               WHATSAPP PAGE — CLEAN & HARMONIOUS
               ═══════════════════════════════════════ */
        .whatsapp-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .whatsapp-header h2 {
          font-size: var(--font-size-xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
        }

        .whatsapp-header p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        /* ═══ EMPTY / LOADING STATE ═══ */
        .card.loading-state,
        .card.empty-state {
          padding: 4rem 2rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          color: var(--color-text-secondary);
          border: 1.5px dashed rgba(234, 222, 214, 0.8);
          border-radius: var(--radius-lg);
          background-color: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(12px) saturate(120%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }

        .icon-badge {
          background-color: rgba(217, 108, 0, 0.1);
          color: var(--color-brand-primary);
          padding: 1rem;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.5rem;
          box-shadow: var(--shadow-sm);
        }

        /* ═══ GRID PRINCIPAL — 2 colunas iguais ═══ */
        .whatsapp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 900px) {
          .whatsapp-grid {
            grid-template-columns: 1fr;
          }
        }

        /* ═══ CARD BASE ═══ */
        .card-whatsapp {
          background: var(--color-bg-secondary);
          border-radius: 1.25rem;
          border: 1px solid rgba(234, 222, 214, 0.5);
          box-shadow: 0 1px 3px rgba(45, 35, 30, 0.04), 0 8px 24px -8px rgba(45, 35, 30, 0.06);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        .card-whatsapp:hover {
          box-shadow: 0 1px 3px rgba(45, 35, 30, 0.04), 0 16px 40px -12px rgba(45, 35, 30, 0.1);
          border-color: rgba(217, 108, 0, 0.12);
        }

        .card-whatsapp__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.25rem 1.5rem 0;
        }

        .card-whatsapp__eyebrow {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--color-text-secondary);
          display: block;
          margin-bottom: 0.15rem;
        }

        .card-whatsapp__title {
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0;
        }

        .card-whatsapp__body {
          padding: 1.25rem 1.5rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* ═══ STATUS PILL ═══ */
        .card-whatsapp__pill {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.25rem 0.7rem;
          border-radius: var(--radius-full);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
          flex-shrink: 0;
          margin-top: 0.25rem;
        }

        .card-whatsapp__pill--connected {
          background: rgba(230, 244, 234, 0.6);
          color: var(--color-success);
          border: 1px solid rgba(14, 159, 110, 0.2);
        }

        .card-whatsapp__pill--disconnected {
          background: rgba(253, 232, 232, 0.6);
          color: var(--color-error);
          border: 1px solid rgba(248, 180, 180, 0.25);
        }

        .card-whatsapp__pill--pairing {
          background: rgba(254, 243, 199, 0.6);
          color: var(--color-warning);
          border: 1px solid rgba(217, 120, 6, 0.2);
        }

        /* ═══ INFO ROWS ═══ */
        .info-rows {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          background: rgba(255, 255, 255, 0.5);
          padding: 0.85rem 1rem;
          border-radius: var(--radius-md);
          border: 1px solid rgba(234, 222, 214, 0.5);
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
        }

        .info-row__label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .info-row__value {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .info-row__value code {
          background: rgba(255, 255, 255, 0.8);
          padding: 0.15rem 0.4rem;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(234, 222, 214, 0.5);
          color: var(--color-brand-primary);
          font-size: 0.75rem;
        }

        .info-row__value--green {
          color: var(--color-success);
        }

        /* ═══ DISCONNECTED ACTIONS ═══ */
        .card-whatsapp__actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .helper-text {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin: 0;
          font-weight: 500;
        }

        /* ═══ QR CODE ═══ */
        .card-whatsapp__qr {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          text-align: center;
        }

        .qr-label {
          font-size: var(--font-size-sm);
          font-weight: 800;
          color: var(--color-brand-primary);
          margin: 0;
        }

        .qr-desc {
          font-size: 0.7rem;
          color: var(--color-text-secondary);
          line-height: 1.4;
          font-weight: 500;
          margin: 0;
          max-width: 260px;
        }

        .qr-frame {
          background: white;
          padding: 1rem;
          border-radius: var(--radius-lg);
          border: 1px solid rgba(234, 222, 214, 0.7);
          box-shadow: 0 10px 25px -5px rgba(20, 17, 15, 0.08);
          width: 200px;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qr-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .qr-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .spinner--qr {
          width: 32px;
          height: 32px;
          border-width: 3px;
        }

        /* ═══ CONNECTED ═══ */
        .card-whatsapp__success {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          text-align: center;
        }

        .success-icon {
          background: rgba(230, 244, 234, 0.5);
          border: 1.5px solid rgba(14, 159, 110, 0.2);
          padding: 0.75rem;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .success-msg {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        /* ═══ NOTIFICATION RULES ═══ */
        .rules-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .rule-row {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.85rem 1rem;
          border-radius: var(--radius-lg);
          border: 1px solid rgba(234, 222, 214, 0.5);
          background: rgba(255, 255, 255, 0.4);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .rule-row:hover {
          background: rgba(255, 255, 255, 0.8);
          border-color: rgba(217, 108, 0, 0.12);
        }

        .rule-row__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: rgba(217, 108, 0, 0.06);
          border: 1px solid rgba(217, 108, 0, 0.08);
          color: var(--color-brand-primary);
          flex-shrink: 0;
        }

        .rule-row__content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }

        .rule-row__title {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          cursor: pointer;
        }

        .rule-row__desc {
          font-size: 0.7rem;
          color: var(--color-text-secondary);
          line-height: 1.3;
          font-weight: 500;
        }

        .rule-row__badge {
          font-size: 0.6rem;
          font-weight: 800;
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-sm);
          background: rgba(230, 244, 234, 0.5);
          color: var(--color-success);
          border: 1px solid rgba(14, 159, 110, 0.2);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        .rule-row--reminder {
          flex-direction: column;
          align-items: stretch;
          gap: 0.75rem;
        }

        .rule-row__main {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          width: 100%;
        }

        .reminder-settings {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
          padding-left: 2.9rem;
        }

        .reminder-settings__field {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .reminder-settings__field .helper-text {
          margin: 0;
          font-size: 0.85rem;
        }

        .form-select {
          padding: 0.25rem 0.5rem;
          border: 1px solid rgba(234, 222, 214, 0.8);
          border-radius: var(--radius-sm);
          background: #fff;
          color: var(--color-text-primary);
          font-size: 0.85rem;
        }

        .form-select:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .reminder-settings__summary {
          color: var(--color-brand-primary);
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.01em;
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 38px;
          height: 20px;
          flex-shrink: 0;
        }

        .switch input {
          width: 0;
          height: 0;
          opacity: 0;
        }

        .slider {
          position: absolute;
          inset: 0;
          cursor: pointer;
          border-radius: 20px;
          background-color: rgba(234, 222, 214, 0.8);
          transition: 0.3s;
        }

        .slider::before {
          position: absolute;
          bottom: 3px;
          left: 3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
          content: '';
          transition: 0.3s;
        }

        .switch input:checked + .slider {
          background-color: var(--color-brand-primary);
        }

        .switch input:focus-visible + .slider {
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.18);
        }

        .switch input:checked + .slider::before {
          transform: translateX(18px);
        }

        @media (max-width: 560px) {
          .reminder-settings {
            padding-left: 0;
          }

          .reminder-settings__field {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        /* ═══ TEST FORM ═══ */
        .test-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-group label {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.7rem 1rem;
          border: 1px solid rgba(234, 222, 214, 0.6);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.7);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          outline: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: var(--font-family-base);
        }

        .form-group input:focus,
        .form-group textarea:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.08);
          background: rgba(255, 255, 255, 0.95);
        }

        .form-group textarea {
          resize: vertical;
        }

        /* ═══ BUTTONS ═══ */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          border: none;
          font-size: var(--font-size-sm);
          white-space: nowrap;
          border-radius: var(--radius-md);
          padding: 0.65rem 1.25rem;
        }

        .btn:active {
          transform: scale(0.97);
        }

        .btn--primary {
          background: var(--color-brand-primary);
          color: white;
        }

        .btn--primary:hover {
          background: var(--color-brand-hover);
          transform: translateY(-1px);
        }

        .btn--outline-danger {
          background: transparent;
          border: 1px solid rgba(248, 180, 180, 0.5);
          color: var(--color-error);
        }

        .btn--outline-danger:hover {
          background: rgba(248, 180, 180, 0.06);
          border-color: var(--color-error);
        }

        /* ═══ SPINNER ═══ */
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid var(--color-brand-primary);
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        .spinner--sm {
          width: 16px;
          height: 16px;
          border-width: 2px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
