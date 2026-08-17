/**
 * Utilitários de formatação e parsing monetário em Real Brasileiro (BRL)
 */

export function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return 'R$\u00a00,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
}

export function parseCurrencyInput(value: string): number {
  if (!value) return 0;
  const clean = value.replace(/\D/g, '');
  if (!clean) return 0;
  return Number(clean) / 100;
}

export function formatCurrencyInput(value: string | number): string {
  let numVal: number;
  if (typeof value === 'string') {
    numVal = parseCurrencyInput(value);
  } else {
    numVal = value;
  }
  return numVal.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
