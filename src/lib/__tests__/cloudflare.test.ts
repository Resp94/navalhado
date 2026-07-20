import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('infraestrutura Cloudflare', () => {
  it('não inclui o arquivo _redirects legado do Cloudflare Pages', () => {
    const filePath = path.resolve(process.cwd(), 'public/_redirects');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
