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
