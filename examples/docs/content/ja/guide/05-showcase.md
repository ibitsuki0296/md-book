---
title: ショーケース
description: 見出し、コールアウト、表、ハイライト付きコードなど、コンテンツ部品を 1 ページに。
---

# ショーケース

コンテンツ部品をひと通り見ていきます。本文は読みやすい行幅で組まれ、
[リンク](/ja/guide/theming)、`インラインコード`、**強調**はライトでもダークでも読みやすいままです。

## コールアウト

:::note ノート
ノートは、読み飛ばしてもよい補足に使います。
:::

:::tip ヒント
ヒントは、よりよいやり方を示します。
:::

:::warning 注意
注意は、あとで困りそうなことを知らせます。
:::

:::danger 危険
危険は、破壊的で元に戻せない操作に使います。
:::

:::details クリックで開く
詳細は標準の開閉要素として描画されます。JavaScript は不要です。
:::

## 表

| トークン | 用途 | 既定値 |
|---|---|---|
| `--md-book-color-accent` | リンク、フォーカスリング、選択状態 | `#4f46e5` |
| `--md-book-radius` | カード、コードブロック、コールアウト | `0.75rem` |
| `--md-book-measure` | 読みやすい行幅 | `46rem` |

## コード

### TypeScript

```ts
import { renderMarkdown } from '@ibitsuki0296/md-book';

interface Options {
  tocDepth?: [number, number];
}

/** ページを描画して、目次を返す。 */
export function toc(source: string, options: Options = {}) {
  const { toc, frontMatter } = renderMarkdown(source, options);
  console.log(`${frontMatter.title ?? 'Untitled'}: ${toc.length} sections`, 42, true);
  return toc; // done
}
```

### CSS

```css
@layer md-book.components {
  .md-book-container {
    padding: 0.9rem 1.1rem;
    border-radius: var(--md-book-radius);
    background: color-mix(in srgb, var(--_c) 8%, transparent);
  }
}
```

### シェル、JSON、YAML

```bash
# デモをインストールして起動する
npm install -D @ibitsuki0296/md-book
npx md-book manifest --root docs --out "$OUT_DIR"
```

```json
{
  "version": 1,
  "title": "My docs",
  "nav": [{ "text": "Guide", "link": "/guide/" }],
  "draft": false
}
```

```yaml
title: Showcase
tags: [design, tokens]
draft: false
order: 5
```

```diff
- --md-book-color-accent: #2563eb;
+ --md-book-color-accent: #4f46e5;
```

### HTML

```html
<md-book manifest="/manifest.json" lang="ja" blog></md-book>
```
