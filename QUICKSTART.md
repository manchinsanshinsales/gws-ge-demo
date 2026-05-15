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

Gemini Enterprise AI エージェントと連携する Google Chat アプリを、Google Workspace アドオン（Apps Script）として構築します。

#### 3-1. 前提確認

- Business または Enterprise Google Workspace アカウント（Google Chat アクセス権あり）
- 課金有効な Google Cloud プロジェクト
- Google Identity を ID プロバイダとして設定済みの Gemini Enterprise アプリ

#### 3-2. Chat API を有効化

Google Cloud Console で **Google Chat API** を有効にします。

#### 3-3. OAuth 同意画面を構成

1. **Google Auth Platform** → **ブランディング** → **スタートガイド**
2. アプリ名・サポートメール入力 → **続行**
3. 対象: **内部** → **続行**
4. 連絡先メールアドレス入力 → **続行** → **作成**

> スコープの追加は現時点でスキップ可。

#### 3-4. サービスアカウントを作成

1. **IAM と管理** → **サービス アカウント** → **サービス アカウントを作成**
2. 名前・説明を入力 → ロールに **Discovery Engine User** を付与 → **完了**
3. 作成したサービスアカウントを選択 → **鍵** → **鍵を追加** → **新しい鍵を作成** → **JSON**
4. ダウンロードした JSON ファイルを `credentials.json` として保存

> ⚠️ 秘密鍵はソース管理に含めないこと。

#### 3-5. Apps Script プロジェクトをセットアップ

1. Cloud Console → **IAM と管理** → **設定** で **プロジェクト番号** と **プロジェクト ID** をメモ
2. Gemini Enterprise を開き、アプリの **ロケーション** と **ID** をメモ
3. [GE AI Agent Quickstart Apps Script プロジェクト](https://script.google.com/d/1fd38aepczRJ6_ges8gDWpdYKbDDGFugq9fTAZRplF_HgecHh3LXSH4lF/edit?usp=sharing&hl=ja) を開く → **概要** → **コピーを作成**
4. **プロジェクトの設定** → **スクリプト プロパティを編集** → 以下を追加:

   | プロパティ名 | 値 |
   |---|---|
   | `REASONING_ENGINE_RESOURCE_NAME` | `projects/PROJECT_ID/locations/APP_LOCATION/collections/default_collection/engines/APP_ID` |
   | `SERVICE_ACCOUNT_KEY` | credentials.json の内容をそのまま貼り付け (`{ ... }`) |

5. **スクリプト プロパティを保存**
6. **プロジェクトの設定** → **Google Cloud Platform（GCP）プロジェクト** → **プロジェクトを変更** → プロジェクト番号を入力 → **プロジェクトを設定**

#### 3-6. テスト デプロイを作成（Head Deployment ID を取得）

1. Apps Script プロジェクト → **デプロイ** → **デプロイをテスト**
2. **ヘッド デプロイ ID** をコピー → **完了**

#### 3-7. Google Chat アプリを構成

1. Google Cloud Console → **Google Chat API** → **管理** → **構成**
2. 以下を設定:

   | 項目 | 値 |
   |---|---|
   | アプリ名 | `GE Quickstart` |
   | アバターの URL | `https://developers.google.com/workspace/add-ons/images/quickstart-app-avatar.png` |
   | 説明 | `GE Quickstart` |
   | 機能 | **スペースとグループの会話に参加する** にチェック |
   | 接続設定 | **Apps Script プロジェクト** を選択 |
   | デプロイ ID | 3-6 でコピーしたヘッド デプロイ ID |
   | 公開設定 | **ドメイン内の特定のユーザーとグループ** → 自分のメールアドレス |

3. **保存**

#### 3-8. Chat アプリをテスト

1. [Google Chat](https://chat.google.com) を開く
2. **新しいチャット** → Chat アプリ名（`GE Quickstart`）を検索 → 選択
3. 以下のメッセージを送信:
   ```
   I need to find ideas!
   ```
4. デフォルトのアイデア生成エージェントからレスポンスが返ることを確認 ✅

#### トラブルシューティング（アドオン）

| 症状 | 対処 |
|---|---|
| Chat に「問題が発生しました」と表示 | Cloud Console → Chat API → エラーロギングを確認 |
| Chat アプリが検索結果に出ない | Chat API の **公開設定** に自分のメールが含まれているか確認 |
| スクリプト プロパティが反映されない | Apps Script の **デプロイ → デプロイをテスト** を再実行 |

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
