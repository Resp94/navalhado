import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('infraestrutura Cloudflare', () => {
  it('deve garantir que o arquivo de redirecionamentos SPA existe na pasta public', () => {
    const filePath = path.resolve(process.cwd(), 'public/_redirects');
    const exists = fs.existsSync(filePath);
    expect(exists).toBe(true);

    if (exists) {
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      expect(content).toBe('/* /index.html 200');
    }
  });
});
