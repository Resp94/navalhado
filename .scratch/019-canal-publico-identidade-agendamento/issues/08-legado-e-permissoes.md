# 08 — Desativação segura do legado e endurecimento de permissões

**What to build:** O novo fluxo se torna o único caminho público ativo, enquanto funções legadas são descontinuadas com compatibilidade controlada e permissões corrigidas.

**Blocked by:** 02 — Catálogo público e profissionais por serviço; 03 — Grade pública baseada no estabelecimento; 05 — Confirmação pública transacional com identidade correta; 06 — Cliente reconhecido com dados editáveis; 07 — Roteamento e manutenção da área do cliente.

**Status:** ready-for-agent

- [ ] Nenhum caminho público ativo depende da criação automática de cliente provisório.
- [ ] Fallbacks obsoletos são removidos ou explicitamente marcados como compatibilidade temporária documentada.
- [ ] Funções internas não ficam executáveis por roles públicas quando não houver necessidade.
- [ ] RPCs `SECURITY DEFINER` mantêm `search_path` seguro, referências qualificadas e grants explícitos.
- [ ] Dados legados vinculados a agendamentos, comandas ou lista de espera continuam preservados.
- [ ] Migrations são versionadas, reversíveis quando aplicável e testadas contra o schema atual.
- [ ] Existem testes negativos de autorização para anon, authenticated e service role conforme o contrato.
