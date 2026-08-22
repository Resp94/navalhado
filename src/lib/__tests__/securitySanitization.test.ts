import { describe, it, expect } from 'vitest';

// 1. Teste da função de mascaramento de telefone para LGPD
const maskPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return '****';
  return `${cleaned.slice(0, 4)}****${cleaned.slice(-4)}`;
};

// 2. Teste da allowlist de CORS
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://dev.navalhado.com.br',
  'https://navalhado.com.br',
  'https://app.navalhado.com.br',
];

const getCorsHeaders = (originHeader?: string) => {
  const origin = originHeader || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : (origin ? 'https://dev.navalhado.com.br' : '*');

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-db-trigger-secret',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  };
};

// 3. Teste de sanitização contra XSS
const formatWhatsAppFormattedHtml = (text: string) => {
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  escaped = escaped.replace(/\*([^\*]+)\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
  escaped = escaped.replace(/~([^~]+)~/g, '<del>$1</del>');
  escaped = escaped.replace(/\n/g, '<br />');

  return { __html: escaped };
};

describe('Segurança Defensiva e Conformidade LGPD', () => {
  describe('LGPD: Mascaramento de Telefones (PII) nos Logs', () => {
    it('mascara corretamente números de telefone brasileiros com 13 dígitos', () => {
      expect(maskPhoneNumber('5511999998888')).toBe('5511****8888');
    });

    it('mascara números com caracteres especiais', () => {
      expect(maskPhoneNumber('+55 (11) 98888-7777')).toBe('5511****7777');
    });

    it('retorna **** para entradas muito curtas', () => {
      expect(maskPhoneNumber('1234')).toBe('****');
    });
  });

  describe('CORS: Restrição de Origens e Suporte a Localhost', () => {
    it('permite localhost:5173 para ambiente de desenvolvimento local', () => {
      const headers = getCorsHeaders('http://localhost:5173');
      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    });

    it('permite dev.navalhado.com.br para ambiente de staging', () => {
      const headers = getCorsHeaders('https://dev.navalhado.com.br');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://dev.navalhado.com.br');
    });

    it('bloqueia/redireciona origens não autorizadas', () => {
      const headers = getCorsHeaders('https://malicious-site.com');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://dev.navalhado.com.br');
    });
  });

  describe('XSS: Sanitização de Conteúdo Não Confiável', () => {
    it('escapa tags script maliciosas antes de renderizar tags permitidas', () => {
      const payload = '<script>alert("XSS")</script>*Texto em negrito*';
      const result = formatWhatsAppFormattedHtml(payload);
      expect(result.__html).toContain('&lt;script&gt;alert("XSS")&lt;/script&gt;');
      expect(result.__html).toContain('<strong>Texto em negrito</strong>');
      expect(result.__html).not.toContain('<script>');
    });

    it('escapa atributos onload / onerror em tags HTML injetadas', () => {
      const payload = '<img src=x onerror=alert(1)>';
      const result = formatWhatsAppFormattedHtml(payload);
      expect(result.__html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(result.__html).not.toContain('<img');
    });
  });

  describe('Autenticação: Política de Senhas e Anti-Enumeração', () => {
    const isStrongPassword = (pwd: string) => pwd.length >= 8;

    it('rejeita senhas com menos de 8 caracteres conforme ASVS 5.0', () => {
      expect(isStrongPassword('123456')).toBe(false);
      expect(isStrongPassword('senha12')).toBe(false);
      expect(isStrongPassword('SenhaForte123')).toBe(true);
    });
  });
});