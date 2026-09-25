---
title: Vertical writing
description: "Publish tanka and other Japanese text in 縦書き with `writing: vertical`, the `:::tanka` block and ruby."
---

# Vertical writing

Add `writing: vertical` to a page's front matter and the article is set in
vertical-rl (縦書き): lines run top to bottom, stack from right to left, and the
page scrolls sideways. The mouse wheel is mapped onto that horizontal scroll.

```md
---
title: 短歌
writing: vertical
---

:::tanka
東海の小島の磯の白砂に
われ泣きぬれて
蟹とたはむる
:::
```

See the [live example](/tanka).

## The `:::tanka` block

`:::tanka` keeps every line break exactly as written, so one line of the source is
one line of the poem. An optional title after the name becomes a small heading.
It works on horizontal pages too:

:::tanka 一握の砂
たわむれに母を背負いて
そのあまり軽きに泣きて
三歩あゆまず
:::

## Ruby (ふりがな)

`{漢字|かんじ}` renders a ruby annotation — `<ruby>` with `<rp>` fallbacks, so it
degrades to 漢字(かんじ) where ruby is unsupported. It works in both writing modes
and in headings. Turn it off with `ruby: false` in the render options.

:::tanka
{東海|とうかい}の{小島|こじま}の{磯|いそ}の{白砂|しろすな}に
われ{泣|な}きぬれて
{蟹|かに}とたはむる
:::

## Vertical blocks in a horizontal page

To set just one block vertically, use `:::vertical`, or add the `.vertical`
modifier to any container:

```md
:::tanka.vertical 一握の砂
ふるさとの訛なつかし
停車場の人ごみの中に
そを聴きにゆく
:::
```

:::tanka.vertical 一握の砂
ふるさとの訛なつかし
停車場の人ごみの中に
そを聴きにゆく
:::

:::vertical
どんな Markdown でも縦書きにできます。
数字は 12月3日 のように、二桁までなら縦中横になります。
:::

The block is at most `--md-book-vertical-height` tall and scrolls sideways if it
outgrows the column. Inside a `writing: vertical` page the modifier changes
nothing, since everything is already vertical.

## Tuning

| Token | Default | Effect |
|---|---|---|
| `--md-book-font-serif` | mincho stack | Typeface for vertical pages and tanka |
| `--md-book-vertical-height` | `clamp(22rem, 72vh, 42rem)` | Height of the vertical reading area |

:::note
Code blocks and tables inside a vertical page stay horizontal.
:::
