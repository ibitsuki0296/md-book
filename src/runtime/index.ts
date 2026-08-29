/**
 * md-book runtime — the browser layer. Depends on the DOM.
 * The CDN build (`md-book.global.js`) wraps this and auto-registers `<md-book>`.
 */

export type { App, AppOptions, PageState, SlotContent } from './app.js';
export { defineElement, MdBookElement } from './element.js';
export {
  addCodeCopyButtons,
  applyHighlight,
  createScrollSpy,
  type Highlighter,
  type ScrollSpy,
} from './enhance.js';
export { mount, type MountHandle, type MountOptions } from './mount.js';
export { PageLoader, PageNotFoundError } from './page.js';
export { createRouter, type Router, type RouterMode } from './router.js';
export { version } from '../version.js';
