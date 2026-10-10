import '@testing-library/jest-dom';

// Radix UI (DropdownMenu, Popover, etc.) usa Pointer Events e scrollIntoView,
// que o jsdom não implementa — sem esses stubs os portais nunca abrem em teste.
// Os testes do Worker (worker/) rodam no ambiente node, sem window.
if (typeof window !== 'undefined') {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
}
