# PDF fonts

Static instances cut from the variable fonts the web app already uses, for the pitch pack PDF (pdfkit cannot select variable-font axes):

| File | Source | Instance |
|---|---|---|
| `Bricolage-Display-Condensed-ExtraBold.ttf` | Bricolage Grotesque (latin subset) | wdth 75, wght 800, opsz 96 |
| `Bricolage-Display-Bold.ttf` | Bricolage Grotesque (latin subset) | wdth 85, wght 700, opsz 48 |
| `Inter-Regular.ttf`, `Inter-SemiBold.ttf` | Inter (latin subset) | wght 400 / 600 |

Both families are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org). Instances were cut with fontTools `varLib.instancer`.
