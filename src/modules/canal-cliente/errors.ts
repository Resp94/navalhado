export class CanalClienteTokenError extends Error {
  constructor(message: string = 'Acesso expirado ou token inválido. Por favor, solicite um novo link via WhatsApp.') {
    super(message);
    this.name = 'CanalClienteTokenError';
  }
}

export class CanalClienteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanalClienteValidationError';
  }
}

export class AgendamentoConflitoError extends Error {
  constructor(message: string = 'O horário selecionado não está mais disponível. Por favor, escolha outro horário.') {
    super(message);
    this.name = 'AgendamentoConflitoError';
  }
}

export class AgendamentoRegraCancelamentoError extends Error {
  constructor(message: string = 'Não foi possível cancelar o agendamento devido às regras do estabelecimento.') {
    super(message);
    this.name = 'AgendamentoRegraCancelamentoError';
  }
}

/**
 * A barbearia está bloqueada por assinatura (spec 052, ticket 04): o servidor recusa criar e
 * reagendar pelo Canal do Cliente. Cancelar e ver os próprios agendamentos continuam valendo.
 */
export class AgendamentoOnlineIndisponivelError extends Error {
  constructor(message: string = 'Agendamento online indisponível no momento. Entre em contato diretamente com o estabelecimento.') {
    super(message);
    this.name = 'AgendamentoOnlineIndisponivelError';
  }
}

/** A recusa do servidor por bloqueio da barbearia. Vem antes de qualquer leitura de "indisponível". */
export const ehRecusaPorBloqueioDaBarbearia = (error: { message?: string } | null | undefined): boolean =>
  Boolean(error?.message?.includes('ONLINE_BOOKING_UNAVAILABLE'));
