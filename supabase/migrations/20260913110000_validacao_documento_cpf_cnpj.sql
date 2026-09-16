-- Ticket 05 da spec 035: validacao de CPF e CNPJ alfanumerico.
-- Spec: specs/035-plano-de-contas-categorias-e-fornecedores/spec.md,
-- secao "Entrega 2 -- Fornecedores", item "Documento".
--
-- Autoridade do banco sobre o documento do Fornecedor (ticket 06): funcao
-- privada e imutavel, apta a restricao de verificacao de coluna, para que
-- nenhuma escrita futura grave documento invalido. A funcao pura
-- documentoValido (src/modules/plano-contas/documento.ts) implementa o mesmo
-- algoritmo para retorno imediato na tela; as duas sao cobertas pelo mesmo
-- conjunto de vetores (28_plano_de_contas.test.sql e documento.test.ts).
--
-- Recebe o documento JA NORMALIZADO (sem mascara, letras maiusculas), que e a
-- forma gravada. A normalizacao da entrada cabe a quem grava (RPC do ticket 06).
-- Regras:
--   * 11 caracteres: CPF, somente digitos, dois digitos verificadores oficiais.
--   * 14 caracteres: CNPJ, 12 posicoes 0-9A-Z e dois digitos verificadores
--     numericos. Valor de cada caractere = codigo ASCII - 48, com os pesos do
--     CNPJ numerico (CNPJ alfanumerico da Receita Federal, julho de 2026). Um
--     CNPJ so com digitos se comporta exatamente como o antigo.
--   * Qualquer outro comprimento e invalido; sequencia de um unico caractere
--     repetido e invalida, embora passe no calculo.
--   * Nulo devolve false; a coluna opcional trata nulo na propria restricao
--     (`document is null or private.is_valid_br_document(document)`).
--
-- Nenhuma tabela e criada ou alterada.
create or replace function private.is_valid_br_document(p_document text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $function$
declare
  v_length integer;
  v_body_length integer;
  v_sum integer;
  v_remainder integer;
  v_check_digit integer;
begin
  if p_document is null then
    return false;
  end if;

  v_length := length(p_document);

  if v_length = 11 then
    if p_document !~ '^[0-9]{11}$' then
      return false;
    end if;
  elsif v_length = 14 then
    if p_document !~ '^[0-9A-Z]{12}[0-9]{2}$' then
      return false;
    end if;
  else
    return false;
  end if;

  if p_document ~ '^(.)\1*$' then
    return false;
  end if;

  -- Primeiro digito verificador sobre as posicoes anteriores a ele; o segundo,
  -- sobre essas posicoes mais o primeiro digito.
  for v_body_length in (v_length - 2)..(v_length - 1) loop
    v_sum := 0;
    for v_position in 1..v_body_length loop
      v_sum := v_sum
        + (ascii(substr(p_document, v_position, 1)) - 48)
        * case
            -- CPF: pesos decrescentes ate 2 (10..2 e depois 11..2).
            when v_length = 11 then v_body_length - v_position + 2
            -- CNPJ: pesos 2..9 ciclicos a partir da direita.
            else ((v_body_length - v_position) % 8) + 2
          end;
    end loop;

    v_remainder := v_sum % 11;
    v_check_digit := case when v_remainder < 2 then 0 else 11 - v_remainder end;

    if v_check_digit <> ascii(substr(p_document, v_body_length + 1, 1)) - 48 then
      return false;
    end if;
  end loop;

  return true;
end;
$function$;

comment on function private.is_valid_br_document(text) is
  'Valida CPF (11 digitos) ou CNPJ (14 caracteres, alfanumerico incluso) ja normalizado. Spec 035, ticket 05.';

revoke all on function private.is_valid_br_document(text) from public, anon, authenticated;
grant execute on function private.is_valid_br_document(text) to service_role;
