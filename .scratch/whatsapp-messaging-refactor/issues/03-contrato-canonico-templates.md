# 03 — Contrato canônico de templates

**What to build:** Um template configurado pela equipe é validado, armazenado, normalizado e renderizado de forma consistente entre a interface e o WhatsApp, sem exibir tokens não resolvidos e sem quebrar templates legados.

**Blocked by:** 01 — Seam de despacho e baseline de regressão

**Status:** done

- [x] O vocabulário canônico inclui `{cliente}`, `{servico}`, `{dias}`, `{barbearia}`, `{profissional}`, `{data}`, `{horario}` e `{link}`.
- [x] Templates legados de retorno continuam sendo aceitos por meio de aliases normalizados.
- [x] Um template salvo na interface de serviços usa os mesmos tokens reconhecidos pelo dispatcher.
- [x] Variáveis disponíveis são interpoladas corretamente em mensagens de cliente e profissional.
- [x] Tokens desconhecidos ou variáveis obrigatórias ausentes impedem o envio e registram erro sanitizado.
- [x] A regra atual de link automático na primeira mensagem diária permanece preservada.
- [x] Testes cobrem template padrão, customizado, legado, incompleto e com token desconhecido.
