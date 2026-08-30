import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnstileCaptcha } from '../TurnstileCaptcha';

describe('TurnstileCaptcha', () => {
  beforeEach(() => {
    delete (window as Window & { turnstile?: unknown }).turnstile;
  });

  it('renderiza o desafio e entrega o token ao fluxo de sessão', async () => {
    const onTokenChange = vi.fn();
    const renderWidget = vi.fn((_container: HTMLElement, options: { callback: (token: string) => void }) => {
      options.callback('turnstile-token-1');
      return 'widget-1';
    });

    (window as Window & { turnstile?: unknown }).turnstile = {
      render: renderWidget,
      remove: vi.fn(),
    };

    render(<TurnstileCaptcha siteKey="site-key-1" onTokenChange={onTokenChange} />);

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
    expect(renderWidget).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ sitekey: 'site-key-1' }),
    );
    expect(onTokenChange).toHaveBeenCalledWith('turnstile-token-1');
  });

  it('remove o desafio ao desmontar', async () => {
    const removeWidget = vi.fn();
    (window as Window & { turnstile?: unknown }).turnstile = {
      render: vi.fn(() => 'widget-1'),
      remove: removeWidget,
    };

    const { unmount } = render(
      <TurnstileCaptcha siteKey="site-key-1" onTokenChange={vi.fn()} />,
    );

    await waitFor(() => expect(removeWidget).not.toHaveBeenCalled());
    unmount();

    expect(removeWidget).toHaveBeenCalledWith('widget-1');
  });
});
