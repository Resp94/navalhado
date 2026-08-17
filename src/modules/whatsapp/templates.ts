export type WhatsappTemplateKey =
  | 'confirmation'
  | 'reschedule'
  | 'cancellation'
  | 'reminder'
  | 'first_contact';

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
    | 'template_first_contact';
  title: string;
  shortTitle: string;
  description: string;
  availableTags: TemplateTag[];
}

export const DEFAULT_TEMPLATES: Record<WhatsappTemplateKey, string> = {
  confirmation:
    'Olá, {cliente}! Seu agendamento na *{barbearia}* foi confirmado!\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Profissional: *{profissional}*\n\nPara gerenciar seu agendamento (reagendar/cancelar), acesse: {link}\n\nObrigado!',
  reschedule:
    'Olá, {cliente}! Seu reagendamento na *{barbearia}* foi confirmado!\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Profissional: *{profissional}*\n\nPara gerenciar seu agendamento (reagendar/cancelar), acesse: {link}\n\nObrigado!',
  cancellation:
    'Olá, {cliente}! Seu agendamento na *{barbearia}* foi cancelado.\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Profissional: *{profissional}*\n\nSe precisar, você pode agendar um novo horário acessando: {link}\n\nAgradecemos a compreensão!',
  reminder:
    'Olá, {cliente}! Passando para lembrar do seu agendamento na *{barbearia}* nas próximas horas.\n\n📅 Data: *{data} às {horario}*\n✂️ Serviço: *{servico}*\n👤 Profissional: *{profissional}*\n\nPara confirmar, cancelar ou ver detalhes do agendamento, acesse: {link}\n\nEsperamos você!',
  first_contact:
    'Olá, {cliente}! Para escolher seu serviço e agendar um horário na *{barbearia}*, acesse: {link}',
};

export const TEMPLATE_TAGS: Record<string, TemplateTag> = {
  cliente: { tag: '{cliente}', label: 'Cliente', description: 'Nome do cliente' },
  barbearia: { tag: '{barbearia}', label: 'Barbearia', description: 'Nome da barbearia' },
  servico: { tag: '{servico}', label: 'Serviço', description: 'Nome do serviço agendado' },
  profissional: { tag: '{profissional}', label: 'Profissional', description: 'Nome do profissional' },
  data: { tag: '{data}', label: 'Data', description: 'Data formatada (ex: 18/08/2026)' },
  horario: { tag: '{horario}', label: 'Horário', description: 'Horário do atendimento (ex: 14:30)' },
  link: { tag: '{link}', label: 'Link do Canal', description: 'Link de autoatendimento do cliente' },
};

const APPOINTMENT_TAGS: TemplateTag[] = [
  TEMPLATE_TAGS.cliente,
  TEMPLATE_TAGS.barbearia,
  TEMPLATE_TAGS.servico,
  TEMPLATE_TAGS.profissional,
  TEMPLATE_TAGS.data,
  TEMPLATE_TAGS.horario,
  TEMPLATE_TAGS.link,
];

const FIRST_CONTACT_TAGS: TemplateTag[] = [
  TEMPLATE_TAGS.cliente,
  TEMPLATE_TAGS.barbearia,
  TEMPLATE_TAGS.link,
];

export const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    key: 'confirmation',
    column: 'template_confirmation',
    title: 'Confirmação de Agendamento',
    shortTitle: 'Confirmação',
    description: 'Enviada automaticamente assim que o cliente conclui uma nova reserva.',
    availableTags: APPOINTMENT_TAGS,
  },
  {
    key: 'reschedule',
    column: 'template_reschedule',
    title: 'Confirmação de Reagendamento',
    shortTitle: 'Reagendamento',
    description: 'Enviada quando o horário ou dia do agendamento é remarcado.',
    availableTags: APPOINTMENT_TAGS,
  },
  {
    key: 'cancellation',
    column: 'template_cancellation',
    title: 'Alerta de Cancelamento',
    shortTitle: 'Cancelamento',
    description: 'Enviada caso o agendamento seja desmarcado pela barbearia ou pelo cliente.',
    availableTags: APPOINTMENT_TAGS,
  },
  {
    key: 'reminder',
    column: 'template_reminder',
    title: 'Lembrete Pré-Atendimento',
    shortTitle: 'Lembrete',
    description: 'Disparada X horas antes do atendimento para reduzir faltas (no-show).',
    availableTags: APPOINTMENT_TAGS,
  },
  {
    key: 'first_contact',
    column: 'template_first_contact',
    title: 'Boas-Vindas / Primeiro Contato',
    shortTitle: 'Primeiro Contato',
    description: 'Resposta automática quando um cliente chama a barbearia pelo WhatsApp pela 1ª vez.',
    availableTags: FIRST_CONTACT_TAGS,
  },
];

export interface WhatsappTemplateVariables {
  cliente?: string;
  barbearia?: string;
  servico?: string;
  profissional?: string;
  data?: string;
  horario?: string;
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
    if (Object.prototype.hasOwnProperty.call(variables, lowerKey) && variables[lowerKey] !== undefined) {
      return variables[lowerKey] as string;
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
 * Valida se o template contém a tag `{link}` (obrigatória para todos os fluxos de autoatendimento).
 */
export const validateTemplateHasLink = (template: string): boolean => {
  if (!template) return false;
  return /\{link\}/i.test(template);
};

/**
 * Executa a validação completa de domínio do template de notificação.
 */
export const validateWhatsappTemplate = (template: string): WhatsappTemplateValidationResult => {
  const text = template || '';
  const length = text.length;
  const hasLink = validateTemplateHasLink(text);
  const isWithinLengthLimit = length <= MAX_TEMPLATE_LENGTH;

  let errorMessage: string | null = null;
  if (!hasLink) {
    errorMessage = 'A mensagem precisa conter a tag {link} para que o cliente consiga acessar o agendamento.';
  } else if (!isWithinLengthLimit) {
    errorMessage = `O modelo excede o limite máximo permitido de ${MAX_TEMPLATE_LENGTH} caracteres.`;
  }

  return {
    isValid: hasLink && isWithinLengthLimit,
    hasLink,
    isWithinLengthLimit,
    length,
    maxLength: MAX_TEMPLATE_LENGTH,
    errorMessage,
  };
};
