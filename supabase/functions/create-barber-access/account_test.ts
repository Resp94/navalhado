import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createUnconfirmedAccount, type CreateUnconfirmedAccountDeps } from "./account.ts";

// Spec 047, ticket 10: o Acesso do barbeiro passa a nascer nao confirmado
// (email_confirm: false) e a Edge Function dispara o link de confirmacao
// via auth.resend(type: 'signup') -- caminho provado no spike do ticket 09.

Deno.test("cria a conta com email_confirm:false e dispara o reenvio de confirmacao", async () => {
  const chamadas: unknown[] = [];
  const deps: CreateUnconfirmedAccountDeps = {
    createUser: (params) => {
      chamadas.push({ op: "createUser", params });
      return Promise.resolve({ data: { user: { id: "user-1" } }, error: null });
    },
    resend: (params) => {
      chamadas.push({ op: "resend", params });
      return Promise.resolve({ error: null });
    },
  };

  const result = await createUnconfirmedAccount(deps, {
    email: "barbeiro@gmail.com",
    password: "SenhaForte123!",
    name: "Carlos",
  });

  assertEquals(result, { userId: "user-1", createError: null, resendError: null });
  assertEquals(chamadas, [
    {
      op: "createUser",
      params: {
        email: "barbeiro@gmail.com",
        password: "SenhaForte123!",
        email_confirm: false,
        user_metadata: { name: "Carlos" },
      },
    },
    { op: "resend", params: { type: "signup", email: "barbeiro@gmail.com" } },
  ]);
});

Deno.test("nao chama resend quando createUser falha", async () => {
  let resendChamado = false;
  const deps: CreateUnconfirmedAccountDeps = {
    createUser: () =>
      Promise.resolve({ data: { user: null }, error: { message: "email ja existe" } }),
    resend: () => {
      resendChamado = true;
      return Promise.resolve({ error: null });
    },
  };

  const result = await createUnconfirmedAccount(deps, {
    email: "barbeiro@gmail.com",
    password: "SenhaForte123!",
    name: "Carlos",
  });

  assertEquals(result, { userId: null, createError: "email ja existe", resendError: null });
  assertEquals(resendChamado, false);
});

Deno.test("createUser sem usuario (sem erro explicito) tambem e tratado como falha", async () => {
  const deps: CreateUnconfirmedAccountDeps = {
    createUser: () => Promise.resolve({ data: { user: null }, error: null }),
    resend: () => Promise.resolve({ error: null }),
  };

  const result = await createUnconfirmedAccount(deps, {
    email: "barbeiro@gmail.com",
    password: "SenhaForte123!",
    name: "Carlos",
  });

  assertEquals(result.userId, null);
  assertEquals(result.createError, "unknown error");
});

Deno.test("conta e criada mesmo quando o reenvio de confirmacao falha (nunca trava a criacao do acesso)", async () => {
  const deps: CreateUnconfirmedAccountDeps = {
    createUser: () => Promise.resolve({ data: { user: { id: "user-2" } }, error: null }),
    resend: () => Promise.resolve({ error: { message: "SMTP fora do ar" } }),
  };

  const result = await createUnconfirmedAccount(deps, {
    email: "barbeiro@gmail.com",
    password: "SenhaForte123!",
    name: "Carlos",
  });

  assertEquals(result, { userId: "user-2", createError: null, resendError: "SMTP fora do ar" });
});
