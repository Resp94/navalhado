import { useEffect, useState } from 'react';

/**
 * Detecta a largura de celular pelo mesmo limite que o painel já usa em
 * CSS (`@media (max-width: 768px)`, ver `GerenteLayout.tsx` e
 * `MobileBottomNav.tsx`). O Módulo de Relatórios (spec 038) precisa dessa
 * decisão em JavaScript, e não só em CSS, porque abaixo do limite a tela
 * não deve nem chamar o repositório -- não basta esconder o conteúdo,
 * ninguém pode montá-lo.
 */
const NARROW_VIEWPORT_QUERY = '(max-width: 768px)';

export function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(NARROW_VIEWPORT_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQueryList = window.matchMedia(NARROW_VIEWPORT_QUERY);

    const handleChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    setIsNarrow(mediaQueryList.matches);

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    }
    // Fallback para ambientes sem addEventListener em MediaQueryList (ex.: jsdom mais antigo).
    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  }, []);

  return isNarrow;
}
