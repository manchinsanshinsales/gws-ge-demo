# デモ当日のトークスクリプト

> 想定時間: **30〜40分** (セットアップ完了済み前提)
> 想定聴衆: 企業のIT責任者 / 開発者 / 業務部門マネージャー

---

## 0. オープニング (2分)

> 「本日は Gemini Enterprise と Google Workspace の統合についてデモを通してご紹介します。
> ポイントは3つです。」

1. **ノーコードで誰でも作れる** Workspace 連携エージェント
2. **プロコードで自由に拡張できる** カスタムエージェント (ADK / MCP)
3. **既存の Workspace UI** からエージェントを呼べる Workspace アドオン

> 「これらが同じプラットフォーム上で、同じデータ・同じ認証基盤を共有しながら成立する、というのが Gemini Enterprise の最大の価値です。」

---

## 1. デモパート① ─ ノーコード エージェント (8分)

### 1-1. 前置き (1分)

> 「まず最初に、自然言語の指示だけでエージェントを作ってみます。
> コードは一行も書きません。」

### 1-2. データストア確認 (1分)

Gemini Enterprise Web App を画面共有 → 接続済みデータストアを見せる。

> 「Calendar、Gmail、Drive、NotebookLM、すべて事前に接続済みです。
> 各データストアは OAuth で安全に Workspace のデータを参照しています。」

### 1-3. ベースラインの確認 (2分)

新規チャットでコネクタを全ON → 以下を順に実行:

```
Do I have any meetings today?
```

> 「今日の予定をカレンダーから引いてきました。」

```
Give me the title of the last Drive file I created
```

> 「Drive の中身を検索して、自分が最後に作ったファイルを返してきました。」

### 1-4. エージェントを作る (3分)

**+ 新しいエージェント** → プロンプト:

```
An agent that always sends pirate-themed emails but use normal English otherwise
```

> 「『海賊調でメールを書くけど、それ以外は普通に答える』というエージェントを作ります。
> ご覧の通り、Agent Designer がエージェント定義を自動でドラフトしてくれます。」

→ **作成**

### 1-5. 動かす (1分)

エージェントとチャット:

```
Send an email to <デモ用メアド> saying I'll see them at Cloud Next, generate some subject and body yourself
```

> 「件名と本文も自動生成されました。プレビューが出ますね。
> ここで人間が承認してから初めてメールが送られる、という Human-in-the-loop の仕組みになっています。」

→ ✔️ クリック → Gmail を切り替えてメールを見せる

> 「届きました。海賊調の英語ですね 🏴‍☠️」

### 1-6. クロージング (1分)

> 「ポイント:
> 1. ノーコード、自然言語だけでエージェント作成
> 2. Workspace の Connector が事前に共有されているので、認証も含めて自動連携
> 3. アクション実行前に Preview & Confirm が入って安全」

---

## 2. デモパート② ─ プロコード エージェント (15分) 【一番の見せ場】

### 2-1. 前置き (2分)

> 「次は、より自由度の高いプロコード版です。
> Google が出している ADK (Agent Development Kit) を使って Python で書いたエージェントを、
> Vertex AI Agent Engine にデプロイして、Gemini Enterprise から呼べるようにします。」

**(画面切り替え)** エディタで `enterprise_ai/agent.py` を開く。

### 2-2. コードウォークスルー (5分)

`agent.py` の主要部分を順に見せる:

#### (a) 認証トークンの動的取得

```python
def _get_access_token_from_context(tool_context: ToolContext) -> str:
    escaped_name = re.escape(CLIENT_AUTH_NAME)
    pattern = re.compile(fr"^{escaped_name}_\d+$")
    ...
```

> 「Gemini Enterprise が `enterprise-ai_<数字>` という名前で Bearer トークンを ToolContext に挿入してきます。
> このトークンを使うことで、ユーザーごとの権限で Workspace データへアクセスできます。
> **ここがエンタープライズで重要なポイント** — エージェントがプロンプトを受けたユーザーの認証情報で動くので、
> 権限管理は Workspace 側のままで OK です。」

#### (b) Vertex AI Search MCP のセットアップ

```python
vertexai_mcp = McpToolset(
    connection_params=StreamableHTTPConnectionParams(
        url="https://discoveryengine.googleapis.com/mcp",
        ...
    ),
    tool_filter=['search'],
    header_provider=auth_header_provider
)
```

> 「これが MCP — Model Context Protocol です。
> Google 公式の Discovery Engine MCP サーバーに接続することで、
> Calendar / Gmail / Drive のデータを **横断検索** できるようになります。
> エージェントは一つの `search` ツールだけで、Workspace のあらゆるデータを引けます。」

#### (c) カスタムツール: Chat 経由で DM 送信

```python
def send_direct_message(email: str, message: str, tool_context: ToolContext) -> dict:
    """Sends a Google Chat Direct Message (DM)..."""
    chat_client = chat_v1.ChatServiceClient(...)
    ...
```

> 「業務ロジックを **Function Tool** として組み込めます。
> ここでは Google Chat API を使って DM を送る関数を定義しています。
> 外部 API、社内のレガシーシステム、なんでも繋げます。」

#### (d) Agent 定義

```python
root_agent = LlmAgent(
    model=MODEL,
    name='enterprise_ai',
    instruction=f"""...""",
    tools=[vertexai_mcp, FunctionTool(send_direct_message)]
)
```

> 「あとは LLM、instruction、tools を束ねるだけ。
> instruction の中で『情報取得は MCP 検索、送信系はカスタムツール』と振り分けています。」

### 2-3. デプロイ済みエージェントを動かす (5分)

> 「実はもう Vertex AI Agent Engine にデプロイ済みです。Gemini Enterprise にも登録済みです。」

Web App → **メニュー** → **エージェント** → **組織から** → `Enterprise AI`

```
Please find my meetings for today, I need their titles and links
```

> 「Vertex AI Search MCP 経由でカレンダーを検索した結果が返ってきます。」

```
What is the latest Gmail message I received?
```

> 「同じ MCP の `search` ツールが、今度は Gmail を取りに行きました。
> ツール一つで複数のデータソースを抽象化できているのがわかります。」

```
Please send a Chat message to <自分のメール> with the following text: Hello from prod-code agent!
```

> 「ここではカスタム関数の `send_direct_message` が呼ばれて、Google Chat に DM が飛びます。」

→ Google Chat に切り替えて到着確認

### 2-4. クロージング (3分)

> 「ポイント:
> 1. ADK + MCP で、Workspace の全データを横断する `search` を1ツールで実装
> 2. Function Tool でビジネスロジックを完全カスタマイズ
> 3. Vertex AI Agent Engine でフルマネージドにホスティング
> 4. Gemini Enterprise の認証フロー (OAuth) が透過的に動く
>
> ノーコードで足りない場合、これを **同じプラットフォーム上で** プロコードに切り替えられるのが強み。」

---

## 3. デモパート③ ─ Workspace アドオン (8分)

### 3-1. 前置き (1分)

> 「3つ目は、ユーザーに『新しいUIを覚えてもらう』のではなく、
> 既に使っている **Gmail と Google Chat の UI からそのままエージェントを呼ぶ** パターンです。」

### 3-2. Chat アドオン (3分)

Google Chat を開く → **Gemini Enterprise** との DM スペース

```
What are my meetings for today?
```

> 「Chat の中で、Gemini Enterprise エージェントと同じ機能が呼べます。
> 内部的には StreamAssist API で Gemini Enterprise に流れています。
> 認証は Workspace のものをそのまま使うので追加ログインなし。」

### 3-3. Gmail サイドバー (3分)

Gmail を開く → 事前に自分宛てに送っておいた `We need to talk` メールを開く

→ 右サイドバーから **Enterprise AI** を開く

> 「ここで重要なのは、**今開いているメールの内容がエージェントへのコンテキストとして自動的に渡される** こと。」

サイドバーで:

```
Am I?
```

を送信。

> 「『Am I?』とだけ書きましたが、エージェントは『今開いているメール (= 8〜9時に空いてますか? という質問)』を読んだ上で、
> 私のカレンダーを Workspace データから検索して、空いているかどうか答えてきます。
> これが **Contextual Add-on** の威力です。」

### 3-4. クロージング (1分)

> 「ポイント:
> 1. ユーザーは既存の Gmail / Chat の中から離れずに AI を呼べる
> 2. 開いているメールやチャットのコンテキストが自動で渡る
> 3. 同じデータストア・同じ認証・同じガバナンスで動く」

---

## 4. ラップアップ (3分)

3つのデモのまとめ:

| 観点 | ノーコード | プロコード | アドオン |
|---|---|---|---|
| 作成者 | 業務部門 | 開発者 | 開発者 |
| カスタマイズ性 | 中 | 高 | 中 |
| UI | GE Web App | GE Web App | Gmail / Chat |
| ホスティング | Gemini Enterprise | Vertex AI Agent Engine | Apps Script |
| 共通 | データストア / 認証 / ガバナンス は **全部 Gemini Enterprise 側で一元管理** ||  |

> 「Gemini Enterprise は、業務部門・開発者・エンドユーザー、それぞれに最適なエージェント体験を提供しつつ、
> **データ / 認証 / ガバナンスを一元化** できるプラットフォームです。
> Workspace と統合することで、組織のあらゆる場所で AI が即座に価値を出します。」

---

## 5. Q&A 想定問答

### Q1. データのプライバシーは?
> Gemini Enterprise のデータは Google のモデル学習に使われません。
> OAuth で各ユーザーの権限内のデータにしかアクセスしません。
> 詳細は [Gemini Enterprise セキュリティ](https://docs.cloud.google.com/gemini/enterprise/docs/security?hl=ja) を参照。

### Q2. 既存の社内システム (Salesforce, Jira) と繋げる?
> はい。Gemini Enterprise はサードパーティ コネクタを持っており、
> Jira / Salesforce / Confluence などを **データストアとして接続** できます。
> さらに ADK の MCP でカスタムMCPサーバーも接続可能。

### Q3. コスト感は?
> ライセンス (ユーザー単位) + Vertex AI / Discovery Engine の利用量。
> 詳細は別途お見積もり。

### Q4. オンプレデータも参照したい
> プライベート コネクタ / プライベート ネットワーク経由で Vertex AI Search に取り込み可能。

### Q5. ノーコードの限界は?
> Agent Designer はシンプルなワークフロー/分岐までならノーコードで作れる。
> 複数 LLM 呼び出しの組み合わせ、複雑な関数チェーン、永続メモリなどはプロコード推奨。

### Q6. 業務部門でガバナンスが心配
> 管理コンソールで全エージェントを可視化・監査可能。
> どのデータストアをどのエージェントに繋ぐかは管理者がコントロール。
