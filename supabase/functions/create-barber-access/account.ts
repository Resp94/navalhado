// Spec 047, ticket 10: criacao de conta nao confirmada para o Acesso do
// barbeiro. O gerente continua definindo e-mail e senha; a conta nasce com
// email_confirm:false, e disparamos o reenvio de confirmacao do tipo
// 'signup' -- caminho provado no spike do ticket 09. O e-mail nunca chega a
// travar a criacao do acesso: uma falha no reenvio so fica registrada
// (console.warn); o barbeiro/gerente ainda pode usar "Reenviar link" no
// Login depois.

export interface CreateUserResult {
  data: { user: { id: string } | null };
  error: { message: string } | null;
}

export interface ResendResult {
  error: { message: string } | null;
}

export interface CreateUnconfirmedAccountDeps {
  createUser: (params: {
    email: string;
    password: string;
    email_confirm: boolean;
    user_metadata: Record<string, unknown>;
  }) => Promise<CreateUserResult>;
  resend: (params: { type: "signup"; email: string }) => Promise<ResendResult>;
}

export interface CreateUnconfirmedAccountParams {
  email: string;
  password: string;
  name: string;
}

export interface CreateUnconfirmedAccountResult {
  userId: string | null;
  createError: string | null;
  resendError: string | null;
}

export async function createUnconfirmedAccount(
  deps: CreateUnconfirmedAccountDeps,
  params: CreateUnconfirmedAccountParams
): Promise<CreateUnconfirmedAccountResult> {
  const { data: created, error: createError } = await deps.createUser({
    email: params.email,
    password: params.password,
    email_confirm: false,
    user_metadata: { name: params.name },
  });

  if (createError || !created.user) {
    return { userId: null, createError: createError?.message ?? "unknown error", resendError: null };
  }

  const { error: resendError } = await deps.resend({ type: "signup", email: params.email });
  if (resendError) {
    console.warn(`[create-barber-access] falha ao reenviar confirmação para ${params.email}:`, resendError.message);
  }

  return { userId: created.user.id, createError: null, resendError: resendError?.message ?? null };
}
