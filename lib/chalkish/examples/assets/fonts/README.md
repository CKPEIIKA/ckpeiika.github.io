# Local example fonts

The example boards bundle two static fonts from the Google Fonts repository.
They are presentation assets for the examples, not JavaScript dependencies and
not part of the Chalkish npm archive.

| Local file | Upstream source | Revision | License |
| --- | --- | --- | --- |
| `schoolbell-regular.woff2` | `apache/schoolbell/Schoolbell-Regular.ttf` | `fdcd2ce472b05c4e6b85daecc3dc303e4d476ae2` | Apache-2.0 |
| `walter-turncoat-regular.woff2` | `apache/walterturncoat/WalterTurncoat-Regular.ttf` | `049adcf63176dea41d159e92e7419dee3c24203d` | Apache-2.0 |

Stable source URLs:

- <https://raw.githubusercontent.com/google/fonts/fdcd2ce472b05c4e6b85daecc3dc303e4d476ae2/apache/schoolbell/Schoolbell-Regular.ttf>
- <https://raw.githubusercontent.com/google/fonts/049adcf63176dea41d159e92e7419dee3c24203d/apache/walterturncoat/WalterTurncoat-Regular.ttf>

`LICENSE.txt` is the upstream Apache License 2.0 text. The WOFF2 files retain
all glyphs exposed by the pinned TTF files and were encoded with:

```sh
python -m fontTools.subset INPUT.ttf \
  --output-file=OUTPUT.woff2 \
  --flavor=woff2 \
  --unicodes='*' \
  --layout-features='*' \
  --name-IDs='*' \
  --name-legacy \
  --name-languages='*'
```

Checksums and sizes:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| upstream `Schoolbell-Regular.ttf` | 48,904 | `00ff6655a5eb1eb70d32f2b7351d1bcf3f45f3f9ca40fd5c0d25da79f7f82a50` |
| `schoolbell-regular.woff2` | 22,260 | `97b66d5e2a270e089bc728a8c6c1611fd37cc9e001f180cb6b4feef057c4d5d4` |
| upstream `WalterTurncoat-Regular.ttf` | 153,836 | `ab7e9ca31710733211c5a938d2c851c84c0d21f6af4486f32bc6d374281b2da0` |
| `walter-turncoat-regular.woff2` | 61,228 | `02b3cbfde9ba2df7a4fae1becae8f4b8baf479b4c79ed1fa150fcf093f79bb6b` |
| `LICENSE.txt` | 11,358 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |

## Chalk text fonts used by the site

`neucha-regular.ttf` (Neucha, © 2005–2010 Jovanny Lemonad) and `shantell-sans-regular.ttf`
(Shantell Sans, © 2022 The Shantell Sans Project Authors) are licensed under the SIL Open Font
License 1.1: see `OFL-Neucha.txt` and `OFL-ShantellSans.txt`, copied from the Google Fonts
repository (`ofl/neucha/OFL.txt`, `ofl/shantellsans/OFL.txt`). Neither declares a Reserved Font
Name, so the subsets below keep the family names. The TTF files are kept as sources only: pages load the
WOFF2 subsets below, which keep Latin, Cyrillic, Greek, punctuation, super/subscripts,
arrows, mathematical operators and geometric shapes (every character the demos use that the
fonts contain), all OpenType layout features, and no hinting:

```sh
python -m fontTools.subset INPUT.ttf --output-file=OUTPUT.woff2 --flavor=woff2 \
  --unicodes='U+0020-007E,U+00A0-017F,U+02B0-02FF,U+0300-036F,U+0370-03FF,U+0400-04FF,U+2000-206F,U+2070-209F,U+20AC,U+2100-218F,U+2190-21FF,U+2200-22FF,U+2300-23FF,U+25A0-25FF,U+2700-27BF,U+27C0-27EF' \
  --layout-features='*' --no-hinting --desubroutinize
```

(`fonttools` and `brotli` are needed only to regenerate the files; the site uses none.)

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `neucha-regular.ttf` | 106,228 | `5c7243c15025e1b1726ac3fd776328da85888e34c16a54ec829a13976a8606ce` |
| `neucha-regular.woff2` | 18,116 | `f8a506568eba0c8915d7061d23395d48d334da470a648355a38e000944d7d02a` |
| `shantell-sans-regular.ttf` | 392,708 | `335ce03b4f2e90df95a7e4a383979a817fc4843a33498e8cdb77e692cc740fc4` |
| `shantell-sans-regular.woff2` | 98,744 | `e9f341e54a4ee2fde1366dd1c9263119f70796bf8aca3766806eca7b80deacb2` |
