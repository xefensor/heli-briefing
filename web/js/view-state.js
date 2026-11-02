/** Retain reader-owned disclosure state when a live source replaces its markup. */
export function captureSourceDetailState(root, previous = {}) {
  const details = new Map(previous.details || []);
  for (const item of root.querySelectorAll('details[data-source-detail]')) {
    details.set(item.dataset.sourceDetail, item.open);
  }
  const active = root.ownerDocument?.activeElement;
  const detail = active?.closest?.('details[data-source-detail]');
  let focus = null;
  if (detail && root.contains(detail) && detail.contains(active)) {
    const summary = detail.querySelector('summary');
    focus = {
      detail: detail.dataset.sourceDetail,
      summary: active === summary || summary?.contains(active),
      id: active.id || null,
      tag: active.tagName,
      href: active.getAttribute('href'),
      role: active.getAttribute('role'),
      label: active.getAttribute('aria-label'),
      chart: active.dataset?.chartEnlarge || null,
      text: active.textContent?.trim() || '',
    };
  }
  return { details: [...details], focus };
}

/** Match semantic identities without putting provider/user text into selectors. */
export function restoreSourceDetailState(root, state) {
  const details = [...root.querySelectorAll('details[data-source-detail]')];
  const open = new Map(state?.details || []);
  for (const item of details) {
    if (open.has(item.dataset.sourceDetail)) item.open = open.get(item.dataset.sourceDetail);
  }
  const token = state?.focus;
  if (!token) return false;
  const detail = details.find(item => item.dataset.sourceDetail === token.detail);
  if (!detail) return false;
  const summary = detail.querySelector('summary');
  const controls = [...detail.querySelectorAll('summary, button, a[href], input, select, textarea, [tabindex]')];
  let target = token.summary ? summary : controls.find(item => {
    if (token.id) return item.id === token.id;
    if (token.chart) return item.dataset?.chartEnlarge === token.chart;
    if (item.tagName !== token.tag) return false;
    if (token.href !== null) return item.getAttribute('href') === token.href;
    if (token.label) return item.getAttribute('aria-label') === token.label && item.getAttribute('role') === token.role;
    return item.textContent?.trim() === token.text;
  });
  if (!target || target.disabled || !target.getClientRects().length) target = summary;
  if (!target || !target.getClientRects().length) return false;
  target.focus({ preventScroll: true });
  return true;
}
