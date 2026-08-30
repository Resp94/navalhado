# Checklist Playwright — Spec 023: Agenda e disponibilidade

**Objetivo:** implementar testes E2E Playwright para a Agenda interna, configurações do profissional e contrato de disponibilidade.

## Preparação do projeto

- [ ] Adicionar Playwright somente conforme o padrão aprovado do projeto, sem substituir os testes Vitest existentes.
- [ ] Criar configuração com `E2E_BASE_URL` apontando exclusivamente para DEV.
- [ ] Carregar as credenciais somente de `docs/credenciais_teste.md`.
- [ ] Garantir que credenciais não sejam copiadas para código, fixtures, screenshots, traces ou logs.
- [ ] Se houver alteração de banco, criar migration versionada com timestamp, descrição e próximo sufixo numérico sequencial (`082` → `083`), sem reutilizar número.
- [ ] Aplicar e validar a migration somente no banco DEV via MCP.
- [ ] Criar fixtures isoladas de tenant, profissional, serviço, bloqueio e appointment.
- [ ] Derivar expectativas das configurações carregadas na fixture; não hardcodar horários ou intervalos na implementação do teste.
- [ ] Usar dados descartáveis/isolados e limpar somente os registros criados pelo teste.
- [ ] Garantir que o teste não envie mensagens reais.

## Configuração e limites

- [ ] Abrir a edição da escala do profissional.
- [ ] Confirmar que abertura e fechamento disponíveis vêm do tenant.
- [ ] Configurar intervalo profissional `12:00–14:00` com grade de 40 minutos.
- [ ] Salvar e reabrir o cadastro, confirmando os mesmos horários exatos.
- [ ] Confirmar que os seletores não arredondam para `12:20` ou `14:20`.
- [ ] Rejeitar escala fora da abertura/fechamento do tenant.
- [ ] Rejeitar intervalo fora da abertura/fechamento do tenant.
- [ ] Rejeitar início de intervalo igual ou posterior ao fim.

## Grade e pausa

- [ ] Configurar dinamicamente um tenant com retorno de pausa às `15:00` e verificar que o primeiro slot após a pausa é o retorno.
- [ ] Verificar que os slots seguintes avançam pelo intervalo configurado.
- [ ] Repetir com retorno às `14:00` e confirmar que a sequência muda sem regra fixa.
- [ ] Confirmar que o início do profissional define a origem da cadência efetiva, sem ultrapassar os limites do tenant.
- [ ] Confirmar que o fim do profissional filtra slots posteriores.
- [ ] Confirmar que um dia fechado no tenant não fica disponível por causa da escala profissional.
- [ ] Confirmar que `Tanto faz` compõe a união das grades dos profissionais compatíveis, respeitando o início efetivo de cada um.

## Duração, conflitos e fechamento

- [ ] Testar serviço com duração base dinâmica.
- [ ] Testar duração personalizada do profissional e confirmar que ela prevalece.
- [ ] Criar conflito com appointment e confirmar remoção do slot.
- [ ] Criar conflito com bloqueio e confirmar remoção do slot.
- [ ] Testar serviço que cruza uma pausa e confirmar indisponibilidade.
- [ ] Confirmar que a antecedência mínima é aplicada no dia atual.
- [ ] Confirmar que datas futuras respeitam apenas a configuração aplicável.
- [ ] Confirmar que o último início é menor que o fechamento do tenant/profissional.
- [ ] Confirmar que um serviço iniciado antes do fechamento pode terminar depois dele.
- [ ] Confirmar que não aparece início exatamente no fechamento.

## Integração e regressão

- [ ] Comparar no teste o resultado da Agenda com o contrato de disponibilidade retornado pelo Supabase.
- [ ] Confirmar que a duração usada no término é a mesma usada na detecção de conflito.
- [ ] Confirmar que alteração de configuração do tenant muda o resultado sem alterar o teste.
- [ ] Executar todos os cenários somente em DEV; não executar contra produção.
- [ ] Anexar trace, screenshot e configurações usadas em falhas.

## Critério de conclusão

- [ ] Todos os cenários passam com valores dinâmicos.
- [ ] Nenhum teste depende de constante de horário específica.
- [ ] Nenhum teste altera produção.
