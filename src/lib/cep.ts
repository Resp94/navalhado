/**
 * Utilitário resiliente para busca e formatação de CEP brasileiro
 * Utiliza ViaCEP como provedor principal e BrasilAPI como contingência automática.
 */

export interface CepAddressResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

/**
 * Formata um valor numérico para o padrão de CEP brasileiro: 00000-000
 */
export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

/**
 * Higieniza o CEP mantendo apenas os dígitos (até 8)
 */
export function cleanCepDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

/**
 * Realiza a consulta de endereço por CEP com estratégia de fallback automático
 */
export async function fetchAddressByCep(rawCep: string): Promise<CepAddressResult | null> {
  const cleanCep = cleanCepDigits(rawCep);
  if (cleanCep.length !== 8) {
    return null;
  }

  // 1. Tentativa com ViaCEP (Provedor Primário)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (!data.erro) {
        return {
          cep: formatCep(cleanCep),
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || '',
        };
      }
    }
  } catch (err) {
    console.warn('[CEP] Falha na consulta ViaCEP, acionando fallback BrasilAPI:', err);
  }

  // 2. Tentativa com BrasilAPI (Provedor de Contingência)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        cep: formatCep(cleanCep),
        street: data.street || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
      };
    }
  } catch (err) {
    console.warn('[CEP] Falha no fallback BrasilAPI:', err);
  }

  return null;
}
