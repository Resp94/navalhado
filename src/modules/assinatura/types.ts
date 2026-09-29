// Estado de Acesso da barbearia (spec 052, ticket 03). O banco calcula; o front só lê.
export type NivelDeAcesso = 'liberado' | 'aviso' | 'bloqueado';

/** Motivos que o banco devolve junto com o estado (private.subscription_access_state). */
export type MotivoDeAcesso =
  | 'trial'
  | 'trial_expired'
  | 'active'
  | 'payment_failed'
  | 'canceled'
  | 'courtesy'
  | 'courtesy_expired'
  | 'blocked'
  | 'no_subscription';

export interface EstadoDeAcesso {
  acesso: NivelDeAcesso;
  motivo: MotivoDeAcesso;
  /** Fim do teste, data do bloqueio ou fim do período pago, conforme o motivo. */
  dataRelevante: Date | null;
}

/** Quem vê a tela: o Gerente pode agir (pagar); o Barbeiro só recebe a explicação. */
export type PerfilNoBloqueio = 'gerente' | 'barbeiro';

export type EstadoDeAcessoStatus = 'loading' | 'ready' | 'error';

/** Assinatura criada no Mercado Pago (spec 052, ticket 05): o Gerente conclui no link. */
export interface AssinaturaCriada {
  linkDePagamento: string;
  assinaturaId: string;
  /** Data da primeira cobrança, ou nulo quando a cobrança é imediata. */
  primeiraCobrancaEm: Date | null;
}

export interface IAssinaturaAdapter {
  /** Estado da barbearia de quem está logado, ou nulo se o usuário não tem barbearia. */
  obterEstadoDeAcesso(): Promise<EstadoDeAcesso | null>;
  /** Cria a assinatura da barbearia de quem está logado (só o Gerente consegue) e devolve o link de pagamento. */
  assinar(): Promise<AssinaturaCriada>;
}
