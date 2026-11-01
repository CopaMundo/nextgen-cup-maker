/** Align vertically only: never changes another bracket's horizontal position. */
export function bracketSuccessorIndex(index: number, from: number, to: number, counts: number[]) {
  let result = index;
  for (let round = from; round !== to;) {
    const next = round + (to > from ? 1 : -1);
    const sourceCount = counts[round] ?? 0;
    const targetCount = counts[next] ?? 0;
    if (!sourceCount || !targetCount) return 0;
    result = Math.min(targetCount - 1, Math.floor(result * targetCount / sourceCount));
    round = next;
  }
  return result;
}

export function bracketVisibleBounds(element: HTMLElement) {
  let top = 0;
  let bottom = window.innerHeight;
  let parent = element.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    if (!parent.classList.contains("overflow-x-auto") && /(auto|scroll)/.test(getComputedStyle(parent).overflowY)) {
      const rect = parent.getBoundingClientRect();
      top = Math.max(top, rect.top + parent.clientTop);
      bottom = Math.min(bottom, rect.top + parent.clientTop + parent.clientHeight);
    }
    parent = parent.parentElement;
  }
  return { top, bottom, center: (top + bottom) / 2 };
}

export function centerBracketMatch(card: HTMLElement) {
  const top = Number(card.dataset.bracketTop);
  const container = card.offsetParent;
  if (!(container instanceof HTMLElement) || !Number.isFinite(top)) return;
  let parent = card.parentElement;
  const center = () => container.getBoundingClientRect().top + top + card.getBoundingClientRect().height / 2;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    if (!parent.classList.contains("overflow-x-auto") && /(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
      parent.scrollTop += center() - bracketVisibleBounds(card).center;
      return;
    }
    parent = parent.parentElement;
  }
  window.scrollBy({ top: center() - bracketVisibleBounds(card).center, behavior: "instant" });
}

export function alignBracketTop(element: HTMLElement) {
  element.scrollTop = 0;
  let parent = element.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = getComputedStyle(parent);
    if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) {
      const inset = parseFloat(style.scrollPaddingTop) || 8;
      const delta = element.getBoundingClientRect().top - parent.getBoundingClientRect().top - parent.clientTop - inset;
      if (delta < 0) parent.scrollTop += delta;
    }
    parent = parent.parentElement;
  }
  const inset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 16;
  const top = element.getBoundingClientRect().top;
  if (top < inset) window.scrollBy({ top: top - inset, behavior: "instant" });
}