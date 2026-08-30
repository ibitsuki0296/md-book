/*
 * Token schema for the md-book theme playground.
 *
 * This mirrors the public `--md-book-*` contract in `src/styles/tokens.css`.
 * Each field knows its default for light AND dark so the two modes can be
 * edited independently. `scope: "shared"` fields are not redefined per mode in
 * tokens.css, so the playground edits them once.
 *
 * Keep this file in sync when tokens.css changes.
 */

/** Curated font stacks offered in the typography selects. */
export const FONT_STACKS = {
  'system-sans':
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
  'system-mono':
    'ui-monospace, "SF Mono", "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", monospace',
  georgia: 'Georgia, "Iowan Old Style", "Hiragino Mincho ProN", "Yu Mincho", serif',
  'ny-serif': 'ui-serif, "New York", Charter, "Iowan Old Style", Georgia, serif',
  'rounded-sans':
    '"SF Pro Rounded", ui-rounded, "Hiragino Maru Gothic ProN", system-ui, sans-serif',
  'grotesk':
    'Inter, "Helvetica Neue", "Arial Nova", "Segoe UI", system-ui, sans-serif',
};

const INHERIT_BODY = 'var(--md-book-font-body)';

/** Shadow presets — the raw string is what lands in the exported CSS. */
export const SHADOWS = {
  none: 'none',
  subtle: '0 1px 2px rgb(0 0 0 / 0.04)',
  default: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 12px rgb(0 0 0 / 0.06)',
  elevated: '0 2px 4px rgb(0 0 0 / 0.06), 0 12px 32px rgb(0 0 0 / 0.14)',
};
const SHADOWS_DARK = {
  none: 'none',
  subtle: '0 1px 2px rgb(0 0 0 / 0.4)',
  default: '0 1px 2px rgb(0 0 0 / 0.4), 0 6px 18px rgb(0 0 0 / 0.45)',
  elevated: '0 2px 6px rgb(0 0 0 / 0.5), 0 16px 40px rgb(0 0 0 / 0.55)',
};

/**
 * Groups of fields. `token` is the CSS custom property name without the
 * `--md-book-` prefix. `light` / `dark` are the stock values; when `dark` is
 * omitted the field is mode-independent (scope "shared").
 */
export const GROUPS = [
  {
    id: 'brand',
    label: 'Brand palette',
    note: 'Accent, links, focus ring, selection and inline-code all derive from these four shades.',
    scope: 'shared',
    fields: [
      { token: 'brand-400', label: 'Brand 400 (dark-mode accent)', type: 'color', light: '#6ea8fe' },
      { token: 'brand-500', label: 'Brand 500', type: 'color', light: '#3b82f6' },
      { token: 'brand-600', label: 'Brand 600 (accent)', type: 'color', light: '#2563eb' },
      { token: 'brand-700', label: 'Brand 700 (accent hover)', type: 'color', light: '#1d4ed8' },
    ],
  },
  {
    id: 'surfaces',
    label: 'Surfaces & text',
    note: 'Edited per mode — switch the Light / Dark toggle above to set each.',
    scope: 'mode',
    fields: [
      { token: 'color-bg', label: 'Background', type: 'color', light: '#ffffff', dark: '#0c0d11' },
      { token: 'color-fg', label: 'Text', type: 'color', light: '#23272f', dark: '#eceef2' },
      { token: 'color-fg-muted', label: 'Muted text', type: 'color', light: '#6b7280', dark: '#9aa1af' },
      { token: 'color-surface', label: 'Surface', type: 'color', light: '#f7f8fa', dark: '#14161b' },
      { token: 'color-surface-hover', label: 'Surface (hover)', type: 'color', light: '#eceef2', dark: '#23272f' },
      { token: 'color-border', label: 'Border', type: 'color', light: '#dde0e7', dark: '#363b48' },
    ],
  },
  {
    id: 'accent-advanced',
    label: 'Accent overrides',
    note: 'Optional. Leave blank to keep the value derived from the brand palette. Set one to pin an exact colour (e.g. a different accent hue in dark).',
    scope: 'mode',
    advanced: true,
    fields: [
      { token: 'color-accent', label: 'Accent', type: 'color', light: '#2563eb', dark: '#6ea8fe', optional: true },
      { token: 'color-accent-hover', label: 'Accent (hover)', type: 'color', light: '#1d4ed8', dark: '#9dc2ff', optional: true },
      { token: 'color-accent-fg', label: 'Accent foreground', type: 'color', light: '#ffffff', dark: '#0c0d11', optional: true },
      { token: 'color-code-bg', label: 'Code block bg', type: 'color', light: '#eceef2', dark: '#14161b', optional: true },
      { token: 'color-code-fg', label: 'Code block text', type: 'color', light: '#23272f', dark: '#eceef2', optional: true },
    ],
  },
  {
    id: 'admonitions',
    label: 'Admonitions',
    scope: 'mode',
    fields: [
      { token: 'color-note', label: 'Note', type: 'color', light: '#3b82f6' },
      { token: 'color-tip', label: 'Tip', type: 'color', light: '#16a34a' },
      { token: 'color-warning', label: 'Warning', type: 'color', light: '#d97706' },
      { token: 'color-danger', label: 'Danger', type: 'color', light: '#dc2626' },
      {
        token: 'admonition-bg-mix',
        label: 'Tint strength',
        type: 'range',
        unit: '%',
        min: 0,
        max: 28,
        step: 1,
        light: 8,
        dark: 16,
      },
    ],
  },
  {
    id: 'typography',
    label: 'Typography',
    scope: 'shared',
    fields: [
      {
        token: 'font-body',
        label: 'Body font',
        type: 'font',
        options: [
          ['system-sans', 'System sans'],
          ['grotesk', 'Grotesk (Inter)'],
          ['rounded-sans', 'Rounded sans'],
          ['georgia', 'Georgia serif'],
          ['ny-serif', 'New York serif'],
        ],
        light: FONT_STACKS['system-sans'],
      },
      {
        token: 'font-heading',
        label: 'Heading font',
        type: 'font',
        options: [
          ['inherit', 'Inherit body'],
          ['system-sans', 'System sans'],
          ['grotesk', 'Grotesk (Inter)'],
          ['georgia', 'Georgia serif'],
          ['ny-serif', 'New York serif'],
        ],
        light: INHERIT_BODY,
      },
      {
        token: 'font-mono',
        label: 'Mono font',
        type: 'font',
        options: [['system-mono', 'System mono']],
        light: FONT_STACKS['system-mono'],
      },
      { token: 'text-base', label: 'Base size', type: 'range', unit: 'rem', min: 0.875, max: 1.25, step: 0.015625, light: 1 },
      { token: 'text-scale', label: 'Type scale ratio', type: 'range', unit: '', min: 1.1, max: 1.4, step: 0.01, light: 1.2 },
      { token: 'leading', label: 'Body line-height', type: 'range', unit: '', min: 1.4, max: 2, step: 0.05, light: 1.7 },
      { token: 'leading-heading', label: 'Heading line-height', type: 'range', unit: '', min: 1.05, max: 1.5, step: 0.05, light: 1.25 },
    ],
  },
  {
    id: 'layout',
    label: 'Layout & shape',
    scope: 'shared',
    fields: [
      { token: 'measure', label: 'Content measure', type: 'range', unit: 'rem', min: 30, max: 64, step: 1, light: 46 },
      { token: 'content-max', label: 'Shell max width', type: 'range', unit: 'rem', min: 60, max: 120, step: 1, light: 90 },
      { token: 'sidebar-width', label: 'Sidebar width', type: 'range', unit: 'rem', min: 12, max: 22, step: 0.5, light: 16 },
      { token: 'toc-width', label: 'TOC width', type: 'range', unit: 'rem', min: 0, max: 20, step: 0.5, light: 14 },
      { token: 'gutter', label: 'Gutter', type: 'range', unit: 'rem', min: 0.5, max: 4, step: 0.25, light: 2 },
      { token: 'header-height', label: 'Header height', type: 'range', unit: 'rem', min: 2.75, max: 5, step: 0.25, light: 3.5 },
      { token: 'radius', label: 'Radius', type: 'range', unit: 'rem', min: 0, max: 1.5, step: 0.0625, light: 0.5 },
      { token: 'radius-sm', label: 'Radius (small)', type: 'range', unit: 'rem', min: 0, max: 1, step: 0.0625, light: 0.25 },
      { token: 'border-width', label: 'Border width', type: 'range', unit: 'px', min: 0, max: 4, step: 1, light: 1 },
      {
        token: 'shadow',
        label: 'Shadow',
        type: 'shadow',
        options: [
          ['none', 'None'],
          ['subtle', 'Subtle'],
          ['default', 'Default'],
          ['elevated', 'Elevated'],
        ],
        light: SHADOWS.default,
      },
    ],
  },
];

/** All fields flattened, with their group scope attached. */
export const FIELDS = GROUPS.flatMap((g) =>
  g.fields.map((f) => ({ ...f, group: g.id, scope: g.scope })),
);

/** Resolve a shadow/font select value back to its option key (for the <select>). */
export function fontKeyForValue(value) {
  if (value === INHERIT_BODY) return 'inherit';
  for (const [key, stack] of Object.entries(FONT_STACKS)) {
    if (stack === value) return key;
  }
  return 'custom';
}
export function fontValueForKey(key) {
  if (key === 'inherit') return INHERIT_BODY;
  return FONT_STACKS[key] ?? '';
}
export function shadowKeyForValue(value, mode) {
  const table = mode === 'dark' ? SHADOWS_DARK : SHADOWS;
  for (const [key, str] of Object.entries(table)) {
    if (str === value) return key;
  }
  // light values are stored; also accept a light match in dark mode
  for (const [key, str] of Object.entries(SHADOWS)) {
    if (str === value) return key;
  }
  return 'default';
}
export function shadowValueForKey(key, mode) {
  const table = mode === 'dark' ? SHADOWS_DARK : SHADOWS;
  return table[key] ?? table.default;
}

/**
 * Fresh state: `{ shared: {token: value}, light: {...}, dark: {...} }`.
 * Optional fields start absent (empty string) so they are not exported.
 */
export function defaultState() {
  const state = { shared: {}, light: {}, dark: {} };
  for (const field of FIELDS) {
    if (field.scope === 'shared') {
      state.shared[field.token] = field.optional ? '' : String(field.light);
    } else {
      state.light[field.token] = field.optional ? '' : String(field.light);
      state.dark[field.token] = field.optional ? '' : String(field.dark ?? field.light);
    }
  }
  return state;
}

/**
 * Built-in reference themes, expressed as partial overrides applied on top of
 * `defaultState()`. Mirrors `src/styles/themes/{default,ink}.css`.
 */
export const PRESETS = {
  default: { label: 'Default', patch: () => ({}) },
  ink: {
    label: 'Ink (serif, green)',
    patch: () => ({
      shared: {
        'font-body': FONT_STACKS.georgia,
        'leading': '1.75',
        'measure': '42',
        'radius': '0.25',
      },
      light: {
        'color-bg': '#fbfaf7',
        'color-fg': '#1f1d1a',
        'color-fg-muted': '#6a655c',
        'color-surface': '#f2efe8',
        'color-surface-hover': '#e8e3d8',
        'color-border': '#ddd6c7',
        'color-accent': '#1f7a4d',
        'color-accent-hover': '#155f3b',
        'color-accent-fg': '#fbfaf7',
        'color-code-bg': '#f2efe8',
        'color-code-fg': '#1f1d1a',
      },
      dark: {
        'color-bg': '#1a1916',
        'color-fg': '#ece7dc',
        'color-fg-muted': '#a49d8c',
        'color-surface': '#232019',
        'color-surface-hover': '#2e2a21',
        'color-border': '#3b362b',
        'color-accent': '#5cc48c',
        'color-accent-hover': '#7ad3a4',
        'color-accent-fg': '#1a1916',
        'color-code-bg': '#232019',
        'color-code-fg': '#ece7dc',
      },
    }),
  },
};

export const TOKEN_PREFIX = '--md-book-';
