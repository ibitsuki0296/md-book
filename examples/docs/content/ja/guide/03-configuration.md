---
title: 設定
description: mount() のオプションと <md-book> の属性の一覧。
---

# 設定

## `<md-book>` の属性

| 属性 | 意味 |
| --- | --- |
| `manifest` | `manifest.json` の URL（既定: ページの隣） |
| `base` | サイトのベースパス。例: `/docs/` |
| `router` | `history`（既定）または `hash` |
| `heading` | ヘッダーと `<title>` に使うサイト名 |
| `theme` | `light`、`dark`、`system`（初期モード） |
| `blog` | 付けるとブログのルートが有効になる |
| `blog-dir` | ブログのディレクトリ（既定 `blog`） |
| `blog-per-page` | 一覧 1 ページあたりの記事数（既定 `10`） |
| `blog-sidebar` | `false` でブログのページ（一覧・タグ・カテゴリ・記事）のサイドバーを隠す |
| `site-url` | canonical / Open Graph のリンクに使う絶対 URL |

`slot="navbar-end"`、`slot="sidebar-top"`、`slot="page-footer"` を持つ子要素は、シェルの
対応する領域に移されます。

## `mount(target, options)`

```ts
import { mount } from '@ibitsuki0296/md-book/runtime';

await mount('#app', {
  manifestUrl: '/manifest.json',
  base: '/',
  routerMode: 'history',
  tocDepth: [2, 3],
  theme: { default: 'system', toggle: true },
  blog: { dir: 'blog', perPage: 10 },
  seo: { siteUrl: 'https://example.com/', siteName: 'My Docs', twitterSite: '@me' },
  highlight: (code, lang) => myHighlighter(code, lang),
});
```

`mount()` は最初のページを描画し終えると解決し、`{ element, theme, navigate, destroy }` を返します。

## フロントマター

```yaml
---
title: ページのタイトル
description: 抜粋とメタディスクリプションに使われる
date: 2026-02-01        # 付けるとブログ記事になる
updated: 2026-02-10
tags: [guide, intro]
categories: [Handbook]
draft: true             # 本番ビルドから除外される
order: 2                # ディレクトリ内でのサイドバーの位置
slug: custom-slug       # パスから決まるスラッグを上書きする
sidebar: false          # このページのサイドバーを隠す
cover: /img/cover.png
author: Your Name
---
```

## CLI

```bash
md-book manifest <contentDir> --base / --title "My Docs"
md-book feed <contentDir> --site-url https://example.com/ --formats rss,atom
md-book dev --root . --content ./content --port 4173
```

## ランディングページ

ページのフロントマターに `layout: home` を付けると、ヒーローとフィーチャーカードを持つ全幅の
ランディングページになります（サイドバー・目次・ページャはありません）。Markdown の本文は
その下に描画されるので、`# h1` は書かないでください。`hero.name` がページの `<h1>` になります。

```yaml
---
title: My project
layout: home
hero:
  name: v1.0
  text: 売り込みの見出し
  tagline: 補足の一文。`code` も使えます。
  actions:
    - text: はじめる
      link: /ja/guide/getting-started   # ルートのパス、#hash、絶対 URL
    - text: GitHub
      link: https://github.com/you/project
      theme: alt                         # brand（先頭の既定）| alt
features:
  - icon: "✎"
    title: Markdown だけ
    details: 短い説明。
    link: /ja/guide/showcase             # 省略可: カード全体がリンクになる
---
```

リンクとして使えるのは、`http(s):`、`mailto:`、`#hash`、サイト内のパスだけです。

## サイドバーの順序

同じ階層のページは、`order`（または `NN-` で始まる数字のファイル名）、次に `date` の新しい順、
最後にタイトルの順に並びます。そのため、ブログ記事は追加の設定なしで新しい順に並びます。
