<div align="center">

# Claude Chan 🤖

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![Anthropic Claude](https://img.shields.io/badge/Anthropic-Claude-blue.svg)](https://www.anthropic.com/)
[![Slack API](https://img.shields.io/badge/Slack-API-green.svg)](https://api.slack.com/)

Slack で動作する次世代 AI アシスタント。世界中のデータセンターで動作し、高速かつスケーラブルな AI 対話を実現。

[デモ](#デモ) • [機能](#主な機能) • [クイックスタート](#クイックスタート) • [設定](#詳細設定) • [貢献](#貢献)

</div>

---

## 概要

Claude Chan は、Cloudflare Workers と Anthropic の Claude API を活用した Slack ボットです。エッジでの実行により、低レイテンシーな応答と高いスケーラビリティを実現しています。会話履歴は Cloudflare D1 に保存され、文脈を考慮した自然な対話が可能です。

## デモ

![Claude Chan Demo](docs/images/demo.gif)

## 主な機能

### 🎯 コア機能

- 💬 Slack 上での AI アシスタントとの自然な対話
- 🧵 スレッドベースの会話履歴管理
- 📝 D1 データベースによる永続的な会話記録
- 🔒 セキュアな環境変数管理
- ⚡ 世界中のデータセンターを活用した高速レスポンス

### 🎨 特別な機能

- 🌐 マルチチャンネル対応
- 🔄 文脈を考慮した継続的な会話
- 📊 使用状況の統計トラッキング
- 🎭 カスタマイズ可能な AI ペルソナ
- ⌨️ 便利な Slack コマンド機能

## 技術スタック

### バックエンド

- [Cloudflare Workers](https://workers.cloudflare.com/)

  - エッジでの実行による低レイテンシー
  - グローバルな分散処理
  - 自動スケーリング

- [Cloudflare D1](https://developers.cloudflare.com/d1/)
  - エッジ最適化された SQLite データベース
  - 高速なクエリ処理
  - 自動バックアップ

### フレームワーク

- [Hono](https://hono.dev/)
  - 💨 超軽量で高速
  - 📝 TypeScript ファースト
  - 🔌 ミドルウェアエコシステム
  - 🎯 パスパラメータとクエリ処理
  - 🔒 セキュリティ機能内蔵

### API 統合

- [Anthropic Claude API](https://www.anthropic.com/)

  - 高度な自然言語処理
  - コンテキスト認識能力
  - カスタマイズ可能な応答

- [Slack Web API](https://api.slack.com/)
  - リアルタイムメッセージング
  - インタラクティブコンポーネント
  - ファイル共有機能

## システム要件

### 必須要件

- Node.js 18 以上
- npm または yarn
- Git

### アカウント要件

- Cloudflare アカウント
  - Workers の有効化（無料枠あり）
  - D1 データベースの有効化
- Anthropic アカウント
  - API キーの取得
  - 適切な利用枠の設定
- Slack ワークスペース管理者権限
  - ボット用アプリの作成権限
  - 必要なスコープの設定権限

## クイックスタート

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/claudechan.git
cd claudechan

# 依存関係のインストール
npm install

# 開発サーバーの起動
npx wrangler dev
```

## 詳細設定

### 1. 環境変数の設定

以下の環境変数を Cloudflare Workers のダッシュボードで設定してください：

必須の環境変数:

- `ANTHROPIC_API_KEY`: Anthropic API キー
- `SLACK_BOT_TOKEN`: Slack ボットのトークン
- `SLACK_SIGNING_SECRET`: Slack アプリケーションの署名シークレット
- `SLACK_APP_TOKEN`: Slack アプリケーショントークン

### 2. Slack アプリケーションの設定

1. Event Subscriptions の有効化

   - Request URL に`https://your-worker-name.workers.dev/slack/events`を設定
   - 以下のイベントを購読:
     - `message.channels`
     - `message.groups`
     - `message.im`

2. 必要なスコープ:
   - `chat:write`
   - `channels:history`
   - `groups:history`
   - `im:history`
   - `files:read`
   - `reactions:write`

### 3. データベースのセットアップ

```bash
# D1データベースの作成
npx wrangler d1 create claudechan-db

# スキーマの適用
npx wrangler d1 execute claudechan-db --local --file=./db/schema.sql
```

### 4. wrangler.toml の設定

```toml
name = "claudechan"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[ d1_databases ]]
binding = "DB"
database_name = "claudechan-db"
database_id = "your-database-id"
```

## 開発フロー

### ローカル開発

```bash
# 開発サーバー起動
npx wrangler dev

# TypeScript型の生成
npx wrangler types --env-interface CloudflareBindings

# 型チェック
npx tsc --noEmit
```

### デプロイ

```bash
# プロダクションデプロイ
npx wrangler deploy --minify
```

## トラブルシューティング

### D1 接続エラー

- ✅ `wrangler.toml`の設定確認
- ✅ データベース ID の確認
- ✅ ローカルデータベースの初期化確認

### Slack 連携エラー

- ✅ 環境変数の設定確認
- ✅ アプリケーションのスコープ確認
- ✅ イベントサブスクリプションの URL 確認
- ✅ 署名シークレットの一致確認

## パフォーマンスモニタリング

- Cloudflare ダッシュボードでのメトリクス監視
- D1 クエリパフォーマンスの最適化
- メモリ使用量の監視
- レスポンスタイムの追跡

## セキュリティ考慮事項

- 🔒 環境変数の適切な管理
- 🔑 API キーのローテーション
- 📝 アクセスログの監視
- 🛡️ レート制限の設定
- 🔐 Slack 署名の検証

## 貢献ガイドライン

1. このリポジトリをフォーク
2. 機能ブランチの作成
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. 変更をコミット
   ```bash
   git commit -m '機能追加: 新機能の説明'
   ```
4. プッシュと PR 作成
   ```bash
   git push origin feature/amazing-feature
   ```

## ライセンス

[MIT ライセンス](LICENSE) © 2024 たにあん

## 作者

[@moritaniantech](https://github.com/moritaniantech)

---

<div align="center">

**[トップに戻る](#claude-chan-)**

</div>
```

```

```
