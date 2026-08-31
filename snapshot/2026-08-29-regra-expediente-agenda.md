# Snapshot operacional — regra de expediente e escala na Agenda

**Data e horário da validação:** 29/08/2026 12:55 (America/Manaus)  
**Commit de referência:** `a176ed7` (`dev`)  
**Working tree:** sem alterações rastreadas nesta validação; já existiam arquivos não rastreados em `specs/023-agenda-grade-mensageria/` e `verificacoes/`.

## Regra funcional confirmada

- O horário de funcionamento da barbearia define os limites máximos permitidos para a Agenda.
- A escala individual do profissional define o horário efetivo exibido dentro desses limites.
- A Agenda não deve expandir a escala do barbeiro apenas porque o expediente geral da barbearia é mais amplo.
- Dias inativos no expediente geral não devem exibir horários normais.
- A regra vale para datas passadas, atuais e futuras, respeitando o dia da semana selecionado.

## Evidências

### PROD

- Validação visual somente leitura na rota `/agenda` pelo navegador integrado.
- Sábado: expediente da barbearia persistido como `08:00–22:00`.
- Escala do profissional ativo persistida como `09:00–18:00`.
- A Agenda exibiu horários a partir de `09:00`, com último início normal em `17:40`, coerente com a escala individual e o intervalo configurado.
- O mesmo comportamento foi conferido no dia anterior, no sábado atual e no próximo dia útil.
- Domingo inativo não exibiu horários normais.

### DEV

- Consulta somente leitura no banco de desenvolvimento.
- Sábado: expediente da barbearia persistido como `08:00–20:00`.
- Profissionais ativos consultados com escala de `09:00–18:00`.
- Os dados confirmam a mesma regra de composição: expediente geral como limite e escala individual como horário efetivo.

## Implementação preservada

- `getEffectiveProfessionalDaySchedule` calcula a interseção entre a escala do profissional e o expediente da barbearia.
- A geração de slots da Agenda utiliza essa escala efetiva para o profissional selecionado.
- Não foram alterados código, banco, migrations ou Edge Functions nesta validação.

## Validações executadas

- Inspeção visual da Agenda em PROD para dia passado, atual e futuro: **✅ aprovado**.
- Consulta de persistência de `business_hours` e `weekly_schedule` em DEV/PROD: **✅ aprovado**.
- Inspeção da regra compartilhada de geração da grade: **✅ aprovado**.

## Limitação conhecida

- Não foi executado salvamento de uma nova configuração durante esta validação, para evitar alteração de dados sem uma correção em escopo. A evidência registra o comportamento já persistido e publicado.

