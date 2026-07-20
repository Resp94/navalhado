# ADR 005: Hospedagem do Frontend no Cloudflare Pages

## Status

Aceito

## Data

2026-07-20

## Contexto

A plataforma **Navalhado** precisa entregar a melhor experiência de agendamento e administração de barbearias, com excelente tempo de carregamento e alta disponibilidade. Como o frontend do projeto é desenvolvido como uma SPA (Single Page Application) em Vite/React com roteamento baseado no lado do cliente (React Router), hospedar o build estático sem regras apropriadas de infraestrutura resulta em falhas de navegação (erros 404) quando usuários acessam rotas profundas ou recarregam suas telas diretamente.

Adicionalmente, necessitamos de automação no processo de deploy e de proteção integrada contra ameaças comuns e DDoS.

## Decisão

Adotar o **Cloudflare Pages** como a plataforma de hospedagem e distribuição oficial do frontend da aplicação:

1. **Roteamento SPA nativo**: Inserir o arquivo `_redirects` contendo a regra de mapeamento global (`/* /index.html 200`) para que a Cloudflare direcione todas as rotas dinâmicas ao ponto de entrada da SPA de forma transparente.
2. **Configuração Declarativa**: Criar o arquivo `wrangler.toml` na raiz do projeto contendo as instruções oficiais da Cloudflare para identificar o diretório de build (`dist`) e compatibilidade.
3. **Deploy Automatizado (GitOps)**: Conectar o repositório Git ao painel do Cloudflare Pages para disparar compilações automáticas a cada alteração aprovada na ramificação principal.
4. **Variáveis de Ambiente**: Configurar as variáveis do cliente Supabase (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) diretamente no console de variáveis de ambiente da Cloudflare, mantendo os segredos de deploy isolados de comissões de código locais.

## Alternativas consideradas

1. **Hospedagem em VPS tradicional com Nginx/Apache**: Exigiria manutenção de infraestrutura, setup de SSL manual e maior latência de rede. Rejeitado devido à complexidade operacional e custos de manutenção desnecessários para um frontend estático.
2. **Cloudflare Workers (Pages Functions)**: Usar funções de borda dinâmicas para reescrever as URLs do roteador. Rejeitado por adicionar complexidade e latência adicionais que são totalmente evitadas pelo mapeamento estático e nativo do arquivo `_redirects`.

## Consequências

- Latência ultrabaixa para clientes e profissionais do Navalhado devido à distribuição por CDN global.
- Deploys automáticos sem a necessidade de intervenção do desenvolvedor.
- Fim de problemas de erros 404 em recarregamentos de páginas administrativas e links diretos de agendamento gerados no WhatsApp.
