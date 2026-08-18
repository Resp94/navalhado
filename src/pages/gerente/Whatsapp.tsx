import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  CalendarAdd01Icon,
  CalendarRemove01Icon,
  Clock01Icon,
  Message01Icon,
  Tick02Icon,
  SentIcon,
  RotateLeft01Icon,
  FloppyDiskIcon,
  Alert02Icon,
  SmartPhone01Icon,
} from '@hugeicons/core-free-icons';
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_CONFIGS,
  type WhatsappTemplateKey,
  type TemplateConfig,
  interpolateTemplate,
  validateWhatsappTemplate,
  SAMPLE_MOCK_VARIABLES,
} from '../../modules/whatsapp/templates';
import './Whatsapp.css';

interface WhatsappInstance {
  id: string;
  tenant_id: string;
  instance_name: string;
  qr_code: string | null;
  status: 'connected' | 'disconnected' | 'connecting' | 'hibernated' | 'pairing';
  send_confirmation: boolean;
  send_reminders: boolean;
  reminder_hours: number;
  send_cancellation: boolean;
  template_confirmation?: string | null;
  template_reschedule?: string | null;
  template_cancellation?: string | null;
  template_reminder?: string | null;
  template_first_contact?: string | null;
}

type GatewayInstanceStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'hibernated'
  | 'pairing';

interface GatewayStatusResult {
  status: GatewayInstanceStatus;
  qrcode?: string | null;
}

type WhatsappSetting =
  | 'send_confirmation'
  | 'send_reminders'
  | 'reminder_hours'
  | 'send_cancellation';

const WHATSAPP_INSTANCE_COLUMNS =
  'id, tenant_id, instance_name, qr_code, status, send_confirmation, send_reminders, reminder_hours, send_cancellation, template_confirmation, template_reschedule, template_cancellation, template_reminder, template_first_contact';
const STATUS_POLL_INTERVAL_MS = 2000;
const STATUS_POLL_MAX_ATTEMPTS = 90;
const TERMINAL_STATUSES = ['connected', 'disconnected', 'hibernated'];
const GATEWAY_STATUSES: GatewayInstanceStatus[] = [
  'connected',
  'connecting',
  'disconnected',
  'hibernated',
  'pairing',
];

const toWhatsappInstance = (row: Record<string, unknown>): WhatsappInstance => ({
  id: String(row.id || ''),
  tenant_id: String(row.tenant_id || ''),
  instance_name: String(row.instance_name || ''),
  qr_code: (row.qr_code as string | null) ?? null,
  status: row.status === 'pairing' ? 'connecting' : (row.status as WhatsappInstance['status']),
  send_confirmation: Boolean(row.send_confirmation),
  send_reminders: Boolean(row.send_reminders),
  reminder_hours: Number(row.reminder_hours || 2),
  send_cancellation: Boolean(row.send_cancellation),
  template_confirmation: (row.template_confirmation as string | null) ?? null,
  template_reschedule: (row.template_reschedule as string | null) ?? null,
  template_cancellation: (row.template_cancellation as string | null) ?? null,
  template_reminder: (row.template_reminder as string | null) ?? null,
  template_first_contact: (row.template_first_contact as string | null) ?? null,
});

const formatHoursToReadable = (hours: number): string =>
  `${hours} ${hours === 1 ? 'hora' : 'horas'}`;

const requestProviderStatus = (target: Pick<WhatsappInstance, 'id' | 'instance_name'>) =>
  supabase.functions.invoke('whatsapp-integration/manage-instance', {
    body: {
      action: 'status',
      instance_id: target.id,
      instance_name: target.instance_name,
    },
  });

const isGatewayStatusResult = (value: unknown): value is GatewayStatusResult => {
  if (!value || typeof value !== 'object') return false;
  const status = (value as { status?: unknown }).status;
  return typeof status === 'string' && GATEWAY_STATUSES.includes(status as GatewayInstanceStatus);
};

const mergeGatewayStatus = (previous: WhatsappInstance, gatewayResult: GatewayStatusResult): WhatsappInstance => ({
  ...previous,
  status: gatewayResult.status === 'pairing' ? 'connecting' : gatewayResult.status,
  qr_code: gatewayResult.qrcode ??
    (TERMINAL_STATUSES.includes(gatewayResult.status) ? null : previous.qr_code),
});

const formatWhatsAppFormattedHtml = (text: string) => {
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bolding *texto*
  escaped = escaped.replace(/\*([^\*]+)\*/g, '<strong>$1</strong>');
  // Italic _texto_
  escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Strikethrough ~texto~
  escaped = escaped.replace(/~([^~]+)~/g, '<del>$1</del>');
  // Line breaks
  escaped = escaped.replace(/\n/g, '<br />');

  return { __html: escaped };
};

const buildTemplateDrafts = (inst?: WhatsappInstance | null): Record<WhatsappTemplateKey, string> => ({
  confirmation: inst?.template_confirmation || DEFAULT_TEMPLATES.confirmation,
  reschedule: inst?.template_reschedule || DEFAULT_TEMPLATES.reschedule,
  cancellation: inst?.template_cancellation || DEFAULT_TEMPLATES.cancellation,
  reminder: inst?.template_reminder || DEFAULT_TEMPLATES.reminder,
  first_contact: inst?.template_first_contact || DEFAULT_TEMPLATES.first_contact,
});

export const Whatsapp: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const [instance, setInstance] = useState<WhatsappInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Estados de Personalização de Templates
  const [activeTab, setActiveTab] = useState<WhatsappTemplateKey>('confirmation');
  const [templateDrafts, setTemplateDrafts] = useState<Record<WhatsappTemplateKey, string>>(buildTemplateDrafts(null));
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [managerPhone, setManagerPhone] = useState<string>('');
  const [testPhoneForTemplate, setTestPhoneForTemplate] = useState('');
  const [sendingTemplateTest, setSendingTemplateTest] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const fetchManagerProfile = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('phone')
            .eq('id', authData.user.id)
            .maybeSingle();
          if (userProfile?.phone) {
            setManagerPhone(userProfile.phone);
            setTestPhoneForTemplate(userProfile.phone);
          }
        }
      } catch (err) {
        console.warn('Could not fetch manager profile phone:', err);
      }
    };

    fetchManagerProfile();

    const fetchInstance = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('whatsapp_instances')
          .select(WHATSAPP_INSTANCE_COLUMNS)
          .eq('tenant_id', tenant.tenantId)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          const parsed = toWhatsappInstance(data);
          setInstance(parsed);
          setTemplateDrafts(buildTemplateDrafts(parsed));
        } else {
          setInstance(null);
        }
      } catch (error) {
        console.error('Error fetching whatsapp instance:', error);
        addToast('Não foi possível carregar o status do WhatsApp.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchInstance();

    const channel = supabase
      .channel(`whatsapp_instances:${tenant.tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_instances',
          filter: `tenant_id=eq.${tenant.tenantId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setInstance(null);
            return;
          }

          setInstance((prev) => {
            const merged = { ...(prev || {}), ...payload.new };
            const parsed = toWhatsappInstance(merged);
            return parsed;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addToast, tenant.tenantId]);

  useEffect(() => {
    if (!instance || instance.status !== 'disconnected') return;

    let cancelled = false;
    void requestProviderStatus(instance).then(({ data, error }) => {
      if (cancelled || error || !isGatewayStatusResult(data)) return;
      setInstance((previous) => previous ? mergeGatewayStatus(previous, data) : null);
    });

    return () => {
      cancelled = true;
    };
  }, [instance?.id, instance?.instance_name, instance?.status]);

  useEffect(() => {
    if (!instance || instance.status !== 'connecting') return;

    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const pollStatus = async () => {
      if (cancelled) return;
      if (attempts >= STATUS_POLL_MAX_ATTEMPTS) {
        if (timer !== undefined) window.clearInterval(timer);
        return;
      }
      attempts += 1;
      const { data, error } = await requestProviderStatus(instance);

      if (cancelled || error || !isGatewayStatusResult(data)) return;
      setInstance((previous) => previous ? mergeGatewayStatus(previous, data) : null);
    };

    void pollStatus();
    timer = window.setInterval(() => { void pollStatus(); }, STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [instance?.id, instance?.instance_name, instance?.status]);

  useGSAP(() => {
    if (!loading) {
      gsap.fromTo('.card-whatsapp', 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' }
      );
      gsap.fromTo('.rule-row', 
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.35, stagger: 0.05, delay: 0.2, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' }
      );
    }
  }, [loading]);

  useGSAP(() => {
    if (!loading && instance) {
      gsap.fromTo(
        '.template-split-view',
        { opacity: 0.6, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' }
      );
      gsap.fromTo(
        '.whatsapp-balloon',
        { scale: 0.97, opacity: 0.85 },
        { scale: 1, opacity: 1, duration: 0.25, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' }
      );
    }
  }, [activeTab, loading, instance]);

  const handleCreateInstance = async () => {
    try {
      setActionLoading(true);
      const { data: funcData, error: funcError } = await supabase.functions.invoke(
        'whatsapp-integration/activate-instance',
        { body: {} },
      );

      if (funcError || (funcData && funcData.error)) {
        const errorMsg = funcData?.error || funcError?.message || 'Erro ao inicializar a Instância WhatsApp da barbearia.';
        throw new Error(errorMsg);
      }

      if (!funcData?.instance) throw new Error('A ativação não retornou uma instância válida.');
      setInstance(toWhatsappInstance(funcData.instance));
      addToast('Instância criada com sucesso! Conecte seu celular.', 'success');
    } catch (error: any) {
      console.error('Error creating instance:', error);
      addToast(error?.message || 'Erro ao inicializar o WhatsApp da barbearia.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!instance) return;
    try {
      setActionLoading(true);
      
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .update({
          status: 'connecting',
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', instance.id)
        .select(WHATSAPP_INSTANCE_COLUMNS)
        .single();

      if (error) throw error;
      setInstance(toWhatsappInstance(data));

      const { data: funcData, error: funcError } = await supabase.functions.invoke(
        'whatsapp-integration/manage-instance',
        {
          body: {
            action: 'connect',
            instance_id: instance.id,
            instance_name: instance.instance_name,
          },
        }
      );

      if (funcError || (funcData && funcData.error)) {
        const { data: statusData, error: statusError } = await requestProviderStatus(instance);
        if (!statusError && isGatewayStatusResult(statusData)) {
          setInstance((previous) => previous ? mergeGatewayStatus(previous, statusData) : null);
          if (statusData.status === 'connected') {
            addToast('WhatsApp conectado com sucesso.', 'success');
            return;
          }
        }
        const errorMsg = funcData?.error || funcError?.message || 'Erro ao obter QR Code da VPS.';
        throw new Error(errorMsg);
      }

      if (isGatewayStatusResult(funcData)) {
        setInstance(prev => prev ? mergeGatewayStatus(prev, funcData) : null);
      }

      addToast('Solicitação de QR Code enviada. Aguarde a geração.', 'info');

    } catch (error: any) {
      console.error('Error connecting whatsapp instance:', error);
      addToast(error?.message || 'Erro ao solicitar conexão de WhatsApp.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!instance) return;
    try {
      setActionLoading(true);
      const { data, error } = await supabase.functions.invoke('whatsapp-integration/manage-instance', {
        body: {
          action: 'resume',
          instance_id: instance.id,
          instance_name: instance.instance_name,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro ao retomar a conexão.');
      setInstance((previous) => previous ? {
        ...previous,
        status: data?.status === 'pairing' ? 'connecting' : (data?.status || 'connected'),
        qr_code: data?.qrcode ?? null,
      } : null);
      addToast('Sessão do WhatsApp retomada.', 'success');
    } catch (error: any) {
      console.error('Error resuming whatsapp instance:', error);
      addToast(error?.message || 'Erro ao retomar a conexão do WhatsApp.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!instance) return;
    try {
      setActionLoading(true);

      const { data: disconnectData, error: disconnectError } = await supabase.functions.invoke(
        'whatsapp-integration/manage-instance',
        {
          body: {
            action: 'disconnect',
            instance_id: instance.id,
            instance_name: instance.instance_name,
          },
        }
      );
      if (disconnectError || disconnectData?.error) {
        throw new Error(disconnectData?.error || disconnectError?.message || 'Erro ao desconectar o WhatsApp.');
      }

      const { data, error } = await supabase
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', instance.id)
        .select(WHATSAPP_INSTANCE_COLUMNS)
        .single();

      if (error) throw error;
      setInstance(toWhatsappInstance(data));
      addToast('WhatsApp desconectado da barbearia.', 'warning');
    } catch (error: any) {
      console.error('Error disconnecting whatsapp instance:', error);
      addToast(error?.message || 'Erro ao desconectar WhatsApp.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateConfig = async (
    key: WhatsappSetting,
    value: boolean | number
  ) => {
    if (!instance) return;

    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .update({
          [key]: value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', instance.id)
        .select(WHATSAPP_INSTANCE_COLUMNS)
        .single();

      if (error) throw error;
      setInstance(toWhatsappInstance(data));
      addToast('Configurações do WhatsApp atualizadas com sucesso!', 'success');
    } catch (error) {
      console.error('Error updating whatsapp config:', error);
      addToast('Erro ao atualizar configurações de disparo.', 'error');
    }
  };

  // Funções de Gerenciamento de Templates
  const currentConfig: TemplateConfig =
    TEMPLATE_CONFIGS.find((c) => c.key === activeTab) || TEMPLATE_CONFIGS[0];
  const activeDraftText = templateDrafts[activeTab] ?? '';
  const templateValidation = validateWhatsappTemplate(activeDraftText);
  const isLinkValid = templateValidation.hasLink;

  const handleInsertTag = (tag: string) => {
    const textarea = textareaRef.current;
    const currentText = activeDraftText;
    if (!textarea) {
      setTemplateDrafts((prev) => ({
        ...prev,
        [activeTab]: currentText + ' ' + tag,
      }));
      return;
    }

    const start = textarea.selectionStart ?? currentText.length;
    const end = textarea.selectionEnd ?? currentText.length;
    const nextText = currentText.substring(0, start) + tag + currentText.substring(end);

    setTemplateDrafts((prev) => ({
      ...prev,
      [activeTab]: nextText,
    }));

    setTimeout(() => {
      textarea.focus();
      const nextCursor = start + tag.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const handleSaveTemplate = async () => {
    if (!instance) {
      addToast('Conecte ou ative o WhatsApp antes de salvar modelos.', 'warning');
      return;
    }

    if (!templateValidation.isValid) {
      addToast(
        templateValidation.errorMessage ||
          'A tag {link} é obrigatória para que o cliente acesse o Canal do Cliente.',
        'warning'
      );
      return;
    }

    try {
      setSavingTemplate(true);
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .update({
          [currentConfig.column]: activeDraftText.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', instance.id)
        .select(WHATSAPP_INSTANCE_COLUMNS)
        .single();

      if (error) throw error;
      const updated = toWhatsappInstance(data);
      setInstance(updated);
      addToast(`Modelo de ${currentConfig.shortTitle} salvo com sucesso!`, 'success');
    } catch (error: any) {
      console.error('Error saving whatsapp template:', error);
      addToast(error?.message || 'Erro ao salvar modelo de mensagem.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleResetTemplate = () => {
    const defaultText = DEFAULT_TEMPLATES[activeTab];
    setTemplateDrafts((prev) => ({
      ...prev,
      [activeTab]: defaultText,
    }));
    addToast(`Texto padrão de ${currentConfig.shortTitle} restaurado no editor.`, 'info');
  };

  const handleSendTemplateTest = async () => {
    const targetPhone = testPhoneForTemplate.trim();
    if (!targetPhone) {
      addToast('Informe o número de telefone com DDD para receber o teste.', 'warning');
      return;
    }

    const previewText = interpolateTemplate(activeDraftText, {
      ...SAMPLE_MOCK_VARIABLES,
      barbearia: tenant.tenantName || 'Navalhado Club',
    });

    try {
      setSendingTemplateTest(true);
      const { error } = await supabase.functions.invoke('whatsapp-integration/send-manual', {
        body: {
          tenant_id: tenant.tenantId,
          number: targetPhone,
          text: previewText,
        },
      });

      if (error) throw error;
      addToast(`Teste do modelo disparado com sucesso para ${targetPhone}!`, 'success');
    } catch (error: any) {
      console.error('Error sending template test:', error);
      addToast(error?.message || 'Erro ao disparar teste do modelo.', 'error');
    } finally {
      setSendingTemplateTest(false);
    }
  };

  const EVENT_ICONS: Record<WhatsappTemplateKey, Parameters<typeof HugeiconsIcon>[0]['icon']> = {
    confirmation: Tick02Icon,
    reschedule: CalendarAdd01Icon,
    cancellation: CalendarRemove01Icon,
    reminder: Clock01Icon,
    first_contact: Message01Icon,
  };

  const getEventIcon = (key: WhatsappTemplateKey) => {
    const IconComponent = EVENT_ICONS[key] || Calendar03Icon;
    return <HugeiconsIcon icon={IconComponent} size={16} />;
  };

  const renderedPreviewText = interpolateTemplate(activeDraftText, {
    ...SAMPLE_MOCK_VARIABLES,
    barbearia: tenant.tenantName || 'Navalhado Club',
  });

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
        <div className="whatsapp-content-layout">
          {/* ═══ GRID PRINCIPAL: Status + Disparos ═══ */}
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
                  {(instance.status === 'connecting' || instance.status === 'pairing') && 'Pareando'}
                  {instance.status === 'hibernated' && 'Pausado'}
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

                {instance.status === 'hibernated' && (
                  <div className="card-whatsapp__actions">
                    <p className="helper-text">A sessão está pausada, mas pode ser retomada sem novo QR Code.</p>
                    <button onClick={handleResume} disabled={actionLoading} className="btn btn--primary">
                      {actionLoading ? <div className="spinner spinner--sm" /> : 'Retomar Sessão'}
                    </button>
                    <button onClick={handleDisconnect} disabled={actionLoading} className="btn btn--outline-danger">
                      Desconectar Aparelho
                    </button>
                  </div>
                )}

                {(instance.status === 'connecting' || instance.status === 'pairing') && (
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

            {/* ═══ Card: Configuração de Disparos ═══ */}
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
          </div>

          {/* ═══ SEÇÃO SPLIT VIEW: Personalização de Mensagens ═══ */}
          <div className="card-whatsapp template-editor-card">
            <div className="template-editor-header">
              <div>
                <span className="card-whatsapp__eyebrow">Personalização</span>
                <h3 className="card-whatsapp__title">Modelos de Mensagens do WhatsApp</h3>
                <p className="template-editor-subtitle">
                  Configure o tom de voz e o formato das mensagens automáticas enviadas pela sua barbearia.
                </p>
              </div>
            </div>

            {/* Seletor de Abas de Eventos */}
            <div className="template-tabs-container" role="tablist" aria-label="Modelos de mensagens">
              {TEMPLATE_CONFIGS.map((config) => {
                const isActive = activeTab === config.key;
                return (
                  <button
                    key={config.key}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${config.key}`}
                    id={`tab-${config.key}`}
                    onClick={() => setActiveTab(config.key)}
                    className={`template-tab-btn ${isActive ? 'template-tab-btn--active' : ''}`}
                  >
                    <span className="template-tab-icon">{getEventIcon(config.key)}</span>
                    <span className="template-tab-label">{config.shortTitle}</span>
                  </button>
                );
              })}
            </div>

            <div className="template-split-view" id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
              {/* Coluna Esquerda: Editor e Controles */}
              <div className="template-editor-column">
                <div className="template-meta-info">
                  <h4>{currentConfig.title}</h4>
                  <p>{currentConfig.description}</p>
                </div>

                {/* Barra de Chips de Tags Dinâmicas */}
                <div className="tags-chips-section">
                  <span className="tags-label">Tags disponíveis (clique para inserir no texto):</span>
                  <div className="tags-chips-grid">
                    {currentConfig.availableTags.map((tagItem) => (
                      <button
                        key={tagItem.tag}
                        type="button"
                        onClick={() => handleInsertTag(tagItem.tag)}
                        className={`tag-chip-btn ${tagItem.tag === '{link}' ? 'tag-chip-btn--link' : ''}`}
                        title={tagItem.description}
                      >
                        <code>{tagItem.tag}</code>
                        <span>{tagItem.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea do Template */}
                <div className="template-textarea-wrapper">
                  <textarea
                    ref={textareaRef}
                    aria-label={`Editor de mensagem para ${currentConfig.title}`}
                    rows={6}
                    maxLength={2000}
                    value={activeDraftText}
                    onChange={(e) => {
                      const text = e.target.value;
                      setTemplateDrafts((prev) => ({
                        ...prev,
                        [activeTab]: text,
                      }));
                    }}
                    placeholder="Digite a mensagem do modelo..."
                    className={`template-textarea ${!isLinkValid ? 'template-textarea--invalid' : ''}`}
                  />
                  <div className="textarea-footer">
                    <span className={`char-count ${activeDraftText.length > 1800 ? 'char-count--warning' : ''}`}>
                      {activeDraftText.length} / 2000 caracteres
                    </span>
                  </div>
                </div>

                {/* Banner de Validação do Link */}
                {!isLinkValid && (
                  <div className="link-validation-alert" role="alert">
                    <div className="alert-icon">
                      <HugeiconsIcon icon={Alert02Icon} size={18} />
                    </div>
                    <div className="alert-content">
                      <strong>Tag obrigatória ausente</strong>
                      <p>
                        A tag <code>{'{link}'}</code> é obrigatória para que o cliente consiga acessar o autoatendimento. Insira a tag para poder salvar.
                      </p>
                    </div>
                  </div>
                )}

                {/* Ações do Editor */}
                <div className="template-editor-actions">
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    disabled={savingTemplate}
                    className="btn btn--outline"
                    title="Restaura o texto canônico de fábrica"
                  >
                    <HugeiconsIcon icon={RotateLeft01Icon} size={16} />
                    Restaurar Padrão
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate || !isLinkValid}
                    className="btn btn--primary"
                  >
                    {savingTemplate ? (
                      <div className="spinner spinner--sm" />
                    ) : (
                      <>
                        <HugeiconsIcon icon={FloppyDiskIcon} size={16} />
                        Salvar Modelo
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Coluna Direita: Simulador de WhatsApp */}
              <div className="template-preview-column">
                <div className="phone-preview-card">
                  {/* Cabeçalho do Celular */}
                  <div className="phone-preview-header">
                    <div className="phone-avatar">
                      <HugeiconsIcon icon={SmartPhone01Icon} size={16} />
                    </div>
                    <div className="phone-contact">
                      <span className="phone-name">{tenant.tenantName || 'Navalhado Barbearia'}</span>
                      <span className="phone-status">Online agora</span>
                    </div>
                  </div>

                  {/* Área de Conversa do WhatsApp */}
                  <div className="phone-chat-canvas" role="region" aria-label="Simulador de tela do WhatsApp">
                    <div className="chat-date-pill">Hoje</div>
                    <div
                      className="whatsapp-balloon"
                      aria-live="polite"
                      aria-atomic="true"
                      aria-label="Prévia da mensagem formatada no WhatsApp"
                    >
                      <div
                        className="whatsapp-balloon__text"
                        dangerouslySetInnerHTML={formatWhatsAppFormattedHtml(renderedPreviewText)}
                      />
                      <div className="whatsapp-balloon__meta">
                        <span className="whatsapp-time">
                          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="whatsapp-checks" aria-hidden="true">
                          <HugeiconsIcon icon={Tick02Icon} size={12} />
                          <HugeiconsIcon icon={Tick02Icon} size={12} />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé de Teste Rápido no WhatsApp Real */}
                  <div className="phone-preview-footer">
                    <div className="test-action-header-row">
                      <span className="test-action-label">Testar este modelo no seu celular:</span>
                      {managerPhone && testPhoneForTemplate !== managerPhone && (
                        <button
                          type="button"
                          className="btn-use-my-phone"
                          onClick={() => setTestPhoneForTemplate(managerPhone)}
                          title="Usar o número do gerente logado"
                        >
                          Usar Meu WhatsApp
                        </button>
                      )}
                    </div>
                    <div className="test-action-inputs">
                      <input
                        type="text"
                        placeholder="DDD + Número (ex: 11999999999)"
                        value={testPhoneForTemplate}
                        onChange={(e) => setTestPhoneForTemplate(e.target.value)}
                        className="test-phone-input"
                      />
                      <button
                        type="button"
                        onClick={handleSendTemplateTest}
                        disabled={sendingTemplateTest || !isLinkValid}
                        className="btn btn--test-send"
                        title="Enviar mensagem real para o número digitado"
                      >
                        {sendingTemplateTest ? (
                          <div className="spinner spinner--sm" />
                        ) : (
                          <>
                            <HugeiconsIcon icon={SentIcon} size={14} />
                            Testar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
