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
  UserAdd01Icon,
  ScissorIcon,
  Cancel01Icon,
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
  send_welcome_balcao: boolean;
  template_confirmation?: string | null;
  template_reschedule?: string | null;
  template_cancellation?: string | null;
  template_reminder?: string | null;
  template_welcome_balcao?: string | null;
  template_first_contact?: string | null;
  template_professional_created?: string | null;
  template_professional_rescheduled?: string | null;
  template_professional_cancelled?: string | null;
  auto_reply_keywords?: string | null;
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
  | 'send_cancellation'
  | 'send_welcome_balcao';

const WHATSAPP_INSTANCE_COLUMNS =
  'id, tenant_id, instance_name, qr_code, status, send_confirmation, send_reminders, reminder_hours, send_cancellation, send_welcome_balcao, template_confirmation, template_reschedule, template_cancellation, template_reminder, template_welcome_balcao, template_first_contact, template_professional_created, template_professional_rescheduled, template_professional_cancelled, auto_reply_keywords';
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

// Classes utilitárias reutilizadas nos botões da página (ver ticket 10 da migração Tailwind)
const BTN_BASE =
  'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all duration-200 ease-in-out border-none text-sm whitespace-nowrap rounded-md px-5 py-[0.65rem] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100';
const BTN_PRIMARY = `${BTN_BASE} bg-brand-primary text-white enabled:hover:bg-brand-hover enabled:hover:-translate-y-px motion-reduce:hover:translate-y-0`;
const BTN_OUTLINE = `${BTN_BASE} bg-transparent border border-[rgba(234,222,214,0.9)] text-text-primary enabled:hover:bg-white/90 enabled:hover:border-brand-primary`;
const BTN_OUTLINE_DANGER = `${BTN_BASE} bg-transparent border border-[rgba(248,180,180,0.5)] text-error hover:bg-[rgba(248,180,180,0.06)] hover:border-error`;

const SPINNER_BASE = 'border-brand-primary border-t-transparent rounded-full animate-spin-fast motion-reduce:animate-none';
const SPINNER = `w-5 h-5 border-2 ${SPINNER_BASE}`;
const SPINNER_SM = `w-4 h-4 border-2 ${SPINNER_BASE}`;

const STATUS_PILL_STYLES: Record<WhatsappInstance['status'], string> = {
  connected: 'bg-success-bg/60 text-success border border-success/20',
  disconnected: 'bg-error-bg/60 text-error border border-[rgba(248,180,180,0.25)]',
  connecting: 'bg-warning-bg/60 text-warning border border-warning/20',
  pairing: 'bg-warning-bg/60 text-warning border border-warning/20',
  hibernated: 'bg-text-secondary/[0.08] text-text-secondary border border-text-secondary/20',
};

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
  send_welcome_balcao: row.send_welcome_balcao !== undefined ? Boolean(row.send_welcome_balcao) : true,
  template_confirmation: (row.template_confirmation as string | null) ?? null,
  template_reschedule: (row.template_reschedule as string | null) ?? null,
  template_cancellation: (row.template_cancellation as string | null) ?? null,
  template_reminder: (row.template_reminder as string | null) ?? null,
  template_welcome_balcao: (row.template_welcome_balcao as string | null) ?? null,
  template_first_contact: (row.template_first_contact as string | null) ?? null,
  template_professional_created: (row.template_professional_created as string | null) ?? null,
  template_professional_rescheduled: (row.template_professional_rescheduled as string | null) ?? null,
  template_professional_cancelled: (row.template_professional_cancelled as string | null) ?? null,
  auto_reply_keywords: (row.auto_reply_keywords as string | null) ?? null,
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
  welcome_balcao: inst?.template_welcome_balcao || DEFAULT_TEMPLATES.welcome_balcao,
  first_contact: inst?.template_first_contact || DEFAULT_TEMPLATES.first_contact,
  professional_created: inst?.template_professional_created || DEFAULT_TEMPLATES.professional_created,
  professional_rescheduled: inst?.template_professional_rescheduled || DEFAULT_TEMPLATES.professional_rescheduled,
  professional_cancelled: inst?.template_professional_cancelled || DEFAULT_TEMPLATES.professional_cancelled,
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
  const [keywordsDraft, setKeywordsDraft] = useState<string>('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const savingTemplateRef = useRef(false);
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
          setKeywordsDraft(parsed.auto_reply_keywords ?? '');
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
        let errorMsg = funcData?.error;
        if (!errorMsg && funcError) {
          if ('context' in funcError && typeof (funcError as any).context?.json === 'function') {
            try {
              const body = await (funcError as any).context.json();
              if (body?.error) errorMsg = body.error;
            } catch {}
          }
          if (!errorMsg) errorMsg = funcError.message;
        }
        throw new Error(errorMsg || 'Erro ao inicializar a Instância WhatsApp da barbearia.');
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
  const templateValidation = validateWhatsappTemplate(activeDraftText, activeTab);
  const isLinkPresent = templateValidation.hasLink;

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
    if (savingTemplateRef.current) return;

    if (!instance) {
      addToast('Conecte ou ative o WhatsApp antes de salvar modelos.', 'warning');
      return;
    }

    if (!templateValidation.isValid) {
      addToast(
        templateValidation.errorMessage ||
          'O modelo excede o limite máximo permitido de 2000 caracteres.',
        'warning'
      );
      return;
    }

    try {
      savingTemplateRef.current = true;
      setSavingTemplate(true);
      const updatePayload: Record<string, unknown> = {
        [currentConfig.column]: activeDraftText.trim(),
        updated_at: new Date().toISOString(),
      };

      if (activeTab === 'first_contact') {
        updatePayload.auto_reply_keywords = keywordsDraft.trim() || null;
      }

      const { data, error } = await supabase
        .from('whatsapp_instances')
        .update(updatePayload)
        .eq('id', instance.id)
        .eq('tenant_id', tenant.tenantId)
        .select(WHATSAPP_INSTANCE_COLUMNS)
        .single();

      if (error) throw error;
      const updated = toWhatsappInstance(data);
      setInstance(updated);
      setTemplateDrafts(buildTemplateDrafts(updated));
      setKeywordsDraft(updated.auto_reply_keywords ?? '');
      addToast('Modelo de mensagem salvo com sucesso!', 'success');
    } catch (error: any) {
      console.error('Error saving template:', error);
      addToast(error?.message || 'Erro ao salvar modelo de mensagem.', 'error');
    } finally {
      savingTemplateRef.current = false;
      setSavingTemplate(false);
    }
  };

  const handleResetTemplate = () => {
    const defaultTemplate = DEFAULT_TEMPLATES[activeTab];
    setTemplateDrafts((prev) => ({
      ...prev,
      [activeTab]: defaultTemplate,
    }));
    addToast('Modelo restaurado para o padrão original.', 'info');
  };

  const handleSendTemplateTest = async () => {
    if (!instance) {
      addToast('WhatsApp não configurado.', 'warning');
      return;
    }

    const targetPhone = (testPhoneForTemplate || managerPhone).replace(/\D/g, '');
    if (!targetPhone || targetPhone.length < 10) {
      addToast('Informe um número de telefone de teste válido com DDD.', 'warning');
      return;
    }

    try {
      setSendingTemplateTest(true);
      const renderedMessage = interpolateTemplate(activeDraftText, {
        ...SAMPLE_MOCK_VARIABLES,
        barbearia: tenant.tenantName || 'Navalhado Club',
      });

      const { error } = await supabase.functions.invoke('whatsapp-integration/send-manual', {
        body: {
          tenant_id: instance.tenant_id,
          number: targetPhone,
          text: renderedMessage,
        },
      });

      if (error) throw error;
      addToast(`Mensagem de teste enviada com sucesso para ${targetPhone}!`, 'success');
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
    welcome_balcao: UserAdd01Icon,
    first_contact: Message01Icon,
    professional_created: ScissorIcon,
    professional_rescheduled: Calendar03Icon,
    professional_cancelled: Cancel01Icon,
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
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-extrabold text-text-primary tracking-[-0.02em]">Notificações de WhatsApp</h2>
        <p className="text-sm text-text-primary">Alerte seus clientes automaticamente sobre novos agendamentos, reagendamentos e lembretes de horários.</p>
      </div>

      {loading ? (
        <div className="text-center flex flex-col items-center justify-center gap-3 py-16 px-8 max-[640px]:py-10 max-[640px]:px-4 text-text-secondary border-[1.5px] border-dashed border-border/80 rounded-lg bg-white/25 backdrop-blur-md backdrop-saturate-[1.2] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
          <div className={SPINNER} />
          <p>Carregando status do serviço...</p>
        </div>
      ) : !instance ? (
        <div className="text-center flex flex-col items-center justify-center gap-3 py-16 px-8 max-[640px]:py-10 max-[640px]:px-4 text-text-secondary border-[1.5px] border-dashed border-border/80 rounded-lg bg-white/25 backdrop-blur-md backdrop-saturate-[1.2] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
          <div className="bg-brand-primary/10 text-brand-primary p-4 rounded-full flex items-center justify-center mb-2 shadow-sm">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <h4>WhatsApp desativado no momento</h4>
          <p>Para ativar os disparos automáticos e notificar seus clientes sobre horários agendados, ative a integração.</p>
          <button
            onClick={handleCreateInstance}
            disabled={actionLoading}
            className={`${BTN_PRIMARY} mt-6`}
          >
            {actionLoading ? <div className={SPINNER_SM} /> : 'Ativar Integração do WhatsApp'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* ═══ GRID PRINCIPAL: Status + Disparos ═══ */}
          <div className="grid grid-cols-2 gap-6 items-start max-[900px]:grid-cols-1">
            {/* ═══ Card: Status da Integração ═══ */}
            <div className="card-whatsapp bg-bg-secondary rounded-lg border border-border/50 shadow-[0_1px_3px_rgba(45,35,30,0.04),0_8px_24px_-8px_rgba(45,35,30,0.06)] transition-all duration-200 ease-in-out overflow-hidden hover:shadow-[0_1px_3px_rgba(45,35,30,0.04),0_16px_40px_-12px_rgba(45,35,30,0.1)] hover:border-brand-primary/[0.12]">
              <div className="flex justify-between items-start gap-4 px-6 pt-5 max-[640px]:px-4 max-[640px]:pt-4 max-[640px]:gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-text-primary m-0">Status da Integração</h3>
                </div>
                <span className={`text-xs font-extrabold py-1 px-[0.7rem] rounded-full uppercase tracking-[0.04em] whitespace-nowrap shrink-0 mt-1 ${STATUS_PILL_STYLES[instance.status]}`}>
                  {instance.status === 'connected' && 'Conectado'}
                  {instance.status === 'disconnected' && 'Desconectado'}
                  {(instance.status === 'connecting' || instance.status === 'pairing') && 'Pareando'}
                  {instance.status === 'hibernated' && 'Pausado'}
                </span>
              </div>

              <div className="pt-5 px-6 pb-6 flex flex-col gap-5 max-[640px]:p-4 max-[640px]:gap-4">
                <div className="flex flex-col gap-[0.4rem] bg-white/50 px-4 py-[0.85rem] rounded-md border border-border/50">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-xs font-semibold text-text-primary">Instância</span>
                    <code className="text-sm font-bold text-text-primary bg-white/80 px-[0.4rem] py-[0.15rem] rounded-sm border border-border/50 text-brand-primary">{instance.instance_name}</code>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-xs font-semibold text-text-primary">API</span>
                    <span className="text-sm font-bold text-success">Online</span>
                  </div>
                </div>

                {instance.status === 'disconnected' && (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-text-primary m-0 font-medium">Inicie o pareamento para conectar o celular da barbearia.</p>
                    <button onClick={handleConnect} disabled={actionLoading} className={BTN_PRIMARY}>
                      {actionLoading ? <div className={SPINNER_SM} /> : 'Gerar QR Code de Conexão'}
                    </button>
                  </div>
                )}

                {instance.status === 'hibernated' && (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-text-primary m-0 font-medium">A sessão está pausada, mas pode ser retomada sem novo QR Code.</p>
                    <button onClick={handleResume} disabled={actionLoading} className={BTN_PRIMARY}>
                      {actionLoading ? <div className={SPINNER_SM} /> : 'Retomar Sessão'}
                    </button>
                    <button onClick={handleDisconnect} disabled={actionLoading} className={BTN_OUTLINE_DANGER}>
                      Desconectar Aparelho
                    </button>
                  </div>
                )}

                {(instance.status === 'connecting' || instance.status === 'pairing') && (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <p className="text-sm font-extrabold text-brand-primary m-0">Leia o QR Code abaixo</p>
                    <p className="text-xs text-text-secondary leading-[1.4] font-medium m-0 max-w-[260px]">Abra o WhatsApp no seu celular, vá em <strong>Aparelhos Conectados &gt; Conectar um Aparelho</strong> e aponte a câmera.</p>
                    <div className="bg-white p-4 rounded-lg border border-border/70 shadow-[0_10px_25px_-5px_rgba(20,17,15,0.08)] w-[200px] h-[200px] flex items-center justify-center">
                      {instance.qr_code ? (
                        <img
                          src={instance.qr_code.startsWith('data:') ? instance.qr_code : `data:image/png;base64,${instance.qr_code}`}
                          alt="QR Code WhatsApp"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-xs text-text-secondary">
                          <div className="w-8 h-8 border-[3px] border-brand-primary border-t-transparent rounded-full animate-spin-fast motion-reduce:animate-none" />
                          <span>Gerando código...</span>
                        </div>
                      )}
                    </div>
                    <button onClick={handleDisconnect} disabled={actionLoading} className={BTN_OUTLINE_DANGER}>
                      {actionLoading ? <div className={SPINNER_SM} /> : 'Cancelar Pareamento'}
                    </button>
                  </div>
                )}

                {instance.status === 'connected' && (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="bg-success-bg/50 border-[1.5px] border-success/20 p-3 rounded-full flex items-center justify-center">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <path d="m9 11 3 3L22 4" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-text-primary m-0">Sistema pronto para enviar notificações!</p>
                    <button onClick={handleDisconnect} disabled={actionLoading} className={BTN_OUTLINE_DANGER}>
                      {actionLoading ? <div className={SPINNER_SM} /> : 'Desconectar Aparelho'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ Card: Configuração de Disparos ═══ */}
            <div className="card-whatsapp bg-bg-secondary rounded-lg border border-border/50 shadow-[0_1px_3px_rgba(45,35,30,0.04),0_8px_24px_-8px_rgba(45,35,30,0.06)] transition-all duration-200 ease-in-out overflow-hidden hover:shadow-[0_1px_3px_rgba(45,35,30,0.04),0_16px_40px_-12px_rgba(45,35,30,0.1)] hover:border-brand-primary/[0.12]">
              <div className="flex justify-between items-start gap-4 px-6 pt-5 max-[640px]:px-4 max-[640px]:pt-4 max-[640px]:gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-text-primary m-0">Configuração de Disparos</h3>
                </div>
              </div>
              <div className="pt-5 px-6 pb-6 flex flex-col gap-5 max-[640px]:p-4 max-[640px]:gap-4">
                <div className="flex flex-col gap-[0.65rem]">
                  <div className="rule-row flex items-center gap-[0.85rem] px-4 py-[0.85rem] rounded-lg shadow-[0_0_0_0.5px_var(--color-text-primary)] bg-white/40 transition-all duration-200 ease-in-out hover:bg-white/80 motion-reduce:transition-none">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-bg-secondary shadow-[0_0_0_0.5px_var(--color-text-primary)] text-text-primary shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-fit">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2z" />
                        <path d="M6 6V5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1" />
                        <path d="M6 6h12l1.5 11.5a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3L6 6z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-[0.1rem]">
                      <label htmlFor="send-confirmation" className="text-sm font-bold text-text-primary cursor-pointer">
                        Confirmação Automática
                      </label>
                      <span className="text-xs text-text-primary leading-[1.3] font-medium">Envia o link de agendamento por WhatsApp assim que o cliente reserva.</span>
                    </div>
                    <label className="relative inline-block w-10 h-6 shrink-0">
                      <input
                        id="send-confirmation"
                        type="checkbox"
                        checked={instance.send_confirmation}
                        onChange={(event) => handleUpdateConfig('send_confirmation', event.target.checked)}
                        className="peer w-0 h-0 opacity-0"
                      />
                      <span className="absolute inset-0 cursor-pointer rounded-full bg-border/80 transition-all duration-200 ease-in-out peer-checked:bg-brand-primary peer-focus-visible:shadow-[0_0_0_3px_rgba(217,108,0,0.18)] before:absolute before:bottom-[3px] before:left-[3px] before:w-[18px] before:h-[18px] before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgba(0,0,0,0.15)] before:content-[''] before:transition-all before:duration-200 before:ease-in-out peer-checked:before:translate-x-[16px] motion-reduce:transition-none motion-reduce:before:transition-none" />
                    </label>
                  </div>

                  <div className="rule-row flex flex-col items-stretch gap-3 px-4 py-[0.85rem] rounded-lg shadow-[0_0_0_0.5px_var(--color-text-primary)] bg-white/40 transition-all duration-200 ease-in-out hover:bg-white/80 motion-reduce:transition-none">
                    <div className="flex items-center gap-[0.85rem] w-full">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-bg-secondary shadow-[0_0_0_0.5px_var(--color-text-primary)] text-text-primary shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-fit">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-[0.1rem]">
                        <label htmlFor="send-reminders" className="text-sm font-bold text-text-primary cursor-pointer">
                          Lembretes de Agendamento
                        </label>
                        <span className="text-xs text-text-primary leading-[1.3] font-medium">Envia lembrete com opção de cancelamento antes do horário.</span>
                      </div>
                      <label className="relative inline-block w-10 h-6 shrink-0">
                        <input
                          id="send-reminders"
                          type="checkbox"
                          checked={instance.send_reminders}
                          onChange={(event) => handleUpdateConfig('send_reminders', event.target.checked)}
                          className="peer w-0 h-0 opacity-0"
                        />
                        <span className="absolute inset-0 cursor-pointer rounded-full bg-border/80 transition-all duration-200 ease-in-out peer-checked:bg-brand-primary peer-focus-visible:shadow-[0_0_0_3px_rgba(217,108,0,0.18)] before:absolute before:bottom-[3px] before:left-[3px] before:w-[18px] before:h-[18px] before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgba(0,0,0,0.15)] before:content-[''] before:transition-all before:duration-200 before:ease-in-out peer-checked:before:translate-x-[16px] motion-reduce:transition-none motion-reduce:before:transition-none" />
                      </label>
                    </div>

                    <div className="flex flex-col items-start gap-1 pl-[2.9rem] max-[640px]:pl-0 max-[640px]:pt-[0.35rem] max-[640px]:border-t max-[640px]:border-dashed max-[640px]:border-border/60 max-[640px]:w-full">
                      <div className="flex items-center gap-2 max-[640px]:w-full max-[640px]:justify-between">
                        <label htmlFor="reminder-hours" className="text-sm text-text-primary m-0 font-medium">
                          Tempo de antecedência do lembrete:
                        </label>
                        <select
                          id="reminder-hours"
                          aria-label="Tempo de antecedência do lembrete"
                          value={instance.reminder_hours}
                          onChange={(event) => handleUpdateConfig('reminder_hours', Number(event.target.value))}
                          disabled={!instance.send_reminders || actionLoading}
                          className="px-2 py-1 shadow-[0_0_0_0.888889px_var(--color-text-primary)] rounded-sm bg-bg-secondary text-text-primary text-sm disabled:cursor-not-allowed disabled:opacity-55 max-[640px]:min-h-11 max-[640px]:text-base"
                        >
                          {[1, 2, 3, 4, 6, 12, 24].map((hours) => (
                            <option key={hours} value={hours}>
                              {hours} {hours === 1 ? 'hora antes' : 'horas antes'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="text-info text-xs font-semibold tracking-[0.01em]">
                        Lembrete enviado {formatHoursToReadable(instance.reminder_hours)} antes do agendamento
                      </span>
                    </div>
                  </div>

                  <div className="rule-row flex items-center gap-[0.85rem] px-4 py-[0.85rem] rounded-lg shadow-[0_0_0_0.5px_var(--color-text-primary)] bg-white/40 transition-all duration-200 ease-in-out hover:bg-white/80 motion-reduce:transition-none">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-bg-secondary shadow-[0_0_0_0.5px_var(--color-text-primary)] text-text-primary shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-fit">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-[0.1rem]">
                      <label htmlFor="send-cancellation" className="text-sm font-bold text-text-primary cursor-pointer">
                        Alerta de Cancelamento
                      </label>
                      <span className="text-xs text-text-primary leading-[1.3] font-medium">Notifica se o barbeiro ou cliente cancelar o agendamento.</span>
                    </div>
                    <label className="relative inline-block w-10 h-6 shrink-0">
                      <input
                        id="send-cancellation"
                        type="checkbox"
                        checked={instance.send_cancellation}
                        onChange={(event) => handleUpdateConfig('send_cancellation', event.target.checked)}
                        className="peer w-0 h-0 opacity-0"
                      />
                      <span className="absolute inset-0 cursor-pointer rounded-full bg-border/80 transition-all duration-200 ease-in-out peer-checked:bg-brand-primary peer-focus-visible:shadow-[0_0_0_3px_rgba(217,108,0,0.18)] before:absolute before:bottom-[3px] before:left-[3px] before:w-[18px] before:h-[18px] before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgba(0,0,0,0.15)] before:content-[''] before:transition-all before:duration-200 before:ease-in-out peer-checked:before:translate-x-[16px] motion-reduce:transition-none motion-reduce:before:transition-none" />
                    </label>
                  </div>

                  <div className="rule-row flex items-center gap-[0.85rem] px-4 py-[0.85rem] rounded-lg shadow-[0_0_0_0.5px_var(--color-text-primary)] bg-white/40 transition-all duration-200 ease-in-out hover:bg-white/80 motion-reduce:transition-none">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-bg-secondary shadow-[0_0_0_0.5px_var(--color-text-primary)] text-text-primary shrink-0">
                      <HugeiconsIcon icon={UserAdd01Icon} size={16} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-[0.1rem]">
                      <label htmlFor="send-welcome-balcao" className="text-sm font-bold text-text-primary cursor-pointer">
                        Boas-Vindas de Balcão
                      </label>
                      <span className="text-xs text-text-primary leading-[1.3] font-medium">Envia link de autoatendimento para clientes cadastrados no balcão.</span>
                    </div>
                    <label className="relative inline-block w-10 h-6 shrink-0">
                      <input
                        id="send-welcome-balcao"
                        type="checkbox"
                        checked={instance.send_welcome_balcao}
                        onChange={(event) => handleUpdateConfig('send_welcome_balcao', event.target.checked)}
                        className="peer w-0 h-0 opacity-0"
                      />
                      <span className="absolute inset-0 cursor-pointer rounded-full bg-border/80 transition-all duration-200 ease-in-out peer-checked:bg-brand-primary peer-focus-visible:shadow-[0_0_0_3px_rgba(217,108,0,0.18)] before:absolute before:bottom-[3px] before:left-[3px] before:w-[18px] before:h-[18px] before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgba(0,0,0,0.15)] before:content-[''] before:transition-all before:duration-200 before:ease-in-out peer-checked:before:translate-x-[16px] motion-reduce:transition-none motion-reduce:before:transition-none" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SEÇÃO SPLIT VIEW: Personalização de Mensagens ═══ */}
          <div className="card-whatsapp template-editor-card flex flex-col border border-brand-primary/[0.18] bg-bg-secondary rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(45,35,30,0.04),0_8px_24px_-8px_rgba(45,35,30,0.06)] transition-all duration-200 ease-in-out hover:shadow-[0_1px_3px_rgba(45,35,30,0.04),0_16px_40px_-12px_rgba(45,35,30,0.1)]">
            <div className="pt-6 px-7 pb-2 max-[640px]:pt-4 max-[640px]:px-4 max-[640px]:pb-1">
              <div>
                <h3 className="text-lg font-extrabold text-text-primary m-0">Modelos de Mensagens do WhatsApp</h3>
                <p className="text-xs text-text-primary mt-1">
                  Configure o tom de voz e o formato das mensagens automáticas enviadas pela sua barbearia.
                </p>
              </div>
            </div>

            {/* Seletor de Abas de Eventos */}
            <div className="flex items-center gap-2 py-3 px-7 overflow-x-auto border-b border-border/60 bg-white/40 max-[640px]:py-2 max-[640px]:px-4 max-[640px]:gap-[0.35rem]" role="tablist" aria-label="Modelos de mensagens">
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
                    className={`inline-flex items-center gap-2 px-4 py-[0.6rem] rounded-md border border-transparent bg-transparent text-text-secondary text-xs font-bold cursor-pointer transition-all duration-200 ease-in-out whitespace-nowrap hover:bg-white/80 hover:text-text-primary max-[640px]:px-[0.85rem] max-[640px]:min-h-11 max-[640px]:justify-center motion-reduce:transition-none ${isActive ? 'bg-bg-secondary text-brand-primary border-brand-primary/20 shadow-sm' : ''}`}
                  >
                    <span className="flex items-center justify-center">{getEventIcon(config.key)}</span>
                    <span>{config.shortTitle}</span>
                  </button>
                );
              })}
            </div>

            <div className="template-split-view grid grid-cols-[1.15fr_0.85fr] gap-6 pt-6 px-7 pb-7 max-[960px]:grid-cols-1 max-[640px]:p-4 max-[640px]:gap-5" id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
              {/* Coluna Esquerda: Editor e Controles */}
              <div className="flex flex-col gap-5">
                <div>
                  <h4 className="text-base font-extrabold text-text-primary mb-[0.2rem]">{currentConfig.title}</h4>
                  <p className="text-xs text-text-primary leading-[1.4]">{currentConfig.description}</p>
                </div>

                {/* Barra de Chips de Tags Dinâmicas */}
                <div className="flex flex-col gap-[0.4rem]">
                  <span className="text-xs font-bold uppercase tracking-[0.05em] text-text-primary">Tags disponíveis (clique para inserir no texto):</span>
                  <div className="flex flex-wrap gap-[0.4rem]">
                    {currentConfig.availableTags.map((tagItem) => (
                      <button
                        key={tagItem.tag}
                        type="button"
                        onClick={() => handleInsertTag(tagItem.tag)}
                        className={`inline-flex items-center gap-[0.35rem] px-3 py-[0.4rem] min-h-9 rounded-sm border border-border/80 bg-bg-secondary text-text-primary text-xs cursor-pointer transition-all duration-200 ease-in-out touch-manipulation hover:border-brand-primary hover:bg-brand-lightest hover:-translate-y-px max-[480px]:px-3 max-[480px]:py-2 max-[480px]:min-h-11 max-[480px]:justify-center motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${tagItem.tag === '{link}' ? 'border-brand-primary/40 bg-[rgba(255,241,230,0.6)]' : ''}`}
                        title={tagItem.description}
                      >
                        <code className="text-brand-primary font-bold bg-brand-primary/[0.06] px-[0.3rem] py-[0.1rem] rounded-sm">{tagItem.tag}</code>
                        <span>{tagItem.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Palavras-chave de Ativação (se Primeiro Contato) */}
                {activeTab === 'first_contact' && (
                  <div className="mb-4">
                    <label htmlFor="auto-reply-keywords" className="block text-[0.8125rem] font-bold text-text-primary mb-[0.35rem]">
                      Palavras-chave de ativação (separadas por vírgula):
                    </label>
                    <input
                      id="auto-reply-keywords"
                      type="text"
                      value={keywordsDraft}
                      onChange={(e) => setKeywordsDraft(e.target.value)}
                      placeholder="Ex: agendar, marcar, horario, link, corte, barba, agenda, atendimento"
                      className="w-full py-[0.6rem] px-[0.85rem] rounded-md border border-border bg-bg-primary text-text-primary text-sm outline-none box-border"
                    />
                    <span className="block text-xs text-text-secondary mt-[0.35rem]">
                      Na primeira mensagem do dia, o robô responde uma vez mesmo sem palavra-chave. Depois disso, responde somente quando a mensagem contiver uma palavra configurada.
                    </span>
                  </div>
                )}

                {/* Textarea do Template */}
                <div className="flex flex-col gap-[0.35rem]">
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
                    className={`w-full px-4 py-[0.9rem] border rounded-md bg-bg-secondary text-text-primary text-sm font-[inherit] leading-[1.5] outline-none resize-y transition-all duration-200 ease-in-out focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.12)] motion-reduce:transition-none ${!templateValidation.isValid ? 'border-warning shadow-[0_0_0_3px_rgba(217,119,6,0.1)]' : 'border-border/80'}`}
                  />
                  <div className="flex justify-end">
                    <span className={`text-xs font-medium ${activeDraftText.length > 1800 ? 'text-warning font-bold' : 'text-text-secondary'}`}>
                      {activeDraftText.length} / 2000 caracteres
                    </span>
                  </div>
                </div>

                {/* Dica informativa sobre link opcional no primeiro contato */}
                {!isLinkPresent && currentConfig.audience === 'cliente' && (
                  <div
                    role="status"
                    className="flex items-start gap-2 py-[10px] px-3 bg-[rgba(2,132,199,0.08)] border border-[rgba(2,132,199,0.2)] rounded-md mt-[10px] text-[0.85rem] text-[#0369A1]"
                  >
                    <div className="shrink-0 mt-[2px] text-[#0284C7]">
                      <HugeiconsIcon icon={Alert02Icon} size={18} />
                    </div>
                    <div>
                      <strong className="text-xs block mb-[0.1rem]">Tag {'{link}'} opcional:</strong>
                      <p className="mt-0.5 mx-0 mb-0 leading-[1.4] text-xs">
                        Como este modelo não inclui a tag <code className="bg-white/60 px-[0.3rem] py-[0.1rem] rounded-sm font-bold">{'{link}'}</code>, o link de autoatendimento não será enviado neste evento. Para incluí-lo, adicione a tag ao modelo.
                      </p>
                    </div>
                  </div>
                )}

                {/* Ações do Editor */}
                <div className="flex justify-end gap-3 mt-2 max-[640px]:grid max-[640px]:grid-cols-2 max-[640px]:gap-2 max-[640px]:w-full max-[480px]:grid-cols-1">
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    disabled={savingTemplate}
                    className={`${BTN_OUTLINE} max-[640px]:w-full max-[640px]:min-h-11 max-[640px]:justify-center`}
                    title="Restaura o texto canônico de fábrica"
                  >
                    <HugeiconsIcon icon={RotateLeft01Icon} size={16} />
                    Restaurar Padrão
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate || !templateValidation.isValid}
                    className={`${BTN_PRIMARY} max-[640px]:w-full max-[640px]:min-h-11 max-[640px]:justify-center`}
                  >
                    {savingTemplate ? (
                      <div className={SPINNER_SM} />
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
              <div className="flex flex-col">
                <div className="bg-[#EFEAE2] rounded-lg border border-[rgba(200,190,180,0.6)] overflow-hidden shadow-[0_4px_18px_rgba(0,0,0,0.06)] flex flex-col">
                  {/* Cabeçalho do Celular */}
                  <div className="bg-[#005E54] text-white px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <HugeiconsIcon icon={SmartPhone01Icon} size={16} />
                    </div>
                    <div className="flex flex-col leading-[1.2]">
                      <span className="text-sm font-bold text-white">{tenant.tenantName || 'Navalhado Barbearia'}</span>
                      <span className="text-xs text-white/75">Online agora</span>
                    </div>
                  </div>

                  {/* Área de Conversa do WhatsApp */}
                  <div className="py-5 px-4 min-h-[220px] flex flex-col gap-3 bg-[#ECE5DD] bg-[radial-gradient(#d1c7bc_1px,transparent_1px)] bg-[length:16px_16px] max-[640px]:py-4 max-[640px]:px-3" role="region" aria-label="Simulador de tela do WhatsApp">
                    <div className="self-center bg-white/75 text-text-secondary text-xs font-bold px-[0.6rem] py-[0.2rem] rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.05)]">Hoje</div>
                    <div
                      className="whatsapp-balloon self-start max-w-[90%] max-[640px]:max-w-[95%] bg-white rounded-md rounded-tl-none px-[0.85rem] pt-[0.65rem] pb-[0.4rem] shadow-[0_1px_2px_rgba(0,0,0,0.12)] relative"
                      aria-live="polite"
                      aria-atomic="true"
                      aria-label="Prévia da mensagem formatada no WhatsApp"
                    >
                      <div
                        className="text-sm text-[#111B21] leading-[1.45] break-words [&_strong]:font-bold"
                        dangerouslySetInnerHTML={formatWhatsAppFormattedHtml(renderedPreviewText)}
                      />
                      <div className="flex items-center justify-end gap-1 mt-[0.35rem]">
                        <span className="text-xs text-[#667781]">
                          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="inline-flex text-[#53BDEB] -ml-0.5" aria-hidden="true">
                          <HugeiconsIcon icon={Tick02Icon} size={12} />
                          <HugeiconsIcon icon={Tick02Icon} size={12} />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé de Teste Rápido no WhatsApp Real */}
                  <div className="bg-bg-secondary px-4 py-[0.85rem] border-t border-border/60 flex flex-col gap-[0.4rem] max-[640px]:px-[0.85rem] max-[640px]:py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-text-secondary">Testar este modelo no seu celular:</span>
                      {managerPhone && testPhoneForTemplate !== managerPhone && (
                        <button
                          type="button"
                          className="bg-brand-primary/[0.08] text-brand-primary border border-brand-primary/20 rounded-sm text-xs font-bold px-[0.85rem] py-2 min-h-11 inline-flex items-center justify-center cursor-pointer transition-all duration-200 ease-in-out touch-manipulation hover:bg-brand-primary hover:text-white motion-reduce:transition-none"
                          onClick={() => setTestPhoneForTemplate(managerPhone)}
                          title="Usar o número do gerente logado"
                        >
                          Usar Meu WhatsApp
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 max-[480px]:flex-col max-[480px]:w-full">
                      <input
                        type="text"
                        placeholder="DDD + Número (ex: 11999999999)"
                        value={testPhoneForTemplate}
                        onChange={(e) => setTestPhoneForTemplate(e.target.value)}
                        className="flex-1 px-3 py-[0.45rem] border border-border/80 rounded-md text-xs outline-none text-text-primary focus:border-brand-primary max-[480px]:min-h-11 max-[480px]:text-base max-[480px]:w-full"
                      />
                      <button
                        type="button"
                        onClick={handleSendTemplateTest}
                        disabled={sendingTemplateTest || !templateValidation.isValid || !testPhoneForTemplate.trim()}
                        className="bg-brand-primary text-white px-[0.85rem] py-[0.45rem] text-xs inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all duration-200 ease-in-out border-none whitespace-nowrap rounded-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55 enabled:hover:bg-brand-hover enabled:hover:-translate-y-px max-[480px]:min-h-11 max-[480px]:w-full max-[480px]:justify-center motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
                        title="Enviar mensagem real para o número digitado"
                      >
                        {sendingTemplateTest ? (
                          <div className={SPINNER_SM} />
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
