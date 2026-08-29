import { type MountHandle, type MountOptions, mount } from './mount.js';
import type { RouterMode } from './router.js';

const SLOT_ATTR_MAP: Record<string, 'navbarEnd' | 'sidebarTop' | 'pageFooter'> = {
  'navbar-end': 'navbarEnd',
  'sidebar-top': 'sidebarTop',
  'page-footer': 'pageFooter',
};

/**
 * `<md-book manifest="/manifest.json" base="/" router="history">`.
 *
 * Renders into light DOM so the site stylesheet and themes apply. Children with
 * a `slot="navbar-end" | "sidebar-top" | "page-footer"` attribute are lifted
 * into the corresponding shell region before the app takes over.
 */
export class MdBookElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['manifest', 'base', 'router', 'heading', 'theme', 'blog', 'blog-dir', 'blog-per-page'];
  }

  private handle: MountHandle | null = null;
  private mounting = false;

  connectedCallback(): void {
    void this.render();
  }

  disconnectedCallback(): void {
    this.handle?.destroy();
    this.handle = null;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) void this.render();
  }

  /** Programmatic navigation, e.g. `document.querySelector('md-book').navigate('/guide')`. */
  navigate(to: string, options?: { replace?: boolean }): void {
    this.handle?.navigate(to, options);
  }

  private async render(): Promise<void> {
    if (this.mounting) return;
    this.mounting = true;
    this.handle?.destroy();

    const slots = this.collectSlots();
    const options: MountOptions = { slots };

    const manifestUrl = this.getAttribute('manifest');
    if (manifestUrl) options.manifestUrl = manifestUrl;
    const base = this.getAttribute('base');
    if (base) options.base = base;
    const heading = this.getAttribute('heading');
    if (heading) options.title = heading;
    const router = this.getAttribute('router');
    if (router === 'hash' || router === 'history') options.routerMode = router as RouterMode;
    const themeMode = this.getAttribute('theme');
    if (themeMode === 'light' || themeMode === 'dark' || themeMode === 'system') {
      options.theme = { default: themeMode };
    }

    if (this.hasAttribute('blog')) {
      const blog: NonNullable<MountOptions['blog']> = {};
      const dir = this.getAttribute('blog-dir');
      if (dir) blog.dir = dir;
      const perPage = Number.parseInt(this.getAttribute('blog-per-page') ?? '', 10);
      if (Number.isFinite(perPage) && perPage > 0) blog.perPage = perPage;
      options.blog = Object.keys(blog).length > 0 ? blog : true;
    }

    try {
      this.handle = await mount(this, options);
    } catch (err) {
      this.replaceChildren();
      const message = document.createElement('p');
      message.className = 'md-book-error';
      message.textContent = `md-book: ${(err as Error).message}`;
      this.append(message);
    } finally {
      this.mounting = false;
    }
  }

  private collectSlots(): MountOptions['slots'] {
    const slots: NonNullable<MountOptions['slots']> = {};
    for (const child of Array.from(this.children)) {
      const name = child.getAttribute('slot');
      const key = name ? SLOT_ATTR_MAP[name] : undefined;
      if (key) slots[key] = child.cloneNode(true) as Node;
    }
    return slots;
  }
}

/** Registers `<md-book>` (idempotent). */
export function defineElement(tagName = 'md-book'): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return;
  customElements.define(tagName, MdBookElement);
}
