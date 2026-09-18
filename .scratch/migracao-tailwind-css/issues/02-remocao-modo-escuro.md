# 02: Remoção do modo escuro

**What to build:** o app deixa de suportar tema escuro. A classe `.dark-theme` (aplicada hoje via JS/contexto em 33 arquivos) e toda a lógica que a alterna são removidas, junto com qualquer controle de interface (toggle, opção de configuração) que hoje alterna entre claro e escuro. O app fica exclusivamente no tema claro que já é o padrão.

**Blocked by:** None (can start immediately — independente da Fundação Tailwind, é remoção de CSS/JS vanilla existente)

**Status:** done

- [x] Nenhuma ocorrência de `.dark-theme` resta no código (classe, seletor CSS condicionado a ela, lógica de toggle)
- [x] Nenhum controle de UI de alternância de tema resta visível ou funcional
- [x] Regras CSS que hoje só existiam para o tema escuro são removidas (não apenas desativadas)
- [x] Testes que cobriam exclusivamente comportamento de `.dark-theme` são removidos; testes que cobriam outro comportamento e só citavam a classe de passagem são ajustados, não apagados
- [x] `npm run dev`, `npm run build` e `npm run test` continuam passando
- [x] Verificação manual: todas as telas principais (Agenda, Financeiro, Clientes, Whatsapp, Relatórios) abrem no tema claro sem diferença visual em relação a antes deste ticket
