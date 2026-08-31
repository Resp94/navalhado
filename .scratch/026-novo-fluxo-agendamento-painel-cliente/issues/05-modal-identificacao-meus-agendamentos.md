# 05 — Modal de Identificação para Acesso a Meus Agendamentos

**What to build:**
Modal de identificação (ModalIdentificacaoCliente.tsx) acionado ao tocar na aba Meus agendamentos na barra inferior, solicitando Nome e WhatsApp para autenticação pública sem senha via iniciarSessaoPublica.

**Blocked by:** 01 — Cabeçalho Limpo, Catálogo de Serviços e Bottom Nav

**Status:** ready-for-agent

- [ ] Criar ModalIdentificacaoCliente.tsx com campos de Nome e WhatsApp
- [ ] Integrar chamada a canalClienteRepository.iniciarSessaoPublica
- [ ] Redirecionar para /cliente/menu em caso de sucesso ou exibir toast informativo
