# Sidekick asset provenance

## Generation record

- Generated: 1 August 2026
- Tool path: Codex built-in image generation
- Use case: `stylized-concept`
- Output intent: production classroom quiz character assets
- Post-processing: flat chroma-key removal with the ImageGen skill helper, then 512, 256, and 128 px PNG/WebP exports
- License: see [LICENSE](LICENSE)

The two user-provided concept sheets were used only as visual references for the
glossy sticker treatment, proportions, outline weight, expressions, and palette.
Each shipped Sidekick was generated as a new standalone image rather than cropped
from either sheet.

| Reference | SHA-256 |
|---|---|
| `ChatGPT Image Aug 1, 2026 at 04_50_59 PM.png` | `44f25b8ed48af4c16d39bfa9d728949ecd3ca6b9237ae28e82c7d54e1fb40a75` |
| `ChatGPT Image Aug 1, 2026 at 04_51_10 PM.png` | `01c3999444c0b25add3fefba6cd85f85ea6470bda696d5fb3dfb68f19439e7cb` |

## Shared generation specification

> Create one new standalone Markdown Mash Sidekick. Use the concept sheets only
> as style references for the glossy 3D sticker language, proportions, chunky
> white outline, facial style, and palette. Center one fully visible character on
> a square canvas with generous padding and a strong silhouette that remains
> readable at 48 px. Use a perfectly flat chroma-key background with no shadows,
> gradients, texture, floor, reflections, text, numbers, card, border, or
> watermark.

Green subjects used a flat magenta key; all other subjects used a flat green key.
The common specification was combined with each character description below.

| ID | Character-specific request | Built-in source output | 512 px PNG SHA-256 |
|---|---|---|---|
| `shades` | Cheerful teal cat with a compact rounded body, black-purple oversized sunglasses, and one paw raised in a friendly wave. | `exec-33fd795c-1c10-489e-94a6-9a941fa79c2a.png` | `62214647d11cd85a52c9b9d959b5a8decf8585d8691b4ea785fd70afde4c4582` |
| `boo` | Non-scary pale-lavender ghost with a rounded flowing base, two raised arms, black oval eyes, happy smile, and pink cheeks. | `exec-010fc404-2d91-451b-8a4c-1a2be1489985.png` | `0b2b160582308e31d8f4d214862da5b4ecce6641c0694a20872327b6278f8ddb` |
| `zap` | Golden-yellow lightning bolt with a bold zigzag silhouette, black oval eyes, a warm smile, and pink cheeks. | `exec-5508aa3e-21dd-43b6-921b-7596e1553659.png` | `dcd1d6a3b04df36781df3228248bc0085b698b2b0bf320ce3a51aac3966a204b` |
| `stella` | Golden-yellow five-point star with softly rounded points, black oval eyes, a gentle smile, and pink cheeks. | `exec-3351d710-00dd-403e-90c7-b6eb3c31f04b.png` | `250cf9be7a07cb23fea2d7cd205c71b1a49561ed2fe555e9527ee100591c1cd2` |
| `byte` | Rounded white robot head with purple ear caps and antenna, a black face screen, and simple cyan smiling features. | `exec-9a3eff95-1ec1-4edf-bc6e-a3c5c512c172.png` | `cfc5146fbc61197cdf746425a706875fc32b54330b1a97f95b879311587ab7de` |
| `nimbus` | Soft white cloud with three large lobes, black oval eyes, a happy smile, and pink cheeks. | `exec-a530db84-54ec-4795-8756-93998d5877f6.png` | `f6ad145fe1acdc2e0f704f0fdc1e73af23ebcc4f3158ad3542d5cef9630a1528` |
| `zog` | Mint-green rounded alien blob with one short antenna, one large eye, a wink, a happy smile, and pink cheeks. | `exec-c95162ae-f7e1-451f-b619-115daddd06d0.png` | `09651341be257a34950d073805f0d6815189baa7e120ff132f2b98ef9daa2278` |
| `pixel` | Rounded purple game controller with a yellow directional pad, four colorful buttons, black oval eyes, and a smile. | `exec-a2694ddc-ebd7-4fe0-af86-f61313862fa0.png` | `9925766559cb9e4eef4900e49cda55f9ad26db517e80c0c0a7befb515247edc2` |
| `rocketo` | Compact white rocket tilted upward, with purple nose and fins, cyan window, friendly face, and short orange-yellow flame. | `exec-acbf2007-3a8c-412b-b488-7c7977076652.png` | `68bc8fd5d4484e7a1b05d68c20d6c3fd63854d6baf4acde39e4fe23a2eae2d9f` |
| `luna` | Pale-gold crescent moon with rounded tips, one playful wink, a happy smile, and pink cheeks. | `exec-158040ef-dd52-41b6-922b-7737482ea2b3.png` | `6b0feb3efebed97d08b77e01b754dd14d0066ca021b7d474f4359af930c5b49d` |
| `booky` | Rounded purple book with cream pages, teal bookmark, black oval eyes, happy smile, pink cheeks, and tiny arms. | `exec-2a8fa8ed-ecf3-42e4-a897-b24c865041c8.png` | `609109a8ad2e92626dedf1d0ed89240ef37f0a609a34ba88acbb6a0a29b97a8b` |
| `fitzy` | Bright blue jigsaw puzzle piece with a bold silhouette, black oval eyes, happy smile, pink cheeks, and tiny arms. | `exec-4e5b0b21-72a9-40bb-8b86-cad5b95eb5f2.png` | `dd22063c3a2acb4f4a0b6a8a91f1cef68aa89cb30358c3b03ee0d755f7e57fb8` |
| `comet` | Diagonal cyan-blue comet with a swept-back trail and warm yellow smiling core. | `exec-d19b6eff-c23b-4805-b5f5-720c415ac6d6.png` | `b2891082bbf6fe029585fad4977dd27b1072be59d1d3d38dd283696361c3734a` |
| `heartbeat` | Plump coral-pink heart with rounded lobes, black oval eyes, happy smile, and lighter pink cheeks. | `exec-fad7e915-de13-48f5-b127-781ffab27553.png` | `a160c0076168676d6e1a8c8d602103a17ac794c38ae2020c1f95a13ca472db20` |
| `popstar` | Red-and-cream striped popcorn tub overflowing with a rounded popcorn cluster, friendly face, pink cheeks, and tiny arms. | `exec-8083f048-4f54-4682-8bc3-ad12aed053a8.png` | `35c676cca124237264b343eabd3021fc6b776d5ee0bd9263932d3c5dfa35af74` |
| `chestie` | Closed wooden treasure chest with warm brown planks, rounded gold trim, a central latch, black oval eyes, and gentle smile. | `exec-0bf5bb65-b83c-4cdb-a7d2-f8ab70c63eaf.png` | `5414dd4f94d989e2b751ec6741ba8a99292d2c15e165b05620cca65abdd1dc15` |

## Export contract

- `png/<id>.png`: 512 × 512 RGBA fallback/master
- `png/256/<id>.png`: 256 × 256 RGBA fallback
- `png/128/<id>.png`: 128 × 128 RGBA fallback
- `webp/512/<id>.webp`: 512 × 512 primary asset
- `webp/256/<id>.webp`: 256 × 256 primary asset
- `webp/128/<id>.webp`: 128 × 128 primary asset

All sixteen 512 px PNGs were verified to have transparent corners. The combined
WebP payload across all three exported sizes is approximately 484 KB.
