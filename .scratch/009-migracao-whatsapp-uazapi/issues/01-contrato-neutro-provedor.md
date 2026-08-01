# 01 — Extrair o contrato neutro do provedor

**What to build:** Preparar o gateway de WhatsApp para depender de um único contrato interno independente de provedor, preservando temporariamente o comportamento observável existente. O trabalho deve tornar a troca para Uazapi localizada e segura, sem apagar ou sobrescrever alterações não commitadas já presentes na integração e em seus testes.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] O gateway oferece um contrato único para criar instância, conectar, consultar status, desconectar, configurar webhook e enviar texto.
- [x] Rotas HTTP, triggers, cron e frontend continuam dependendo somente do gateway, sem conhecer contratos externos.
- [x] A implementação atual permanece funcional por trás do novo contrato durante esta etapa de prefatoração.
- [x] Erros externos são convertidos para uma resposta interna consistente e sem credenciais.
- [x] O seam permite simular o provedor nos testes do handler HTTP.
- [x] As alterações não commitadas preexistentes são preservadas e incorporadas conscientemente.
- [x] Testes existentes da integração continuam passando.
