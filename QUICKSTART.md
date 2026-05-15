# QUICKSTART ─ Gemini Enterprise × Google Workspace デモ

> **このファイルは？**  
> `README.md` の詳細手順を補う、**デモ当日向けのクイックリファレンス**です。  
> 初回セットアップは先に `README.md` を読んでください。

---

## デモ当日チェックリスト

```
[ ] Google Cloud プロジェクト & Gemini Enterprise ライセンス確認
[ ] gcloud auth login 済み
[ ] カレンダー・Gmail にテストデータ入り (24h 以上前に投入済み)
[ ] OAuth クライアント ID / シークレット 手元にある
[ ] Reasoning Engine デプロイ済み・リソース名をメモ済み
[ ] Gemini Enterprise Web App URL をブラウザのタブで開いてある
```

---

## よく使うコマンド早見表

```bash
# API 有効化
gcloud services enable calendar-json.googleapis.com gmail.googleapis.com \
  people.googleapis.com aiplatform.googleapis.com chat.googleapis.com \
  discoveryengine.googleapis.com cloudresourcemanager.googleapis.com

# MCP 有効化
bash scripts/enable-mcp.sh

# 仮想環境 & 依存関係インストール
python3 -m venv .venv && source .venv/bin/activate
pip install poetry && poetry install

# エージェント デプロイ (5〜10分かかる)
bash scripts/deploy.sh

# デプロイ中 → 別ターミナルで権限付与
bash scripts/grant-permissions.sh
```

---

## デモ 3 本立て ─ 流れまとめ

| # | ソリューション | 使うもの | 時間 |
|---|---|---|---|
| 1 | **ノーコード エージェント** | Agent Designer + Gmail | 約10分 |
| 2 | **プロコード エージェント** | ADK + Reasoning Engine | 約20分 |
| 3 | **Workspace アドオン** | Apps Script + Chat/Gmail | 約10分 |

### STEP 1 ─ ノーコード エージェント (デモ①)

1. Web App → **☰ メニュー** → **+ 新しいエージェント**
2. プロンプト: `An agent that always sends pirate-themed emails but use normal English otherwise`
3. **作成** → エージェントを選択 → **コネクタ → メール → アクションを有効にする**
4. テスト送信:
   ```
   Send an email to <あなたのメール> saying I'll see them at Cloud Next, generate some subject and body yourself
   ```
5. Gmail で受信確認 ✅

### STEP 2 ─ プロコード エージェント (デモ②)

1. `bash scripts/deploy.sh` 実行 → リソース名をコピー
2. Web App → **エージェント** → **+ エージェントを追加** → **Agent Engine**
3. Authorization name: `enterprise-ai`、リソース名・クライアント情報を入力
4. テスト:
   ```
   Please find my meetings for today, I need their titles and links
   ```
5. **Authorize** ボタンで認証 → Chat メッセージ送信テスト ✅

### STEP 3 ─ Workspace アドオン (デモ③)

1. Apps Script テンプレートをコピー & プロパティ設定
2. **デプロイ → テスト → インストール** → Head Deployment ID をコピー
3. Google Chat API → **インタラクティブ機能 ON** → Deployment ID 設定
4. Gmail / Chat のサイドバーから動作確認 ✅

---

## データストア 4 種

| データストア名 | ソース | 有効にするアクション |
|---|---|---|
| `calendar` | Google カレンダー | 予定を作成・更新 |
| `gmail` | Google Gmail | メールを送信 |
| `drive` | Google ドライブ | (なし) |
| `notebooklm` | NotebookLM | (なし) |

---

## クイック動作確認 プロンプト集

```
Do I have any meetings today?
How many emails did I receive today?
Give me the title of the last Drive file I created
Please find my meetings for today, I need their titles and links
Please send a Chat message to <メール> with the following text: Hello!
```

---

## トラブル → `docs/troubleshooting.md` へ
## 詳細手順 → `README.md` へ
## トーク台本 → `docs/demo-script.md` へ
