# IccusheSEOToolCrawler

<div align="right">
  <a href="#english">English</a> | <a href="#日本語-japanese">日本語</a>
</div>

<br />

> A Windows desktop application built with Electron that crawls a website by domain to perform bulk SEO configuration checks. Originally developed as a free alternative to paid SEO tools, it allows effectively unlimited spider crawling without arbitrary restrictions.

---

<h2 id="english">🇬🇧 English</h2>

### Features
- **Domain-based Spider Crawling:** Automatically crawls pages within the same domain starting from a given URL.
- **URL List Processing:** Alternatively, input a specific list of URLs to crawl directly.
- **Bulk SEO Data Collection:** Extracts and displays SEO configurations in an easy-to-read list format.
- **Basic Authentication Support:** Crawl restricted environments securely.
- **Export to CSV:** Easily export collected data to a CSV file for further analysis.
- **No Crawl Limits:** Perform extensive crawls without hitting artificial tool limits, enabling SEO checks for mid-sized websites.

### Tech Stack
- **Platform:** Electron (Windows Desktop App)
- **Frontend:** HTML, CSS, Vanilla JS (No React)
- **Backend:** Node.js
- **Data Storage:** Stateless design, disposable runs (No Database)

#### Key Libraries
- **Data Grid:** [Tabulator](http://tabulator.info/) *(virtual DOM required)*
- **HTTP Client:** axios
- **HTML Parsing:** cheerio
- **Concurrency Control:** p-queue
- **Robots.txt Parsing:** robots-parser
- **CSV Output:** csv-stringify + Node.js `fs` module

### Setup & Installation

**Prerequisites:**
- Node.js version **v25.2.1**

1. Clone the repository and navigate to the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
   *(Note: No environment variables are required to run the app.)*

### Usage Guide

1. Start the application:
   ```bash
   npm start
   ```
2. The Electron desktop window will open.
3. **Start Crawling:** Enter a starting URL or paste a list of URLs into the input field on the UI.
4. **View Results:** The application will crawl the site(s) and display the collected SEO data in an interactive data grid.
5. **Export Data:** Use the export button to save the collected data as a CSV file to your local machine.

### Roadmap
- Improve the user interface and overall usability for deeper SEO analysis.
- Add specific data output formats optimized for AI-based analysis tools.

### License
This project is licensed under the MIT License.

### Contribution
This project is primarily for personal use. At this time, contributions are not actively accepted.

---

<h2 id="日本語-japanese">🇯🇵 日本語 (Japanese)</h2>

IccusheSEOToolCrawler は、ドメイン単位でウェブサイトをクロールし、SEO設定を一括チェックできるWindowsデスクトップアプリケーションです。有料のSEOツールの代替として個人利用目的で開発されました。クロール数に制限を設けていないため、中規模サイトのSEOチェックも柔軟に行うことができます。

### 主な機能
- **スパイダークロール:** 指定した起点URLから、同一ドメイン内のページを自動的にクロールします。
- **URLリスト入力:** 特定のURLリストを直接入力してクロールすることも可能です。
- **SEOデータの一括取得:** 収集したタイトル、メタデータなどのSEO設定を一覧形式で分かりやすく表示します。
- **Basic認証対応:** アクセス制限がかけられたテスト環境などでも利用可能です。
- **CSVエクスポート:** 収集したデータをCSVファイルとして出力し、スプレッドシート等で詳細な分析ができます。
- **クロール無制限:** ツール起因によるクロール数の上限がなく、大規模なチェックが可能です。

### 技術スタック
- **プラットフォーム:** Electron (Windowsデスクトップアプリ)
- **フロントエンド:** HTML, CSS, Vanilla JS (React等のフレームワークは不使用)
- **バックエンド:** Node.js
- **データ保存:** データベースなし (ステートレスな使い捨ての実行モデル)

#### 主要ライブラリ
- **データグリッド:** [Tabulator](http://tabulator.info/) *(パフォーマンス最適化のためvirtual DOM利用)*
- **HTTPクライアント:** axios
- **HTMLパーサー:** cheerio
- **並行処理制御:** p-queue
- **robots.txt解析:** robots-parser
- **CSV出力:** csv-stringify + Node.js `fs` モジュール

### セットアップとインストール

**前提条件:**
- Node.js バージョン **v25.2.1**

1. リポジトリをクローンし、プロジェクトフォルダに移動します。
2. 依存関係をインストールします:
   ```bash
   npm install
   ```
   *（注意: 実行にあたって環境変数の設定は必要ありません。）*

### 使い方（使用フロー）

1. アプリケーションを起動します:
   ```bash
   npm start
   ```
2. Electronのデスクトップウィンドウが開きます。
3. **クロールの開始:** 画面上の入力欄に、起点となるURL、またはクロールしたいURLのリストを入力して開始します。
4. **結果の確認:** アプリケーションがクロールを実行し、取得したSEOデータがインタラクティブなデータグリッド上に一覧表示されます。
5. **データのエクスポート:** エクスポート機能を使用して、表示されているデータをCSVファイルとしてローカルに保存できます。

### 今後のロードマップ
- SEO分析をより直感的に行えるよう、ユーザビリティの向上。
- AIを用いた分析ツールに取り込みやすいフォーマットでのデータ出力機能の追加。

### ライセンス
このプロジェクトは MIT ライセンスの下で公開されています。

### コントリビューション
本プロジェクトは主に個人利用を想定しており、現在、外部からのコントリビューション（Pull Request等）は積極的に受け付けておりません。
