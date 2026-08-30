import { TEMPLATE_TAG_ALIASES } from '../../../supabase/functions/whatsapp-integration/whatsapp_template_contract.ts';

export type WhatsappTemplateKey =
  | 'confirmation'
  | 'reschedule'
  | 'cancellation'
  | 'reminder'
  | 'welcome_balcao'
  | 'first_contact'
  | 'professional_created'
  | 'professional_rescheduled'
  | 'professional_cancelled';

/**
 * Mapeamento canônico bidirecional entre nomes de eventos da Edge Function/Banco e chaves de templates da UI.
 */
export const EVENT_TO_TEMPLATE_KEY_MAP: Record<string, WhatsappTemplateKey> = {
  appointment_created: 'confirmation',
  appointment_rescheduled: 'reschedule',
  appointment_updated: 'reschedule',
  appointment_cancelled: 'cancellation',
  appointment_reminder: 'reminder',
  customer_welcome_balcao: 'welcome_balcao',
  first_contact: 'first_contact',
  professional_appointment_created: 'professional_created',
  professional_appointment_rescheduled: 'professional_rescheduled',
  professional_appointment_cancelled: 'professional_cancelled',
};

export interface TemplateTag {
  tag: string;
  label: string;
  description: string;
}

export interface TemplateConfig {
  key: WhatsappTemplateKey;
  column:
    | 'template_confirmation'
    | 'template_reschedule'
    | 'template_cancellation'
    | 'template_reminder'
    | 'template_welcome_balcao'
    | 'template_first_contact'
    | 'template_professional_created'
    | 'template_professional_rescheduled'
    | 'template_professional_cancelled';
  title: string;
  shortTitle: string;
  description: string;
  audience: 'cliente' | 'equipe';
  availableTags: TemplateTag[];
}

export const DEFAULT_TEMPLATES: Record<WhatsappTemplateKey, string> = {
  confirmation:
    'Olá, {cliente}! Seu agendamento na *{barbearia}* foi confirmado!\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Profissional: *{profissional}*\n💰 Valor: *{valor}*\n\nPara gerenciar seu agendamento (reagendar/cancelar), acesse: {link}\n\nObrigado!',
  reschedule:
    'Olá, {cliente}! Seu reagendamento na *{barbearia}* foi confirmado!\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Profissional: *{profissional}*\n\nPara gerenciar seu agendamento (reagendar/cancelar), acesse: {link}\n\nObrigado!',
  cancellation:
    'Olá, {cliente}! Seu agendamento na *{barbearia}* foi cancelado.\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Profissional: *{profissional}*\n\nSe precisar, você pode agendar um novo horário acessando: {link}\n\nAgradecemos a compreensão!',
  reminder:
    'Olá, {cliente}! Passando para lembrar do seu agendamento na *{barbearia}* nas próximas horas.\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Profissional: *{profissional}*\n\nPara confirmar, cancelar ou ver detalhes do agendamento, acesse: {link}\n\nEsperamos você!',
  welcome_balcao:
    'Olá, {cliente}! Seu cadastro na barbearia *{barbearia}* foi concluído com sucesso. Acesse seu canal de autoatendimento para agendar seus próximos cortes e conferir nosso cardápio de serviços: {link}',
  first_contact:
    'Olá, {cliente}! Para escolher seu serviço e agendar um horário na *{barbearia}*, acesse: {link}',
  professional_created:
    'Olá, {profissional}! Você tem um novo agendamento na *{barbearia}*!\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Cliente: *{cliente}*',
  professional_rescheduled:
    'Olá, {profissional}! O agendamento de *{cliente}* na *{barbearia}* foi reagendado!\n\n📅 Novo Horário: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Cliente: *{cliente}*',
  professional_cancelled:
    'Olá, {profissional}! O agendamento de *{cliente}* na *{barbearia}* foi cancelado.\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Cliente: *{cliente}*',
};

export const TEMPLATE_TAGS: Record<string, TemplateTag> = {
  cliente: { tag: '{cliente}', label: 'Cliente', description: 'Nome do cliente' },
  barbearia: { tag: '{barbearia}', label: 'Barbearia', description: 'Nome da barbearia' },
  servico: { tag: '{servico}', label: 'Serviço', description: 'Nome do serviço agendado' },
  profissional: { tag: '{profissional}', label: 'Profissional', description: 'Nome do profissional' },
  data: { tag: '{data}', label: 'Data', description: 'Data formatada (ex: 18/08/2026)' },
  horario: { tag: '{horario}', label: 'Horário', description: 'Horário do atendimento (ex: 14:30)' },
  valor: { tag: '{valor}', label: 'Valor', description: 'Valor do serviço em reais (ex: R$ 80,00)' },
  link: { tag: '{link}', label: 'Link do Canal', description: 'Link de autoatendimento do cliente' },
};

export { TEMPLATE_TAG_ALIASES };

const APPOINTMENT_TAGS: TemplateTag[] = [
  TEMPLATE_TAGS.cliente,
  TEMPLATE_TAGS.barbearia,
  TEMPLATE_TAGS.servico,
  TEMPLATE_TAGS.profissional,
  TEMPLATE_TAGS.data,
  TEMPLATE_TAGS.horario,
  TEMPLATE_TAGS.link,
];

const CONFIRMATION_TAGS: TemplateTag[] = [
  TEMPLATE_TAGS.cliente,
  TEMPLATE_TAGS.barbearia,
  TEMPLATE_TAGS.servico,
  TEMPLATE_TAGS.profissional,
  TEMPLATE_TAGS.data,
  TEMPLATE_TAGS.horario,
  TEMPLATE_TAGS.valor,
  TEMPLATE_TAGS.link,
];

const WELCOME_BALCAO_TAGS: TemplateTag[] = [
  TEMPLATE_TAGS.cliente,
  TEMPLATE_TAGS.barbearia,
  TEMPLATE_TAGS.link,
];

const FIRST_CONTACT_TAGS: TemplateTag[] = [
  TEMPLATE_TAGS.cliente,
  TEMPLATE_TAGS.barbearia,
  TEMPLATE_TAGS.link,
];

const PROFESSIONAL_TAGS: TemplateTag[] = [
  TEMPLATE_TAGS.profissional,
  TEMPLATE_TAGS.cliente,
  TEMPLATE_TAGS.barbearia,
  TEMPLATE_TAGS.servico,
  TEMPLATE_TAGS.data,
  TEMPLATE_TAGS.horario,
];

export const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    key: 'confirmation',
    column: 'template_confirmation',
    title: 'Confirmação de Agendamento',
    shortTitle: 'Confirmação',
    description: 'Enviada automaticamente assim que o cliente conclui uma nova reserva.',
    audience: 'cliente',
    availableTags: CONFIRMATION_TAGS,
  },
  {
    key: 'reschedule',
    column: 'template_reschedule',
    title: 'Confirmação de Reagendamento',
    shortTitle: 'Reagendamento',
    description: 'Enviada quando o horário ou dia do agendamento é remarcado.',
    audience: 'cliente',
    availableTags: APPOINTMENT_TAGS,
  },
  {
    key: 'cancellation',
    column: 'template_cancellation',
    title: 'Alerta de Cancelamento',
    shortTitle: 'Cancelamento',
    description: 'Enviada caso o agendamento seja desmarcado pela barbearia ou pelo cliente.',
    audience: 'cliente',
    availableTags: APPOINTMENT_TAGS,
  },
  {
    key: 'reminder',
    column: 'template_reminder',
    title: 'Lembrete Pré-Atendimento',
    shortTitle: 'Lembrete',
    description: 'Disparada X horas antes do atendimento para reduzir faltas (no-show).',
    audience: 'cliente',
    availableTags: APPOINTMENT_TAGS,
  },
  {
    key: 'welcome_balcao',
    column: 'template_welcome_balcao',
    title: 'Boas-Vindas de Balcão',
    shortTitle: 'Boas-Vindas Balcão',
    description: 'Enviada exclusivamente quando um novo cliente é cadastrado manualmente pela equipe.',
    audience: 'cliente',
    availableTags: WELCOME_BALCAO_TAGS,
  },
  {
    key: 'first_contact',
    column: 'template_first_contact',
    title: 'Primeiro Contato / Autoatendimento',
    shortTitle: 'Primeiro Contato',
    description: 'Resposta automática quando um cliente chama a barbearia pelo WhatsApp pela 1ª vez.',
    audience: 'cliente',
    availableTags: FIRST_CONTACT_TAGS,
  },
  {
    key: 'professional_created',
    column: 'template_professional_created',
    title: 'Equipe: Novo Agendamento',
    shortTitle: 'Novo Agendamento',
    description: 'Notificação enviada ao WhatsApp do barbeiro quando um horário é marcado em sua agenda.',
    audience: 'equipe',
    availableTags: PROFESSIONAL_TAGS,
  },
  {
    key: 'professional_rescheduled',
    column: 'template_professional_rescheduled',
    title: 'Equipe: Reagendamento',
    shortTitle: 'Reagendamento Equipe',
    description: 'Notificação enviada ao barbeiro quando um cliente remarca a data ou horário do serviço.',
    audience: 'equipe',
    availableTags: PROFESSIONAL_TAGS,
  },
  {
    key: 'professional_cancelled',
    column: 'template_professional_cancelled',
    title: 'Equipe: Agendamento Cancelado',
    shortTitle: 'Cancelamento Equipe',
    description: 'Notificação enviada ao barbeiro quando um agendamento é desmarcado.',
    audience: 'equipe',
    availableTags: PROFESSIONAL_TAGS,
  },
];

export interface WhatsappTemplateVariables {
  cliente?: string;
  barbearia?: string;
  servico?: string;
  profissional?: string;
  data?: string;
  horario?: string;
  valor?: string;
  link?: string;
  [key: string]: string | undefined;
}

export const SAMPLE_MOCK_VARIABLES: WhatsappTemplateVariables = {
  cliente: 'Lucas Silva',
  barbearia: 'Navalhado Club',
  servico: 'Corte Degradê & Barba',
  profissional: 'Carlos Barbeiro',
  data: '18/08/2026',
  horario: '14:30',
  valor: 'R$ 80,00',
  link: 'https://dev.navalhado.com.br/cliente/demo-acesso',
};

/**
 * Substitui todas as tags dinâmicas no formato `{tag}` pelos valores informados.
 * Se a tag não existir no mapa de variáveis, mantém o token intacto (preserveUnknown=true)
 * para garantir paridade exata com o gateway de envio da Edge Function.
 */
export const interpolateTemplate = (
  template: string,
  variables: WhatsappTemplateVariables,
  preserveUnknown = true
): string => {
  if (!template) return '';
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const lowerKey = key.toLowerCase();
    const canonicalKey = TEMPLATE_TAG_ALIASES[lowerKey] || lowerKey;
    if (Object.prototype.hasOwnProperty.call(variables, canonicalKey) && variables[canonicalKey] !== undefined) {
      return variables[canonicalKey] as string;
    }
    return preserveUnknown ? match : '';
  });
};

/**
 * Limite máximo seguro de caracteres para modelos de mensagem do WhatsApp.
 */
export const MAX_TEMPLATE_LENGTH = 2000;

export interface WhatsappTemplateValidationResult {
  isValid: boolean;
  hasLink: boolean;
  isWithinLengthLimit: boolean;
  length: number;
  maxLength: number;
  errorMessage: string | null;
}

/**
 * Informa se o template contém a tag opcional `{link}`.
 * A ausência é válida e significa que o link não será incluído no texto personalizado.
 */
export const validateTemplateHasLink = (template: string): boolean => {
  if (!template) return false;
  return /\{link\}/i.test(template);
};

/**
 * Executa a validação completa de domínio do template de notificação.
 */
export const validateWhatsappTemplate = (
  template: string,
  key?: WhatsappTemplateKey
): WhatsappTemplateValidationResult => {
  const text = template || '';
  const length = text.length;
  const isTeamTemplate =
    key === 'professional_created' ||
    key === 'professional_rescheduled' ||
    key === 'professional_cancelled';

  const hasLink = isTeamTemplate ? true : validateTemplateHasLink(text);
  const isWithinLengthLimit = length <= MAX_TEMPLATE_LENGTH;

  let errorMessage: string | null = null;
  if (!isWithinLengthLimit) {
    errorMessage = `O modelo excede o limite máximo permitido de ${MAX_TEMPLATE_LENGTH} caracteres.`;
  }

  return {
    isValid: isWithinLengthLimit,
    hasLink,
    isWithinLengthLimit,
    length,
    maxLength: MAX_TEMPLATE_LENGTH,
    errorMessage,
  };
};
