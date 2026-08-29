/**
 * CDN entry: `<script src="https://cdn/md-book.global.js">` exposes `window.MdBook`
 * and auto-registers the `<md-book>` element.
 */
import { renderMarkdown } from '../core/render.js';
import { version } from '../version.js';
import { MdBookElement, defineElement } from './element.js';
import { mount } from './mount.js';
import { createRouter } from './router.js';

export { mount, createRouter, renderMarkdown, defineElement, MdBookElement, version };

if (typeof window !== 'undefined') {
  defineElement();
}
