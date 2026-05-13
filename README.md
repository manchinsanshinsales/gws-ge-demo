# Gemini Enterprise × Google Workspace 統合デモ 手順書

このパッケージは、**Gemini Enterprise** と **Google Workspace** の統合デモを実施するための一式です。
[Google Codelabs: Gemini Enterprise エージェントと Google Workspace を統合する](https://codelabs.developers.google.com/ge-gws-agents?hl=ja) をベースに、デモ向けに必要なものをまとめています。

---

## 0. デモで見せる3つのソリューション

| # | ソリューション | エージェント構築方法 | UI | デモ所要時間 |
|---|---|---|---|---|
| 1 | **ノーコード カスタム エージェント** | Agent Designer (ノーコード) | Gemini Enterprise Web App | 約10分 |
| 2 | **プロコード カスタム エージェント** | Agent Development Kit (ADK) | Gemini Enterprise Web App | 約20分 |
| 3 | **Workspace アドオン** | Apps Script | Gmail / Chat サイドバー | 約10分 |

> **デモ全体の所要時間:** セットアップ完了済みなら 30〜40分 / セットアップ含めると 90〜120分

---

## 1. 事前準備チェックリスト (デモ前日までに完了させる)

デモ当日にハマらないように、**前日までに必ず以下を完了**させてください。

### 1-1. アカウント / 環境

- [ ] Google Cloud プロジェクト (課金有効、オーナー権限)
- [ ] **Gemini Enterprise Standard / Plus エディション** のライセンス
  (なければ初回画面で 30日トライアル を有効化)
- [ ] Business / Enterprise の **Google Workspace** アカウント
- [ ] Google Chat の **スマート機能 ON** ([設定方法](https://support.google.com/mail/answer/15604322?hl=ja))
- [ ] `gcloud` CLI インストール & `gcloud auth login` 完了
- [ ] Python 3.11 以降

### 1-2. デモ用データの仕込み (重要)

エージェントが「答えられる」状態にするため、**自分の Workspace に少量のデータを入れておく**こと。

- [ ] **Google カレンダー**: デモ当日に **2〜3件の予定** を入れておく (タイトルを分かりやすく)
  例: 「10:00 ADK 設計レビュー」「14:00 顧客 A 様 打ち合わせ」
- [ ] **Gmail**: 自分宛てにテスト用メールを 1〜2通送っておく
  例: 件名 `We need to talk` / 本文 `Are you available today between 8 and 9 AM?`
- [ ] **Google ドライブ**: 直近で 1〜2 ファイル作成しておく (Docs / Sheets どちらでも)
- [ ] (任意) **NotebookLM**: ノートブックを1つ作成

> ⚠️ デモ前日にデータを入れると、データストアの同期が間に合わない可能性があります。
> **少なくともデモ24時間前まで**に入れておくと安全。

### 1-3. 有効化が必要な API

```bash
gcloud services enable \
  calendar-json.googleapis.com \
  gmail.googleapis.com \
  people.googleapis.com \
  aiplatform.googleapis.com \
  cloudresourcemanager.googleapis.com \
  chat.googleapis.com \
  discoveryengine.googleapis.com
```

---

## 2. デモ STEP 1 ─ Gemini Enterprise アプリ作成 (10分)

### 2-1. アプリの作成

1. [Google Cloud Console](https://console.cloud.google.com) → 検索バーで `Gemini Enterprise`
2. **+ アプリを作成** をクリック
   - **アプリ名**: `codelab`
   - **ID**: 自動生成 → **必ずコピーしてメモ** (後で何度も使う)
   - **マルチリージョン**: `global (Global)`
3. **作成** をクリック

### 2-2. 認証設定

1. 「フルアクセス権を取得」セクションで **ID を設定** をクリック
2. **Google Identity を使用する** を選択 → **Workforce Identity を確認する**

### 2-3. Agent Designer を有効化

1. 左メニュー → **構成** → **機能管理**
2. **エージェント デザイナーを有効にする** を ON → **保存**

### 2-4. Web App URL の取得

1. アプリ一覧画面で `codelab` をクリック
2. **表示された URL をコピー** ← デモ中に何度も使うので、ブラウザの別タブで開いておく

---

## 3. デモ STEP 2 ─ OAuth 設定 (10分)

### 3-1. OAuth 同意画面

1. Cloud Console → **メニュー ☰** → **Google Auth Platform** → **ブランディング**
2. **開始** をクリック
   - アプリ名: `Codelab`
   - ユーザーサポートメール: 自分のメール
   - 対象: **内部**
   - 連絡先: 自分のメール
   - ポリシー同意 → **作成**
3. **データアクセス** → **スコープを追加または削除**
4. 以下のスコープを **Manually add scopes** に貼り付け:

```
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.calendars
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/cloud-platform
https://www.googleapis.com/auth/chat.messages.create
https://www.googleapis.com/auth/chat.spaces.create
```

5. **テーブルに追加** → **更新** → **保存**

### 3-2. OAuth クライアント認証情報

1. **Google Auth Platform** → **クライアント** → **+ クライアントを作成**
2. アプリケーションの種類: **ウェブ アプリケーション**
3. 名前: `codelab`
4. **承認済みのリダイレクト URI** に以下2つを追加:
   ```
   https://vertexaisearch.cloud.google.com/oauth-redirect
   https://vertexaisearch.cloud.google.com/static/oauth/oauth.html
   ```
5. **作成** → **クライアント ID とクライアント シークレットを必ずメモ** (後で何度も使う)

---

## 4. デモ STEP 3 ─ データストア作成 (15分)

Gemini Enterprise Web App URL を開いて作業します。

### 4-1. カレンダー データストア

1. 左メニュー → **接続されたデータストア** → **+ 新しいデータストア**
2. ソースで **Google カレンダー** を検索 → **選択**
3. アクションで **クライアント ID / クライアント シークレット** を入力 → **認証を確認する**
4. アクション **カレンダーの予定を作成する** と **カレンダーの予定を更新する** を ON
5. **続行**
6. データコネクタ名: `calendar` → **作成**

### 4-2. Gmail データストア

1. **+ 新しいデータストア** → **Google Gmail**
2. **クライアント ID / シークレット** 入力 → **認証を確認する**
3. アクション **メールを送信** を ON
4. データコネクタ名: `gmail` → **作成**

### 4-3. Drive データストア

1. **+ 新しいデータストア** → **Google ドライブ**
2. データセクションで **すべて** を選択
3. データコネクタ名: `drive` → **作成**

### 4-4. NotebookLM データストア

1. **+ 新しいデータストア** → **NotebookLM**
2. データコネクタ名: `notebooklm` → **作成**

> ⏰ 数分後にすべて **アクティブ** になります (NotebookLM を除く)。

### 4-5. 動作確認

Gemini Enterprise Web App でチャットを開き、フッターの **コネクタ** アイコンですべてONにしてから:

```
Do I have any meetings today?
How many emails did I receive today?
Give me the title of the last Drive file I created
```

---

## 5. デモ STEP 4 ─ ノーコード エージェント (10分) 【デモのハイライト①】

### 5-1. エージェントを自然言語で作る

1. Gemini Enterprise Web App → **メニュー ☰** → **+ 新しいエージェント**
2. プロンプト入力:

```
An agent that always sends pirate-themed emails but use normal English otherwise
```

3. Agent Designer がエージェントの定義をドラフトしてエディタを開く → **作成**

### 5-2. エージェントを試す

1. **メニュー ☰** → **エージェント** → 作成したエージェントを選択
2. **コネクタ** アイコン → **メール** → **アクションを有効にする**
3. プロンプト入力:

```
Send an email to <あなたのメールアドレス> saying I'll see them at Cloud Next, generate some subject and body yourself
```

4. プレビューが出るので ✔️ をクリックして送信
5. **メールが届いていることを Gmail で確認**

> 🎯 **デモのキーメッセージ**:
> 「ノーコードで、自然言語の指示だけで、Workspace と連携するエージェントが作れる」

---

## 6. デモ STEP 5 ─ プロコード エージェント (ADK) (20分) 【デモのハイライト②】

### 6-1. このリポジトリの構成

```
ge-gws-demo/
├── README.md                      ← この手順書
├── docs/
│   ├── demo-script.md             ← デモ当日のトークスクリプト
│   └── troubleshooting.md         ← トラブル対応
├── enterprise_ai/
│   ├── __init__.py
│   └── agent.py                   ← エージェント本体 (ADK)
├── scripts/
│   ├── deploy.sh                  ← デプロイスクリプト
│   ├── grant-permissions.sh       ← Reasoning Engine SA 権限付与
│   └── enable-mcp.sh              ← Vertex AI Search MCP 有効化
├── pyproject.toml                 ← Poetry 依存関係
├── requirements.txt               ← pip 依存関係 (poetry 使わない場合用)
└── .env.example                   ← 環境変数テンプレート
```

### 6-2. 追加 API の有効化

```bash
bash scripts/enable-mcp.sh
```

### 6-3. Chat アプリ構成 (Chat 経由でメッセージ送信できるように)

1. Cloud Console → 検索で `Google Chat API` → **管理** → **構成**
2. 設定:
   - アプリ名: `Gemini Enterprise`
   - 説明: `Gemini Enterprise`
   - アバター URL: `https://developers.google.com/workspace/add-ons/images/quickstart-app-avatar.png`
   - **インタラクティブ機能を有効にする**: 一旦 **OFF** (アドオンと共通利用するなら後で再構成)
   - エラーロギング: ON
3. **保存**

### 6-4. エージェントをデプロイ

```bash
# 1. 仮想環境作成
python3 -m venv .venv
source .venv/bin/activate

# 2. Poetry & 依存関係
pip install poetry
poetry install

# 3. デプロイ実行
bash scripts/deploy.sh
```

`deploy.sh` の中で `adk deploy agent_engine` が走ります。**5〜10分** かかります。

### 6-5. Reasoning Engine SA に権限付与

`Deploying to agent engine...` ログが出たら **別ターミナル** で:

```bash
bash scripts/grant-permissions.sh
```

### 6-6. 出力された Reasoning Engine リソース名をコピー

デプロイ完了後、緑色で表示されるリソース名をコピー:
```
projects/<PROJECT_ID>/locations/<LOCATION>/reasoningEngines/<REASONING_ENGINE_ID>
```

### 6-7. Gemini Enterprise に登録

1. Gemini Enterprise → `codelab` アプリ → **エージェント** → **+ エージェントを追加**
2. **Agent Engine によるカスタム エージェント** → **追加**
3. **承認を追加**:
   - Authorization name: `enterprise-ai` ← `agent.py` の `CLIENT_AUTH_NAME` と一致させる **必須**
   - クライアント ID / シークレット: STEP 3-2 で作ったもの
   - トークン URI: `https://oauth2.googleapis.com/token`
   - **認可 URI**: 下記参照 (CLIENT_ID を置換)

   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=<CLIENT_ID>&redirect_uri=https%3A%2F%2Fvertexaisearch.cloud.google.com%2Fstatic%2Foauth%2Foauth.html&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.calendars%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloud-platform%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.send%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fchat.messages.create%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fchat.spaces.create&include_granted_scopes=true&response_type=code&access_type=offline&prompt=consent
   ```

4. **完了** → **次へ**
5. 構成:
   - エージェント名: `Enterprise AI`
   - エージェントの説明: `Enterprise AI`
   - **Agent Engine 推論エンジン**: 6-6 でコピーしたリソース名
6. **作成**

### 6-8. エージェントを試す

1. Web App → **メニュー ☰** → **エージェント** → **組織から** → `Enterprise AI`
2. プロンプト:

```
Please find my meetings for today, I need their titles and links
```

3. **Authorize** をクリックして認証フローを完了
4. 続けて:

```
Please send a Chat message to <あなたのメール> with the following text: Hello!
```

> 🎯 **デモのキーメッセージ**:
> 「カスタムロジック、カスタムツール、MCP — プロコードで自由自在に Workspace を制御できる」

---

## 7. デモ STEP 6 ─ Workspace アドオン (10分) 【デモのハイライト③】

このパッケージには Apps Script のソースは含まれていません (Google が提供する公式テンプレートを直接コピーします)。
詳細は Codelab セクション5を参照してください。要点:

1. サービスアカウント `ge-add-on` を作成 (ロール: **Discovery Engine Viewer**)、JSONキーをダウンロード
2. [Apps Script テンプレート](https://script.google.com/d/1fd38aepczRJ6_ges8gDWpdYKbDDGFugq9fTAZRplF_HgecHh3LXSH4lF/edit?usp=sharing&hl=ja) を開いて **コピーを作成**
3. スクリプトプロパティに `REASONING_ENGINE_RESOURCE_NAME` と `APP_SERVICE_ACCOUNT_KEY` を設定
4. **デプロイ → デプロイをテスト → インストール** → Head Deployment ID をコピー
5. Google Chat API 構成画面で:
   - **インタラクティブ機能** を ON
   - 接続設定: **Apps Script** + Head Deployment ID
   - 公開設定: 特定ユーザー (自分のメール)
6. Gmail / Chat を開いてサイドバーから動作確認

詳細手順は `docs/demo-script.md` を参照。

---

## 8. 当日のデモ進行

`docs/demo-script.md` に **トーク台本付きのデモ進行表** があります。本番直前に必ず読んでください。

---

## 9. トラブルシューティング

うまく動かないときは `docs/troubleshooting.md` を確認。

---

## 10. クリーンアップ

デモが終わったら課金が続かないように:

```bash
# Cloud Console から該当プロジェクトをシャットダウン
# IAM と管理 > 設定 > シャットダウン
```
