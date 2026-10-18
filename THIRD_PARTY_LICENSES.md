# サードパーティのライセンス

このリポジトリに取り込んだ第三者の著作物 (フォント、素材、引用したコード) と、そのライセンスの一覧です。追加の手順と対象の範囲は [docs/third-party-licenses.md](docs/third-party-licenses.md) にあります。

## フロントエンド (apps/web)

### フォント

#### Gen Interface JP

- 取得元: https://gen.typesetting.jp/ (リポジトリ: https://github.com/yamatoiizuka/gen-interface-jp)
- ライセンス: OFL-1.1。本文は [licenses/GenInterfaceJP.txt](licenses/GenInterfaceJP.txt)
- 著作権表示:
  - Copyright 2026 The Gen Interface JP Project Authors (https://github.com/yamatoiizuka/gen-interface-jp)
  - Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter)
  - Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'
- 使っている場所: `apps/web/public/fonts/GenInterfaceJP/` (Regular と Bold)。`apps/web/src/index.css` の `@font-face` で読み込む
- 改変: あり (TTF を WOFF2 に変換。文字の削減はしていない)

### 画像、アイコンなどの素材

#### Sky 171 (Texturelabs)

- 取得元: https://texturelabs.org/textures/sky_171/
- ライセンス: Texturelabs の独自ライセンス (https://texturelabs.org/terms/)。商用利用可、クレジット表記は不要。素材をそのままの形で再配布、販売することは禁止
- 著作権表示: Texturelabs.org
- 使っている場所: `apps/web/src/assets/sky-texture.webp` (ログイン画面の背景)
- 改変: あり (幅 2048px に縮小し、WebP に変換)

### 引用したコード

なし

## バックエンド (apps/api)

### 引用したコード

なし
