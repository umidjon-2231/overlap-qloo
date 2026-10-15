# Overlap brand kit

Logo concept: **Knockout Venn**. Two circles whose overlap is a real transparent cut-out, not a painted shape.

| Colour | Hex |
|---|---|
| Ink | `#111216` |
| Paper | `#F3F3F1` |
| Coral | `#FF5A36` |

The wordmark is Bricolage Grotesque Bold, converted to outlines, so no font is needed.

**Naming:** `light` = for light backgrounds (ink artwork). `dark` = for dark backgrounds (paper artwork). `mono-*` = single colour.

## Layout

```
svg/
  logo/     overlap-logo-horizontal-{light,dark,mono-black,mono-white}.svg   symbol + wordmark side by side
            overlap-logo-stacked-{light,dark}.svg                          symbol above wordmark
  mark/     overlap-mark-{color-light,color-dark,mono-black,mono-white}.svg symbol only
  icon/     overlap-icon-rounded-{dark,coral,light}.svg                     app icons, 512 viewBox
            overlap-icon-square-dark.svg                                    full bleed with safe zone (maskable, avatars)
            favicon.svg
  social/   overlap-og-image.svg
png/
  logo/horizontal/   623w (1x) and 1870w (3x)
  logo/stacked/      408w (1x) and 1225w (3x)
  mark/              512w and 1024w
  icon/<variant>/    16–1024 px per icon variant (rounded-coral, rounded-dark, rounded-light, square-dark)
  app/               apple-touch-icon.png (180), android-chrome-maskable-512.png
  social/            overlap-og-image-1200x630.png
ico/                 favicon.ico (dark), favicon-coral.ico, favicon-light.ico, favicon-transparent.ico
                     each holds 16, 24, 32, 48, 64, 128 and 256 px
```

## Where the web app uses it

| App file | Source |
|---|---|
| `apps/web/app/favicon.ico` | `ico/favicon.ico` |
| `apps/web/app/icon.svg` | `svg/icon/favicon.svg` |
| `apps/web/app/apple-icon.png` | `png/app/apple-touch-icon.png` |
| `apps/web/app/opengraph-image.png` | `png/social/overlap-og-image-1200x630.png` |
| `apps/web/public/brand/overlap-logo-horizontal-light.svg` | header logo |
| `apps/web/public/brand/overlap-mark-color-light.svg` | symbol for UI use |

If you change a file here, copy it to the app path again.
