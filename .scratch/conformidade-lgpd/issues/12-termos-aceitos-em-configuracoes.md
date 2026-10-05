# 12: Configurações mostra a versão aceita dos termos e os links

Parte da spec 055 (Conformidade com os novos Termos e Política).

**What to build:** a tela Configurações do Gerente ganha a seção "Termos e privacidade", com:

- a versão aceita dos termos e a data do aceite;
- os links "Termos de Uso" e "Política de Privacidade", para as páginas do ticket 05.

A leitura usa o módulo `termos`, com um método novo no repositório que lê o último aceite do próprio usuário.

Hoje o Gerente que já aceitou não relê os textos no painel (limitação do ticket 16 da 052).

**Blocked by:** 05 (para os links; antes dele, os links podem abrir o modal)

**Status:** ready

- [ ] `TermosRepository` e os dois adaptadores com o método novo; testes contra o `InMemoryTermosAdapter`
- [ ] Vitest da seção: com aceite, mostra a versão e a data; sem aceite, mostra "Ainda não aceito"
- [ ] Gates de lint, Vitest e build passam
