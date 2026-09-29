import { describe, expect, it } from 'vitest';
import { pluralizar } from '../plural';

describe('pluralizar', () => {
  it('usa o singular só para 1', () => {
    expect(pluralizar(1, 'profissional', 'profissionais')).toBe('profissional');
  });

  it('usa o plural para 0 e para qualquer quantidade acima de 1', () => {
    expect(pluralizar(0, 'profissional', 'profissionais')).toBe('profissionais');
    expect(pluralizar(2, 'profissional', 'profissionais')).toBe('profissionais');
    expect(pluralizar(10, 'profissional', 'profissionais')).toBe('profissionais');
  });
});
