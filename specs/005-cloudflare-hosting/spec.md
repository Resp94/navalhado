# Especificação: Hospedagem no Cloudflare Pages e Roteamento SPA

## Problem Statement

O aplicativo **Navalhado** (SaaS de barbearias) precisa ser entregue aos usuários finais (barbearias e seus clientes) com o máximo de desempenho, latência ultra-baixa e segurança (SSL/DDoS) a um custo viável. 

Atualmente, sendo um aplicativo React estruturado como uma SPA (Single Page Application), o roteamento é realizado inteiramente no lado do cliente (via `react-router-dom`). Quando o aplicativo é hospedado em um provedor estático sem configurações específicas, qualquer tentativa de acessar diretamente uma sub-rota profunda (como `/configuracoes` ou `/agendamento?token=xyz`) ou de recarregar a página resulta em um erro HTTP 404 (Not Found) retornado pelo servidor de borda, já que esses arquivos físicos não existem no diretório de build.

Além disso, o processo de injeção de variáveis de ambiente públicas (Supabase URL e Anon Key) no build de produção precisa ser transparente e gerenciado de forma segura fora do código-fonte para evitar vazamento de credenciais locais.

## Solution

Hospedar o frontend estático do Navalhado no **Cloudflare Pages**, aproveitando a rede de borda (Edge) global da Cloudflare.

Para resolver o problema de roteamento SPA, será configurada uma regra universal de redirecionamento (`_redirects`) na raiz do build. Isso garante que qualquer requisição que não corresponda a um arquivo estático físico (como imagens, fontes, CSS ou JS) seja redirecionada internamente para o `index.html` com o status HTTP 200. Com isso, o roteador do React é carregado e lida com a URL solicitada de forma suave.

O gerenciamento de configurações de build e ambiente será mantido declarativamente no repositório através do Wrangler, enquanto as variáveis de ambiente reais serão inseridas através do painel de controle do Cloudflare Pages no momento do build remoto.

## User Stories

1. **Como cliente da barbearia**, quero acessar a página de agendamento diretamente pelo link com token único enviado pelo WhatsApp, para que eu possa agendar meu horário sem ver erros de "página não encontrada".
2. **Como cliente da barbearia**, quero que o fluxo de agendamento carregue instantaneamente (latência ultra-baixa), para que eu possa selecionar o serviço e o barbeiro rapidamente.
3. **Como gerente ou proprietário da barbearia**, quero poder atualizar ou recarregar o painel administrativo na rota `/configuracoes` no meu navegador, para que eu não perca o contexto de trabalho por causa de um erro 404 do servidor.
4. **Como desenvolvedor do SaaS**, quero que o deploy do aplicativo aconteça de forma 100% automatizada toda vez que eu enviar código para a ramificação principal (main) do Git, para que eu reduza o esforço manual e evite erros humanos.
5. **Como proprietário do SaaS**, quero que a infraestrutura web seja protegida nativamente contra ataques automatizados e DDoS, para que o sistema de agendamento das barbearias parceiras não sofra interrupções.
6. **Como desenvolvedor do SaaS**, quero que as variáveis do cliente Supabase sejam injetadas com segurança no build final na nuvem sem precisar expor segredos locais ou cometer chaves no repositório de código público.

## Implementation Decisions

- **Build SPA Estático**: O frontend do projeto continuará sendo compilado como um SPA estático utilizando o empacotador Vite.
- **Redirecionamento Coringa (Wildcard)**: Será introduzido um arquivo de mapeamento de rotas na pasta pública do projeto. Esse arquivo deve mapear qualquer requisição inexistente `/*` para o ponto de entrada principal `/index.html` mantendo o status HTTP 200.
- **Configuração Declarativa do Provedor**: Criar um arquivo de configuração do Wrangler na raiz do repositório para documentar e padronizar o diretório de build (`dist`) e a compatibilidade do Pages.
- **Variáveis em Tempo de Compilação**: A definição e injeção do `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` serão configuradas no painel da Cloudflare e injetadas pelo Vite no momento do build na nuvem.

## Testing Decisions

- **Validação de Roteamento SPA local**:
  - Testar o build local (`npm run build`) para verificar se as regras de redirecionamento são geradas na pasta final `dist/`.
  - Executar um servidor local de pré-visualização simulando o comportamento de redirecionamento para garantir que rotas diretas não retornem erros.
- **Garantia de Comportamento Externo**: Os testes automatizados da aplicação (Vitest) devem rodar com sucesso e não podem ser afetados pela adição dos arquivos de configuração da hospedagem.

## Out of Scope

- Configuração de domínios personalizados e subdomínios (multitenancy via subdomínio na Cloudflare) nesta etapa.
- Migração das Supabase Edge Functions para Cloudflare Workers locais (o backend e as triggers continuam hospedados no Supabase).
- Autenticação e segurança no nível da Cloudflare (WAF avançado ou Cloudflare Access) para o painel administrativo.

## Further Notes

- O arquivo `_redirects` é lido nativamente pelo Cloudflare Pages e é a alternativa mais eficiente em termos de latência e consumo, pois evita a necessidade de rodar uma Cloudflare Worker (Pages Function) apenas para reescrever a URL.
