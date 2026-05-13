# アーキテクチャ クイックリファレンス

3つのソリューションの構成を、聞かれたときにすぐ説明できるよう1枚にまとめました。

---

## 共通の基盤

```
┌─────────────────────────────────────────────────────────────┐
│  Gemini Enterprise App (codelab)                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  接続済みデータストア (OAuth 認証)                  │    │
│  │  ├─ calendar    (Google カレンダー)                 │    │
│  │  ├─ gmail       (Google Gmail)                      │    │
│  │  ├─ drive       (Google ドライブ)                   │    │
│  │  └─ notebooklm  (NotebookLM)                        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ 全ソリューション共通
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ノーコード         プロコード           アドオン
   (Agent Designer)   (ADK / MCP)        (Apps Script)
```

---

## ① ノーコード エージェント

```
User
  │
  ▼
[Gemini Enterprise Web App]
  │
  ▼  自然言語の質問
[Custom Agent (Agent Designer 製)]
  │
  ├─▶ [Gemini モデル] で推論
  │
  └─▶ [Data Stores] (Calendar / Gmail / Drive / NotebookLM)
       │
       └─▶ アクション: メール送信 / 予定作成 など
```

**特徴:**
- コードゼロ、自然言語のプロンプトだけで作成
- データストアのアクションを直接呼べる (メール送信、予定作成)
- アクション実行前に Preview & Confirm が入る (Human-in-the-loop)

---

## ② プロコード エージェント (ADK)

```
User
  │
  ▼
[Gemini Enterprise Web App]
  │
  ▼  Bearer Token を ToolContext に注入
[Custom Agent on Vertex AI Agent Engine]   ← agent.py
  │
  ├─▶ [Gemini 2.5 Flash] で推論
  │
  ├─▶ [Vertex AI Search MCP] (search ツール)
  │     └─▶ [Data Stores] 横断検索
  │           (Calendar / Gmail / Drive)
  │
  └─▶ [Function Tool: send_direct_message]
        └─▶ [Google Chat API] DM送信
```

**特徴:**
- ADK で Python で書く
- MCP (Model Context Protocol) で Workspace 全データを **1ツール** で抽象化
- Function Tool でビジネスロジックを自由に実装
- Vertex AI Agent Engine がフルマネージドでホスト

**重要な実装ポイント:**
- `CLIENT_AUTH_NAME = "enterprise-ai"` で Gemini Enterprise の Authorization 名と一致させる
- Gemini Enterprise が `enterprise-ai_<数字>` の形でトークンを ToolContext に注入する
- そのトークンを動的に取り出して MCP / Chat API の Authorization ヘッダに使う

---

## ③ Workspace アドオン

```
User (Gmail / Chat 内)
  │
  ▼
[Workspace Add-on (Apps Script)]
  │   ├─ Gmail Sidebar:  選択中メールのコンテキストを取得
  │   └─ Chat App:       チャットメッセージから起動
  │
  ▼  StreamAssist API (SSE)
[Gemini Enterprise App]
  │
  ├─▶ [Gemini モデル]
  │
  └─▶ [Data Stores] (Calendar / Gmail / Drive / NotebookLM)
```

**特徴:**
- 既存の Gmail / Chat UI からエージェントが呼べる
- 開いているメールがエージェントへのコンテキストに自動で入る
- Apps Script + Card Service で UI 構築
- StreamAssist API で Gemini Enterprise と通信

---

## データの流れ — 3パターンの比較

| 観点 | ① ノーコード | ② プロコード | ③ アドオン |
|---|---|---|---|
| **エージェント定義** | Agent Designer | ADK (Python) | (アドオンが直接 GE を呼ぶ) |
| **ホスティング** | Gemini Enterprise | Vertex AI Agent Engine | Apps Script |
| **データアクセス** | データストア (直接) | Vertex AI Search MCP | データストア (StreamAssist) |
| **アクション** | データストア標準アクション | Function Tool (自由) | アドオン側で実装 |
| **UI** | GE Web App | GE Web App | Gmail / Chat |
| **認証** | OAuth (Workspace) | OAuth (Workspace) + Reasoning Engine SA | Apps Script OAuth + SA |
| **ターゲット** | 業務部門 | 開発者 | エンドユーザー |

---

## ②のコードを読むときの脳内マップ

`enterprise_ai/agent.py`

```
1. 設定         : MODEL, CLIENT_AUTH_NAME
2. ヘルパー     : プロジェクトID取得 / ServingConfig 解決 / トークン抽出
3. MCP ツール   : Discovery Engine MCP に接続する McpToolset
4. Function ツール : send_direct_message (Chat API)
5. Root Agent   : LlmAgent(model, instruction, tools=[MCP, FunctionTool])
```

**3〜5** が "エージェントを構成する3層" と覚えるとシンプル:
- ① ツール (能力)
- ② ロジック (instruction)
- ③ モデル (推論)
