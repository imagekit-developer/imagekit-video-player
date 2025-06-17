// ./utils.ts

/**
 * Finds an element's position on the page.
 * @param el The element to measure.
 * @returns An object with `left` and `top` pixel values.
 */
export function findElPosition(el: HTMLElement): { left: number; top: number } {
  let box: DOMRect | undefined;

  if (el.getBoundingClientRect && el.parentNode) {
    box = el.getBoundingClientRect();
  }

  if (!box) {
    return { left: 0, top: 0 };
  }

  const docEl = document.documentElement;
  const body = document.body;

  const clientLeft = docEl.clientLeft || body.clientLeft || 0;
  const scrollLeft = window.pageXOffset || body.scrollLeft;
  const left = box.left + scrollLeft - clientLeft;

  const clientTop = docEl.clientTop || body.clientTop || 0;
  const scrollTop = window.pageYOffset || body.scrollTop;
  const top = box.top + scrollTop - clientTop;

  return {
    left: Math.round(left),
    top: Math.round(top),
  };
}

/**
 * Calculates the pointer's position relative to an element, returning normalized
 * coordinates (from 0 to 1).
 * @param el The element to measure against.
 * @param event The mouse or touch event.
 * @returns Object with `x` and `y` coordinates (0-1).
 */
export function getPointerPosition(el: HTMLElement, event: MouseEvent | TouchEvent): { x: number; y: number } {
  const position = { x: 0, y: 0 };
  const box = findElPosition(el);
  const boxW = el.offsetWidth;
  const boxH = el.offsetHeight;
  const boxY = box.top;
  const boxX = box.left;

  const isTouchEvent = 'changedTouches' in event;
  const pageX = isTouchEvent ? (event as TouchEvent).changedTouches[0].pageX : (event as MouseEvent).pageX;
  const pageY = isTouchEvent ? (event as TouchEvent).changedTouches[0].pageY : (event as MouseEvent).pageY;

  position.y = Math.max(0, Math.min(1, (pageY - boxY) / boxH));
  position.x = Math.max(0, Math.min(1, (pageX - boxX) / boxW));

  return position;
}