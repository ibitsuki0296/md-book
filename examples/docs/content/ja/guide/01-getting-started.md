---
title: はじめに
description: md-book をインストールして最初のページを表示します。
---

# はじめに

## インストール

```bash
npm install @ibitsuki0296/md-book
```

## マニフェストを作る

ブラウザは自力でディレクトリを読めないため、Markdown ファイルの一覧が必要です。

```bash
npx md-book manifest ./content --locales en,ja
```

`content/manifest.json` が書き出されます。デフォルト言語は content 直下、その他の言語は `ja/` のような
ディレクトリに置きます。

## ページを表示する

見た目の変え方は [テーマ](../../guide/02-theming.md) を参照してください。
