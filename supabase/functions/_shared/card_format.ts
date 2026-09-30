// Formatos que as funcoes do banco aceitam para a bandeira e o final do cartao (record_card_change,
// apply_plan_change). O banco recusa (SQLSTATE 22023) o que vier fora deles, e uma operacao ja feita no
// Mercado Pago viraria erro: valor fora do formato e descartado antes de gravar.
export const validCardBrand = (value?: string): string | null => value && /^[A-Za-z0-9_]{1,40}$/.test(value) ? value : null;
export const validCardLast4 = (value?: string): string | null => value && /^[0-9]{4}$/.test(value) ? value : null;
