# auto-kindle-optimizer

iPhone / iPad の共有シート（Share Sheet）から PDF を送信すると、自宅サーバーが [KCC (Kindle Comic Converter)](https://github.com/ciromattia/kcc) で Kindle 向けに最適化した EPUB に変換し、Send to Kindle メールで Kindle 端末へ自動配信するツールです。

## 処理フロー

```
iPhone/iPad の Share
   │  (POST multipart/form-data, Bearer 認証)
   ▼
Hono API ──► SQLite ジョブキュー ──► ワーカー
                                       │  kcc-c2e で EPUB 変換
                                       ▼
                                  Send to Kindle メール送信 (SMTP)
                                       ▼
                                   Kindle 端末
```

## 必要なもの

- Docker / Docker Compose（KCC と Node ランタイムを同梱）
- Send to Kindle メールアドレス（端末ごとの `@kindle.com`）
- 送信に使う SMTP アカウント（例: Gmail のアプリパスワード）
- iPhone / iPad（ショートカットアプリ）
- サーバーと iPhone が同一 LAN、または Tailscale 等の VPN で到達可能であること

## セットアップ

### 1. Amazon 側の設定

1. [コンテンツと端末の管理](https://www.amazon.co.jp/hz/mycd/digital-console/contentlist/pdocs/dateDsc) → 設定 → パーソナル・ドキュメント設定 を開く
2. 端末の Send to Kindle メールアドレス（`xxxx@kindle.com`）を確認する
3. 「承認済み Eメールアドレス一覧」に、本ツールの送信元アドレス（`SMTP_FROM`）を追加する

### 2. 環境変数

```bash
cp .env.example .env
```

`.env` を編集して以下を設定します。

| 変数 | 説明 |
|------|------|
| `API_TOKEN` | ショートカットの認証トークン（長いランダム文字列） |
| `KINDLE_EMAIL` | 端末の `@kindle.com` アドレス |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | 送信元 SMTP の認証情報 |
| `SMTP_FROM` | Amazon の承認済みリストに登録した送信元アドレス |
| `KCC_PROFILE` | デバイスプロファイル（既定 `KPW6` = Kindle Paperwhite 12） |

その他の KCC 変換オプションは `.env.example` のコメントを参照してください。

### 3. 起動

```bash
docker compose up -d --build
```

ヘルスチェック:

```bash
curl http://localhost:3847/api/health
```

### 4. iOS ショートカットの作成

[docs/ios-shortcut.md](docs/ios-shortcut.md) を参照してください。

## API

すべての `/api/jobs*` エンドポイントは `Authorization: Bearer <API_TOKEN>` を必要とします。

### `POST /api/jobs`

PDF をアップロードして変換・配信ジョブを作成します（`multipart/form-data`、フィールド名 `file`）。

```bash
curl -X POST http://localhost:3847/api/jobs \
  -H "Authorization: Bearer $API_TOKEN" \
  -F "file=@manga.pdf"
```

レスポンス（202）:

```json
{ "jobId": "…", "status": "pending", "title": "manga" }
```

### `GET /api/jobs/:id`

ジョブの状態を取得します。`status` は `pending` → `converting` → `sending` → `completed`（失敗時 `failed`）と遷移します。

### `GET /api/health`

サーバーと変換設定の状態を返します（認証不要）。

## KCC 変換プリセット

既定では次の `kcc-c2e` 設定で変換します（`.env` で変更可能）。

```bash
kcc-c2e -p KPW6 -f EPUB -m -u --forcepng -r 1 -t "<タイトル>" -o <出力先> <入力PDF>
```

- `-p KPW6`: Kindle Paperwhite 12（1272x1696、KCC v9.7.2+）
- `-f EPUB`: Send to Kindle は MOBI 非推奨のため EPUB を使用
- `-m`: マンガモード（右開き・見開き分割）
- `-u`: 端末解像度までの拡大
- `--forcepng`: PNG で出力
- `-r 1`: 見開きページを回転（`KCC_SPLITTER` で 0=分割 / 1=回転 / 2=両方）

## 制約

- 送信元は Amazon の承認済みリストに登録が必要
- 添付（変換後ファイル）は 50MB 以下（Amazon 仕様）
- 受け付けるのは PDF のみ
- 単一ユーザー / homelab 向け。インターネット公開する場合は TLS とより強固な認証を別途用意してください

## ローカル開発（Docker を使わない場合）

KCC（`kcc-c2e`）が PATH 上にある環境で:

```bash
pnpm install
cp .env.example .env   # 設定を編集
pnpm dev
```
