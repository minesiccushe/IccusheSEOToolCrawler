# IccusheSEOToolCrawler

[日本語 (Japanese)](#iccusheseotoolcrawler-1)

## Overview
IccusheSEOToolCrawler is a Windows desktop application that crawls a website by domain and checks SEO configurations in bulk. Originally created for personal use as a free alternative to paid SEO tools, it is now available as an open-source project. It is particularly useful for checking your own websites and enables SEO checks even for mid-sized websites without crawl limits.

## Features
- **Spider Crawling**: Crawls within the same domain from a given URL.
- **URL List Input**: Supports inputting a specific list of URLs to crawl.
- **Data Display**: Displays collected SEO data in a list format.
- **Basic Authentication**: Supports Basic Auth for restricted sites.
- **CSV Export**: Export crawled data directly to a CSV file.
- **No Crawl Limits**: Currently allows effectively unlimited spider crawling.

## Tech Stack
- **Platform**: Electron (Windows Desktop App)
- **Frontend**: HTML / CSS / Vanilla JS (No React)
- **Backend**: Node.js
- **Database**: None (stateless, disposable runs)

### Libraries
- **Data Grid**: Tabulator (virtualDom required)
- **HTTP Client**: axios
- **HTML Parser**: cheerio
- **Concurrency Control**: p-queue
- **robots.txt Parser**: robots-parser
- **CSV Output**: csv-stringify + Node.js fs

## Setup / Installation
- **Node.js version**: v25.2.1

To install the application:
```bash
npm install
```
*Note: No environment variables are required.*

## Usage
To start the application:
```bash
npm start
```
Once started, you can enter a starting URL or a list of URLs. The application will begin spider crawling and list the collected SEO data.

## Output
The collected SEO data is displayed in a data grid within the application. You can export this data as a CSV file for further analysis.

## Roadmap
- Improve usability for SEO analysis.
- Add features to output data in a format suitable for AI-based analysis.

## License
This project is licensed under the MIT License.

## Contribution
Contributions are not actively accepted for this project.

---

# IccusheSEOToolCrawler

[English](#iccusheseotoolcrawler)

## 概要 (Overview)
IccusheSEOToolCrawlerは、ドメイン単位でウェブサイトをクロールし、SEO設定を一括チェックできるWindowsデスクトップアプリケーションです。元々は有料のSEOツールの代替として個人利用のために作成されました。自身のウェブサイトのチェックに特に役立ち、クロール制限がないため中規模サイトのSEOチェックも可能です。

## 機能 (Features)
- **スパイダークロール**: 指定したURLから同一ドメイン内をクロールします。
- **URLリスト入力**: クロールするURLのリスト入力に対応しています。
- **データ一覧表示**: 収集したSEOデータをリスト形式で表示します。
- **Basic認証**: Basic認証が必要なサイトにも対応しています。
- **CSVエクスポート**: 収集したデータを直接CSVファイルとしてエクスポートできます。
- **クロール制限なし**: 現在のところ、実質的に無制限のスパイダークロールが可能です。

## 技術スタック (Tech Stack)
- **プラットフォーム**: Electron (Windowsデスクトップアプリ)
- **フロントエンド**: HTML / CSS / Vanilla JS (React不使用)
- **バックエンド**: Node.js
- **データベース**: なし (ステートレス、使い捨ての実行)

### ライブラリ (Libraries)
- **データグリッド**: Tabulator (virtualDom必須)
- **HTTPクライアント**: axios
- **HTMLパーサー**: cheerio
- **並行処理制御**: p-queue
- **robots.txtパーサー**: robots-parser
- **CSV出力**: csv-stringify + Node.js fs

## セットアップとインストール (Setup / Installation)
- **Node.js バージョン**: v25.2.1

インストール手順:
```bash
npm install
```
*注意: 環境変数の設定は不要です。*

## 使用方法 (Usage)
アプリケーションの起動:
```bash
npm start
```
起動後、開始URLまたはURLリストを入力します。アプリケーションがスパイダークロールを開始し、収集したSEOデータを一覧表示します。

## 出力 (Output)
収集したSEOデータはアプリケーション内のデータグリッドに表示されます。さらに分析を行うために、このデータをCSVファイルとしてエクスポートすることができます。

## ロードマップ (Roadmap)
- SEO分析のための操作性（ユーザビリティ）の向上。
- AIを用いた分析に適したフォーマットでのデータ出力機能の追加。

## ライセンス (License)
このプロジェクトはMITライセンスの下で公開されています。

## コントリビューション (Contribution)
現在、コントリビューションは積極的に受け付けておりません。
