# Relatório de responsividade: encaixe e caixa

**Data:** 02/09/2026  
**Escopo:** somente front-end  
**Alvo:** iPhone 12 e viewports de 320px a 390px

## Resumo

O drawer de novo encaixe tinha overflow horizontal porque o card de configuração tentava acomodar conteúdo redundante, switch e checkbox em uma única linha. Os controles de data do caixa também não protegiam suficientemente o conteúdo interno em telas estreitas.

## Correções

- Removidos o aviso redundante e o badge “Ativo” do encaixe.
- Mantida a indicação contextual de horário passado.
- Encurtados os rótulos do switch para “Grade” e “Personalizado”.
- Aplicado grid responsivo ao card e aos campos do formulário.
- Garantidos `min-width: 0`, `max-width: 100%` e ausência de overflow horizontal no modal.
- Ajustado o resumo diário do caixa para respeitar margens e espaço disponível no mobile.

## Preservação funcional

Nenhuma regra de negócio, chamada ao banco, migration ou estado do formulário foi alterado. O switch continua alternando entre grade e horário personalizado, e o checkbox continua controlando o encaixe.

## Checklist manual

- [ ] 320px portrait sem rolagem horizontal.
- [ ] 390px portrait com drawer de encaixe aberto.
- [ ] iPhone 12 físico com grade e personalizado.
- [ ] Caixa com intervalo de datas e sessão selecionados.
- [ ] Desktop sem alteração visual indevida.
