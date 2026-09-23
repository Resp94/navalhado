# Spec 042 — Sidebar compartilhada no desktop do barbeiro

## Problem Statement

A spec 041 padronizou o portal do barbeiro no celular: header e navegação inferior iguais aos do gestor. O desktop ficou de fora. Depois de logar num computador, o barbeiro cai num cabeçalho superior fixo com navegação horizontal, enquanto o gestor tem a sidebar retrátil.

São duas navegações desenhadas separadamente para o mesmo produto. A do barbeiro tem logo, nome da barbearia, sininho de notificações, avatar, nome, cargo e botão Sair montados à mão dentro do próprio layout; a sidebar do gestor já resolve tudo isso. Qualquer ajuste de identidade visual precisa ser feito duas vezes, e a versão do barbeiro tende a ficar para trás — foi exatamente o que aconteceu com o mobile antes da 041.

A sidebar de hoje também não é reaproveitável. A lista de rotas é uma constante fixa dentro do componente, com as dez telas do gestor; as props falam em "gerente"; e o componente importa o tipo do contexto do layout do gestor, invertendo a dependência — o componente compartilhado depende de quem o usa.

## Solution

O barbeiro passa a navegar pela mesma sidebar do gestor no desktop, mostrando apenas as duas telas que ele tem: Minha Agenda e Minhas Comissões.

A sidebar deixa de conhecer rotas. Ela recebe a lista de itens, o caminho da tela inicial, o nome e a logo da barbearia, o nome e o papel do usuário. Cada layout passa a sua lista. O componente não sabe mais quem é gestor e quem é barbeiro.

O cabeçalho superior do desktop sai do layout do barbeiro. Sininho, identidade e Sair passam a viver no rodapé da sidebar, como já vivem para o gestor. O celular não muda em nada: header e navegação inferior seguem como a 041 deixou.

## User Stories

### Navegação do barbeiro no desktop

1. Como barbeiro, quero navegar pela mesma barra lateral que o gestor usa, para a experiência ser a mesma em qualquer computador da barbearia.
2. Como barbeiro, quero ver na barra lateral só Minha Agenda e Minhas Comissões, para não me oferecerem telas que não posso abrir.
3. Como barbeiro, quero recolher e expandir a barra lateral, e quero que ela volte do mesmo jeito na próxima visita.
4. Como barbeiro, quero ver o nome e a logo da barbearia na barra lateral, e voltar para a Minha Agenda clicando neles.
5. Como barbeiro, quero ver minhas notificações e sair da conta pela barra lateral, como faço hoje pelo cabeçalho.
6. Como barbeiro, quero que a tela ganhe a altura que o cabeçalho ocupava, para ver mais da agenda de uma vez.

### Continuidade

7. Como barbeiro, quero que o celular continue exatamente como está, com header e navegação inferior.
8. Como gestor, quero que a minha barra lateral continue igual, com as mesmas dez telas, os mesmos ícones e o mesmo comportamento de recolher.

### Qualidade e manutenção

9. Como pessoa desenvolvedora, quero uma única barra lateral no código, para uma mudança de identidade visual valer para todos os papéis de uma vez.
10. Como pessoa desenvolvedora, quero que a barra lateral não conheça as rotas de nenhum papel, para acrescentar um papel novo sem editá-la.
11. Como pessoa desenvolvedora, quero que a barra lateral não dependa do layout do gestor, para a dependência apontar do layout para o componente, nunca o contrário.

## Implementation Decisions

### Sidebar compartilhada

- A sidebar recebe a lista de itens de navegação por propriedade. A constante com as rotas do gestor sai do componente e passa a morar no layout do gestor; o layout do barbeiro define a sua.
- Cada item de navegação declara caminho, rótulo, ícone e se deve ficar ativo também nas subrotas. Hoje esse "também nas subrotas" está escrito no componente com os caminhos de Equipe e Financeiro citados por nome; vira uma marcação do próprio item.
- A sidebar recebe o caminho da tela inicial, usado ao clicar na logo. Hoje é a Agenda Geral, fixa no componente.
- A sidebar recebe nome e logo da barbearia como valores soltos, em vez do contexto do layout do gestor. Some o import invertido.
- A sidebar recebe o nome do usuário e o papel dele. O papel é usado no rótulo de acessibilidade da navegação. O rodapé continua mostrando só o nome, como para o gestor: esta spec não introduz cargo no rodapé.
- A preferência de recolhida/expandida continua sendo uma só, compartilhada entre os papéis. Nenhum usuário tem dois papéis.

### Layout do barbeiro

- O cabeçalho superior do desktop sai inteiro, com a navegação horizontal, o sininho, o bloco de identidade e o botão Sair. A sidebar assume tudo.
- A área de conteúdo passa a ser irmã da sidebar, seguindo o mesmo arranjo do layout do gestor, e perde a largura máxima centralizada que existia por causa do cabeçalho.
- Navegação do barbeiro: Minha Agenda e Minhas Comissões, com os ícones que a navegação horizontal já usa. Nenhum item fica ativo em subrotas — o barbeiro não tem subrotas.
- O barbeiro não ganha a gaveta "Mais" do celular do gestor. O celular continua como está.

### Módulos tocados

- A sidebar compartilhada, o layout do gestor e o layout do barbeiro. Nada de banco, repositório ou rota.

## Testing Decisions

- Um bom teste verifica comportamento pela porta pública (tela), não detalhe interno.
- **Testes de tela da sidebar**: com a lista do gestor, as dez telas aparecem e a navegação leva à rota certa; com a lista do barbeiro, só Minha Agenda e Minhas Comissões aparecem e nenhuma rota de gestor vaza. Recolher e expandir continua gravando a preferência, e Sair continua chamando quem o layout passou.
- **Testes de tela dos layouts**: os testes atuais do layout do gestor e do layout do barbeiro continuam verdes. O do barbeiro ganha a verificação de que a navegação do desktop é a barra lateral, com os dois itens dele.
- **Verificação no navegador**: login como barbeiro, recolher e expandir, os dois itens navegam, Sair funciona, e o celular continua com header e navegação inferior.
- `npm run lint`, `npm test` e `npm run build` passam.
- Prior art: os testes atuais da sidebar e dos dois layouts.

## Out of Scope

- Qualquer mudança no celular de qualquer papel.
- Acrescentar telas à navegação do barbeiro, ou mexer nas telas Minha Agenda e Minhas Comissões.
- A gaveta "Mais" do celular do gestor para o barbeiro.
- Mostrar o cargo no rodapé da barra lateral, para gestor ou barbeiro.
- A navegação do painel do proprietário (admin SaaS), que segue como está.
- Redesenho visual da barra lateral. Ela muda de dono das rotas, não de aparência.

## Further Notes

- A 041 tratou o desktop do barbeiro como fora de escopo ao padronizar só o celular. Esta spec fecha essa ponta.
- A sidebar importa hoje o tipo do contexto do layout do gestor. Trocar isso por valores soltos é o que torna o componente reusável; sem essa troca, o layout do barbeiro precisaria fabricar um contexto de gestor só para satisfazer o tipo.
