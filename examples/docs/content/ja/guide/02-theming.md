---
title: テーマ
description: CSS カスタムプロパティを上書きしてサイト全体の見た目を変えます。
---

# テーマ

md-book の公開テーマ API は、名前空間付きの CSS カスタムプロパティ群です。テーマとは、それらを
再定義する 1 枚の `.css` ファイルで、`style.css` の **後** に読み込みます。

```html
<link rel="stylesheet" href="@ibitsuki0296/md-book/style.css" />
<link rel="stylesheet" href="/my-theme.css" />
```

## トークン一覧

```css
:root {
  /* 色 */
  --md-book-color-bg: #ffffff;
  --md-book-color-fg: #18181c;
  --md-book-color-fg-muted: #6f6f7b;
  --md-book-color-surface: #fafafa;
  --md-book-color-border: #e7e7ea;
  --md-book-color-accent: #4f46e5;
  --md-book-color-accent-fg: #ffffff;
  --md-book-color-code-bg: #fafafa;

  /* シンタックスハイライト */
  --md-book-color-tok-keyword: #7c3aed;
  --md-book-color-tok-string: #047857;
  --md-book-color-tok-function: #2563eb;

  /* タイポグラフィ */
  --md-book-font-body: "Inter", ui-sans-serif, system-ui, sans-serif;
  --md-book-font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  --md-book-leading: 1.7;

  /* レイアウト */
  --md-book-measure: 46rem;       /* 本文の幅 */
  --md-book-sidebar-width: 16rem;
  --md-book-toc-width: 14rem;
  --md-book-radius: 0.75rem;
}
```

パッケージの `themes/default.css` に全トークンと既定値が載っているので、出発点としてコピーしてください。
基本パレット（`--md-book-gray-*`、`--md-book-brand-*`）も上書きできるので、1 か所で配色を変えることもできます。

## フォント

md-book 自身はフォントをダウンロードしません。既定のスタックは **Inter** と **JetBrains Mono** を先頭に
並べているので、それらを読み込めば（Google Fonts への `<link>` か、セルフホストの `@font-face`）
十分です。読み込まなければ OS の UI フォントが使われます。

## シンタックスハイライト

`js`/`ts`、`json`、`css`、`html`、`bash`、`yaml`、`python`、`diff` のコードブロックは、描画時に小さな組み込み
トークナイザで色分けされ、`--md-book-color-tok-*` トークンで着色されます。それ以外の言語は無着色です。
完全な文法のハイライトが必要なら `mount()` に `highlight: (code, lang) => html`（Shiki や highlight.js など）を
渡すか、`renderMarkdown()` で `highlight: false` を指定して組み込み版を止めます。

## ダークモード

`[data-theme="dark"]` のブロックを用意します。ランタイムは `<html>` に `data-theme` を設定します。
テーマファイルがなければ `prefers-color-scheme` からもダークが適用されます。

```css
:root[data-theme="dark"] {
  --md-book-color-bg: #0a0a0d;
  --md-book-color-fg: #f4f4f5;
  --md-book-color-border: #26262d;
  --md-book-color-accent: #818cf8;
}
```

`themeInitScript()`（または同等のインラインスニペット）を `<head>` に貼ると、保存済みのテーマが
最初の描画前に適用されます。

## 構造の上書き

同梱のルールは `@layer md-book.tokens, .base, .layout, .content, .components` に入っています。
**レイヤーなし** で書いたルールはそのすべてに勝つので、詳細度の競り合いなしに構造を変えられます。

```css
.md-book-header { position: static; }   /* レイヤー内の `position: sticky` に勝つ */
```

:::warning
構造の上書きに色を直接書かず、トークン経由にしてください。ライトとダークが揃ったままになります。
同梱スタイルについては `npm run validate:tokens` が検査します。
:::
