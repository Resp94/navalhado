import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isValidEmailFormat, verifyEmailDomain } from "./email.ts";

// Spec 047, ticket 04: mesma regra de formato do front (src/lib/email.ts) e
// do banco (public.email_valido). Tabela de casos identica as duas.
const CASES: [string, boolean][] = [
  ["joao@gmail.com", true],
  ["JOAO@GMAIL.COM", true],
  ["joao.silva@empresa.com.br", true],
  ["joao.silva+agenda@empresa.com.br", true],
  ["joao_silva@empresa.com", true],
  ["joao-mail@sub.dominio.com.br", true],
  ["j@ab.co", true],
  ["joao123@dominio123.com", true],
  ["jon@email.com", true],
  ["a.b.c@dominio.com", true],
  ["jon@x", false],
  ["jon@x.c", false],
  ["jon..a@x.com", false],
  [".jon@x.com", false],
  ["jon.@x.com", false],
  ["jon@-x.com", false],
  ["jon@x-.com", false],
  ["jon @x.com", false],
  ["jon@@x.com", false],
  ["jon@x..com", false],
  ["jonx.com", false],
  ["", false],
];

for (const [email, esperado] of CASES) {
  Deno.test(`isValidEmailFormat("${email}") === ${esperado}`, () => {
    assertEquals(isValidEmailFormat(email), esperado);
  });
}

// Spec 047, ticket 08: verificação de domínio (MX) via DNS-over-HTTPS.
// Mesma política do front (src/lib/__tests__/email.test.ts): Cloudflare
// primeiro, Google como reserva, timeout individual libera o e-mail.

function dnsResponse(status: number, answers: { type: number; data: string }[] = []): Response {
  const body = JSON.stringify({
    Status: status,
    Answer: answers.map((a) => ({ name: "x", type: a.type, TTL: 300, data: a.data })),
  });
  return new Response(body, { status: 200 });
}

function withMockedFetch(impl: (url: string) => Promise<Response>, run: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => impl(String(input))) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

Deno.test('verifyEmailDomain retorna "valido" quando o domínio tem registro MX', async () => {
  await withMockedFetch(
    () => Promise.resolve(dnsResponse(0, [{ type: 15, data: "10 mail.dominio-mx-ok.example." }])),
    async () => {
      assertEquals(await verifyEmailDomain("dominio-mx-ok.example"), "valido");
    }
  );
});

Deno.test('verifyEmailDomain retorna "sem_mx" para NXDOMAIN (Status 3)', async () => {
  await withMockedFetch(
    () => Promise.resolve(dnsResponse(3)),
    async () => {
      assertEquals(await verifyEmailDomain("dominio-inexistente.example"), "sem_mx");
    }
  );
});

Deno.test('verifyEmailDomain retorna "sem_mx" para MX nulo (RFC 7505)', async () => {
  await withMockedFetch(
    () => Promise.resolve(dnsResponse(0, [{ type: 15, data: "0 ." }])),
    async () => {
      assertEquals(await verifyEmailDomain("dominio-mx-nulo.example"), "sem_mx");
    }
  );
});

Deno.test("verifyEmailDomain usa o Google como reserva quando a Cloudflare falha", async () => {
  let chamadas = 0;
  await withMockedFetch(
    (url) => {
      chamadas++;
      if (url.includes("cloudflare-dns.com")) return Promise.reject(new Error("cloudflare fora"));
      return Promise.resolve(dnsResponse(0, [{ type: 15, data: "10 mail.dominio-fallback.example." }]));
    },
    async () => {
      assertEquals(await verifyEmailDomain("dominio-fallback.example"), "valido");
      assertEquals(chamadas, 2);
    }
  );
});

Deno.test('verifyEmailDomain retorna "indisponivel" quando Cloudflare e Google falham', async () => {
  await withMockedFetch(
    () => Promise.reject(new Error("fora do ar")),
    async () => {
      assertEquals(await verifyEmailDomain("dominio-indisponivel.example"), "indisponivel");
    }
  );
});
