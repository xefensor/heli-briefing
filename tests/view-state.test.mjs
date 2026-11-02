import test from 'node:test';
import assert from 'node:assert/strict';
import { captureSourceDetailState, restoreSourceDetailState } from '../web/js/view-state.js';

// A small DOM model makes focus/visibility assertions independent of a browser
// package. Replacements below create new elements, as innerHTML does in the app.
class Element {
  constructor(tag, { key, id = '', href = null, text = '', open = false, disabled = false, role = null, label = null, tabindex = null } = {}, children = []) {
    this.tagName = tag.toUpperCase(); this.id = id; this.href = href;
    this.textContent = text; this.open = open; this.disabled = disabled;
    this.role = role; this.label = label; this.tabindex = tabindex;
    this.dataset = key === undefined ? {} : { sourceDetail: key };
    this.children = children;
    for (const child of children) child.parentElement = this;
  }
  contains(element) { return element === this || this.children.some(child => child.contains(element)); }
  matches(selector) {
    if (selector === 'details[data-source-detail]') return this.tagName === 'DETAILS' && Object.hasOwn(this.dataset, 'sourceDetail');
    if (selector === 'a[href]') return this.tagName === 'A' && this.href !== null;
    if (selector === '[tabindex]') return this.tabindex !== null;
    return selector.toUpperCase() === this.tagName;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selectors) {
    const result = [], list = selectors.split(',').map(value => value.trim());
    const walk = node => { for (const child of node.children) { if (list.some(selector => child.matches(selector))) result.push(child); walk(child); } };
    walk(this); return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getAttribute(name) { return name === 'href' ? this.href : name === 'role' ? this.role : name === 'aria-label' ? this.label : null; }
  getClientRects() {
    for (let parent = this.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS' && !parent.open && !parent.querySelector('summary').contains(this)) return [];
    }
    return [{}];
  }
  focus(options) { this.ownerDocument.activeElement = this; this.ownerDocument.focusCalls.push({ element: this, options }); }
}
const node = (tag, options, children) => new Element(tag, options, children);
const disclosure = (key, open, controls = []) => node('details', { key, open }, [node('summary', { text: key }), ...controls]);
function root(children, document = { activeElement: null, focusCalls: [] }) {
  const element = node('section', {}, children);
  const attach = child => { child.ownerDocument = document; child.children.forEach(attach); };
  attach(element); return element;
}

test('reader-open and reader-closed disclosures survive replacement, reordering and temporary absence', () => {
  const before = root([disclosure('samples', true), disclosure('provenance', false)]);
  let state = captureSourceDetailState(before);
  state = captureSourceDetailState(root([]), state);
  const after = root([disclosure('provenance', true), disclosure('new-source', true), disclosure('samples', false)]);
  restoreSourceDetailState(after, state);
  assert.deepEqual(after.children.map(detail => [detail.dataset.sourceDetail, detail.open]), [
    ['provenance', false], ['new-source', true], ['samples', true],
  ]);
  after.children[2].open = false;
  state = captureSourceDetailState(after, state);
  const refreshed = root([disclosure('samples', true)]);
  restoreSourceDetailState(refreshed, state);
  assert.equal(refreshed.children[0].open, false);
});

test('a focused disclosure summary returns to its semantic key without scrolling', () => {
  const document = { activeElement: null, focusCalls: [] };
  const before = root([disclosure('samples', true), disclosure('provenance', false)], document);
  document.activeElement = before.children[0].querySelector('summary');
  const state = captureSourceDetailState(before);
  const after = root([disclosure('provenance', true), disclosure('samples', false)], document);
  assert.equal(restoreSourceDetailState(after, state), true);
  assert.equal(document.activeElement, after.children[1].querySelector('summary'));
  assert.equal(after.children[1].open, true);
  assert.deepEqual(document.focusCalls[0].options, { preventScroll: true });
});

test('links retain focus by destination and controls by ID when source text changes', () => {
  const document = { activeElement: null, focusCalls: [] };
  for (const pair of [
    [node('a', { href: 'https://provider.test/legend', text: 'Old time' }), node('a', { href: 'https://provider.test/legend', text: 'New time' })],
    [node('button', { id: 'lowcloud-import', text: 'Import' }), node('button', { id: 'lowcloud-import', text: 'Replace local files' })],
  ]) {
    const before = root([disclosure('source', true, [pair[0]])], document);
    document.activeElement = pair[0];
    const state = captureSourceDetailState(before);
    const after = root([disclosure('source', false, [node('a', { href: 'https://other.test/', text: 'Other link' }), pair[1]])], document);
    assert.equal(restoreSourceDetailState(after, state), true);
    assert.equal(document.activeElement, pair[1]);
  }
});

test('removed or disabled controls fall back to the same visible source summary', () => {
  for (const controls of [[], [node('button', { id: 'local-file', text: 'Open', disabled: true })]]) {
    const document = { activeElement: null, focusCalls: [] };
    const button = node('button', { id: 'local-file', text: 'Open' });
    const before = root([disclosure('files', true, [button])], document);
    document.activeElement = button;
    const state = captureSourceDetailState(before);
    const after = root([disclosure('files', false, controls)], document);
    restoreSourceDetailState(after, state);
    assert.equal(document.activeElement, after.children[0].querySelector('summary'));
  }
});

test('a focused scrollable data region survives changed table values by its accessible name', () => {
  const document = { activeElement: null, focusCalls: [] };
  const oldRegion = node('div', { role: 'region', label: 'Hourly source values', tabindex: 0, text: 'Original table' });
  const before = root([disclosure('samples', true, [oldRegion])], document);
  document.activeElement = oldRegion;
  const state = captureSourceDetailState(before);
  const newRegion = node('div', { role: 'region', label: 'Hourly source values', tabindex: 0, text: 'Updated table' });
  const after = root([disclosure('samples', false, [newRegion])], document);
  restoreSourceDetailState(after, state);
  assert.equal(document.activeElement, newRegion);
});

test('refresh cannot steal outside focus or replay old focus after an intermediate empty view', () => {
  const document = { activeElement: null, focusCalls: [] };
  const before = root([disclosure('source', true)], document);
  document.activeElement = before.children[0].querySelector('summary');
  let state = captureSourceDetailState(before);
  const outside = node('input', { id: 'inspection-time' });
  document.activeElement = outside;
  state = captureSourceDetailState(root([], document), state);
  const after = root([disclosure('source', false)], document);
  assert.equal(restoreSourceDetailState(after, state), false);
  assert.equal(document.activeElement, outside);
  assert.equal(after.children[0].open, true);
  assert.equal(document.focusCalls.length, 0);
});

test('source keys and link values are compared as data rather than CSS selectors', () => {
  const key = 'provider["quoted"]', document = { activeElement: null, focusCalls: [] };
  const before = root([disclosure(key, true)], document);
  document.activeElement = before.children[0].querySelector('summary');
  const state = captureSourceDetailState(before);
  const after = root([disclosure(key, false)], document);
  restoreSourceDetailState(after, state);
  assert.equal(after.children[0].open, true);
  assert.equal(document.activeElement, after.children[0].querySelector('summary'));
});
