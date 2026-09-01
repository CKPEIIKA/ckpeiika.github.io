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
