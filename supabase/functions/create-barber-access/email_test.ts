import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isValidEmailFormat } from "./email.ts";

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
