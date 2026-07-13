import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

interface EvolutionInstance {
  id: string;
  instance_name: string;
  api_key: string;
  qr_code: string | null;
  status: 'connected' | 'disconnected' | 'pairing';
}

export const Whatsapp: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const [instance, setInstance] = useState<EvolutionInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste do sistema Navalhado.');

  const fetchInstance = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('evolution_api_instances')
        .select('*')
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();

      if (error) throw error;
      setInstance(data);
    } catch (error: any) {
      console.error('Error fetching whatsapp instance:', error);
      addToast('Não foi possível carregar o status do WhatsApp.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstance();
  }, [tenant.tenantId]);

  useGSAP(() => {
    if (!loading) {
      gsap.fromTo('.card', 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }
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
        .select()
        .single();

      if (error) throw error;
      setInstance(data);
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
      
      // Simulação da Evolution API gerando o QRCode
      const mockQrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://navalhado.com/whatsapp-link-simulation-' + crypto.randomUUID();

      const { data, error } = await supabase
        .from('evolution_api_instances')
        .update({
          status: 'pairing',
          qr_code: mockQrCode,
          updated_at: new Date().toISOString()
        })
        .eq('id', instance.id)
        .select()
        .single();

      if (error) throw error;
      setInstance(data);
      addToast('QR Code gerado! Aponte a câmera do WhatsApp para parear.', 'info');

      // Simular pareamento bem sucedido após 15 segundos para o protótipo funcionar perfeitamente de forma autônoma
      setTimeout(async () => {
        try {
          const { error: pairError } = await supabase
            .from('evolution_api_instances')
            .update({
              status: 'connected',
              qr_code: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', instance.id);

          if (!pairError) {
            fetchInstance();
            addToast('WhatsApp conectado com sucesso (Simulado)!', 'success');
          }
        } catch (err) {
          console.error('Auto-pair simulation failed:', err);
        }
      }, 12000);

    } catch (error: any) {
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
        .select()
        .single();

      if (error) throw error;
      setInstance(data);
      addToast('WhatsApp desconectado da barbearia.', 'warning');
    } catch (error: any) {
      addToast('Erro ao desconectar WhatsApp.', 'error');
    } finally {
      setActionLoading(false);
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
      // Simulação do envio de mensagem via Evolution API
      await new Promise(resolve => setTimeout(resolve, 1500));
      addToast(`Mensagem de teste disparada com sucesso para ${testPhone}!`, 'success');
    } catch (error) {
      addToast('Erro ao disparar mensagem de teste.', 'error');
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
        <div className="whatsapp-content-grid">
          {/* Coluna da esquerda: Status e Conexão */}
          <section className="card connection-card">
            <h3>Status da Integração</h3>
            
            <div className="status-container">
              <div className="status-info">
                <span>Status Atual:</span>
                <span className={`status-badge-custom status-badge-custom--${instance.status}`}>
                  {instance.status === 'connected' && 'Conectado'}
                  {instance.status === 'disconnected' && 'Desconectado'}
                  {instance.status === 'pairing' && 'Aguardando Pareamento'}
                </span>
              </div>

              <div className="instance-details">
                <p>Nome da Instância: <code>{instance.instance_name}</code></p>
                <p>Status da Evolution API: <strong>Online</strong></p>
              </div>

              {instance.status === 'disconnected' && (
                <div className="connection-actions">
                  <p className="helper-text">Inicie o pareamento para conectar o celular da barbearia.</p>
                  <button 
                    onClick={handleConnect} 
                    disabled={actionLoading}
                    className="btn btn--primary w-full"
                  >
                    {actionLoading ? <div className="spinner spinner--sm" /> : 'Gerar QR Code de Conexão'}
                  </button>
                </div>
              )}

              {instance.status === 'pairing' && instance.qr_code && (
                <div className="qr-code-section">
                  <p className="qr-title">Leia o QR Code abaixo</p>
                  <p className="qr-desc">Abra o WhatsApp no seu celular, vá em <strong>Aparelhos Conectados &gt; Conectar um Aparelho</strong> e aponte a câmera para a tela.</p>
                  <div className="qr-image-wrapper">
                    <img src={instance.qr_code} alt="QR Code WhatsApp" />
                  </div>
                  <button 
                    onClick={handleDisconnect} 
                    disabled={actionLoading}
                    className="btn btn--outline-danger btn--sm"
                  >
                    {actionLoading ? <div className="spinner spinner--sm" /> : 'Cancelar Pareamento'}
                  </button>
                </div>
              )}

              {instance.status === 'connected' && (
                <div className="connected-section">
                  <div className="success-icon-wrapper">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <path d="m9 11 3 3L22 4" />
                    </svg>
                  </div>
                  <p className="connected-msg">O sistema está pronto para enviar notificações!</p>
                  <button 
                    onClick={handleDisconnect} 
                    disabled={actionLoading}
                    className="btn btn--outline-danger w-full"
                  >
                    {actionLoading ? <div className="spinner spinner--sm" /> : 'Desconectar Aparelho'}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Coluna da direita: Teste e Notificações */}
          <div className="whatsapp-right-column">
            {instance.status === 'connected' && (
              <section className="card test-card">
                <h3>Disparar Mensagem de Teste</h3>
                <form onSubmit={handleSendTestMessage} className="test-form">
                  <div className="form-group">
                    <label htmlFor="test-phone">Número com DDD (Apenas números)</label>
                    <input 
                      id="test-phone"
                      type="text" 
                      placeholder="Ex: 11999999999" 
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="test-msg">Mensagem</label>
                    <textarea 
                      id="test-msg"
                      rows={3} 
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={actionLoading}
                    className="btn btn--primary"
                  >
                    {actionLoading ? <div className="spinner spinner--sm" /> : 'Enviar Mensagem de Teste'}
                  </button>
                </form>
              </section>
            )}

            <section className="card rules-card">
              <h3>Configuração de Notificações</h3>
              <div className="notification-rules">
                <div className="rule-item">
                  <div className="rule-info">
                    <h4>Confirmação Automática</h4>
                    <p>Envia o link de agendamento por WhatsApp assim que o cliente reserva um corte.</p>
                  </div>
                  <span className="badge badge-status badge-status--active">Sempre Ativo</span>
                </div>

                <div className="rule-item">
                  <div className="rule-info">
                    <h4>Lembrete de Horário (2 Horas Antes)</h4>
                    <p>Envia lembrete com opção de cancelamento 2 horas antes do horário marcado.</p>
                  </div>
                  <span className="badge badge-status badge-status--active">Sempre Ativo</span>
                </div>

                <div className="rule-item">
                  <div className="rule-info">
                    <h4>Alerta de Cancelamento</h4>
                    <p>Envia notificação se o barbeiro ou o cliente cancelarem o agendamento.</p>
                  </div>
                  <span className="badge badge-status badge-status--active">Sempre Ativo</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      <style>{`
        .whatsapp-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
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

        .card {
          background-color: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(12px) saturate(120%);
          -webkit-backdrop-filter: blur(12px) saturate(120%);
          border: 1px solid rgba(234, 222, 214, 0.5);
          border-radius: var(--radius-lg);
          padding: 1.75rem;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), var(--shadow-sm);
        }

        .card h3 {
          font-size: var(--font-size-lg);
          font-weight: 800;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid rgba(234, 222, 214, 0.8);
          padding-bottom: 0.5rem;
          color: var(--color-text-primary);
        }

        .loading-state,
        .empty-state {
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

        .whatsapp-content-grid {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 900px) {
          .whatsapp-content-grid {
            grid-template-columns: 1fr;
          }
        }

        .status-container {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .status-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 700;
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
        }

        .status-badge-custom {
          font-size: 0.75rem;
          font-weight: 800;
          padding: 0.25rem 0.75rem;
          border-radius: var(--radius-full);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .status-badge-custom--connected {
          background-color: rgba(230, 244, 234, 0.5);
          color: var(--color-success);
          border: 1px solid rgba(14, 159, 110, 0.2);
        }

        .status-badge-custom--disconnected {
          background-color: rgba(253, 232, 232, 0.5);
          color: var(--color-error);
          border: 1px solid rgba(248, 180, 180, 0.25);
        }

        .status-badge-custom--pairing {
          background-color: rgba(254, 243, 199, 0.5);
          color: var(--color-warning);
          border: 1px solid rgba(217, 120, 6, 0.2);
        }

        .instance-details {
          background-color: rgba(255, 255, 255, 0.5);
          padding: 1rem;
          border-radius: var(--radius-md);
          font-size: 0.8rem;
          border: 1px solid var(--color-border);
          line-height: 1.5;
        }

        .instance-details code {
          background-color: rgba(255, 255, 255, 0.8);
          padding: 0.15rem 0.35rem;
          border-radius: var(--radius-sm);
          font-weight: 700;
          border: 1px solid var(--color-border);
          color: var(--color-brand-primary);
        }

        .helper-text {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin-bottom: 0.75rem;
          font-weight: 500;
        }

        .w-full {
          width: 100%;
        }

        .qr-code-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          text-align: center;
          border-top: 1px solid rgba(234, 222, 214, 0.8);
          padding-top: 1.25rem;
        }

        .qr-title {
          font-size: var(--font-size-sm);
          font-weight: 800;
          color: var(--color-brand-primary);
        }

        .qr-desc {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          line-height: 1.4;
          font-weight: 500;
        }

        .qr-image-wrapper {
          background-color: white;
          padding: 1rem;
          border-radius: var(--radius-lg);
          border: 1px solid rgba(234, 222, 214, 0.8);
          box-shadow: 0 10px 25px -5px rgba(20, 17, 15, 0.08);
          margin: 0.5rem 0;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 220px;
          height: 220px;
          position: relative;
        }

        .qr-image-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .connected-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          text-align: center;
          border-top: 1px solid rgba(234, 222, 214, 0.8);
          padding-top: 1.5rem;
        }

        .success-icon-wrapper {
          background-color: rgba(230, 244, 234, 0.5);
          border: 1.5px solid rgba(14, 159, 110, 0.2);
          padding: 0.75rem;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-sm);
        }

        .connected-msg {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.5rem;
        }

        .whatsapp-right-column {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

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
          font-size: var(--font-size-xs);
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .form-group input,
        .form-group textarea {
          padding: 0.75rem 1rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background-color: rgba(255, 255, 255, 0.75);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          outline: none;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .form-group input:focus,
        .form-group textarea:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.1);
        }

        .notification-rules {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .rule-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          background-color: rgba(255, 255, 255, 0.5);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .rule-item:hover {
          background-color: rgba(255, 255, 255, 0.85);
          border-color: rgba(217, 108, 0, 0.2);
          transform: translateX(2px);
        }

        .rule-info h4 {
          font-size: var(--font-size-sm);
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.15rem;
        }

        .rule-info p {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          line-height: 1.3;
          margin: 0;
          font-weight: 500;
        }

        .badge-status {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.25rem 0.6rem;
          border-radius: var(--radius-sm);
          letter-spacing: 0.02em;
        }

        .badge-status--active {
          background-color: rgba(230, 244, 234, 0.5);
          color: var(--color-success);
          border: 1px solid rgba(14, 159, 110, 0.2);
        }

        .btn {
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn:active {
          transform: scale(0.97);
        }

        .btn--primary {
          background-color: var(--color-brand-primary);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: var(--radius-md);
        }

        .btn--primary:hover {
          background-color: var(--color-brand-hover);
          transform: translateY(-1px);
        }

        .btn--outline-danger {
          background-color: transparent;
          border: 1px solid var(--color-error);
          color: var(--color-error);
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md);
        }

        .btn--outline-danger:hover {
          background-color: var(--color-error);
          color: white;
        }
      `}</style>
    </div>
  );
};
