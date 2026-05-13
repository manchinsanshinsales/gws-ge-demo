# トラブルシューティング

デモ中・準備中によく遭遇するエラーと対処法。

---

## A. データストア関連

### A-1. データストアのステータスが `エラー` のまま

**原因:** API 未有効化、または OAuth クライアントの設定誤り。

**対処:**
```bash
gcloud services enable \
  calendar-json.googleapis.com \
  gmail.googleapis.com \
  people.googleapis.com
```
+ Cloud Console で OAuth 同意画面の **対象 = 内部** になっているか確認。

### A-2. データストアがアクティブなのにエージェントが答えられない

**原因 (1):** 同期に時間がかかる。Drive は特に大きいテナントだと **数時間** かかることがある。
**対処:** デモ前日までに作成し、同期を待つ。

**原因 (2):** コネクタが OFF になっている。
**対処:** チャット入力欄のコネクタアイコンですべて ON にする。

### A-3. NotebookLM だけ "保留中" のまま

これは仕様。NotebookLM データストアは他とステータス挙動が異なる。
デモには影響しないので無視して OK。

---

## B. ノーコードエージェント関連

### B-1. メール送信時に「権限がありません」と出る

**原因:** Gmail データストアでアクションが有効化されていない、または OAuth スコープが足りない。

**対処:**
1. データストア設定で **メールを送信** アクションを ON
2. OAuth 同意画面で `https://www.googleapis.com/auth/gmail.send` スコープが追加されているか確認
3. エージェントとのチャットで、フッターのコネクタアイコン → Gmail → **アクションを有効にする** → 認証フロー完了

### B-2. エージェントが「データがありません」と答える

**原因:** 当日にデータを入れた → まだ同期されていない。

**対処:** カレンダー / Gmail は比較的早いが、Drive は遅い。デモ用データは **24時間前** までに入れる。

---

## C. プロコードエージェント (ADK) 関連

### C-1. `adk deploy` で `permission denied` 系エラー

**原因:** Vertex AI / Discovery Engine の API が有効化されていない。

**対処:**
```bash
bash scripts/enable-mcp.sh
```

### C-2. デプロイ完了後、エージェントを呼ぶと `No bearer token found in ToolContext state matching pattern enterprise-ai_\d+$`

**原因:** Gemini Enterprise 側で登録した **Authorization name** が `agent.py` の `CLIENT_AUTH_NAME` と一致していない。

**対処:**
- `agent.py` の `CLIENT_AUTH_NAME = "enterprise-ai"` を確認
- Gemini Enterprise → エージェント設定 → Authorization name を **`enterprise-ai`** に揃える
- どちらかを変えたら再保存

### C-3. `No Discovery Engines found in project`

**原因:** Gemini Enterprise アプリ (= Engine) がまだ作られていない or 別プロジェクト上にある。

**対処:**
- `gcloud config get-value project` で見ているプロジェクトと、Gemini Enterprise アプリのプロジェクトが一致しているか確認

### C-4. Reasoning Engine SA の権限付与でタイミングを逃した

**症状:** デプロイ完了後に Discovery Engine 関連の権限エラー。

**対処:** デプロイ完了後でも改めて実行可能:
```bash
bash scripts/grant-permissions.sh
```

### C-5. `adk deploy` の途中で長時間止まる

**対処:** 5〜10分は通常。15分以上動かない場合 Cloud Build のログを確認:
- Cloud Console → Cloud Build → 履歴

### C-6. エージェント登録時に **認可 URI** がエラーになる

**原因:** URI 内の `<CLIENT_ID>` を実際の値に置換していない。

**対処:** Cloud Console の OAuth クライアントから取得したクライアント ID で **完全に置換** する。

---

## D. Workspace アドオン関連

### D-1. Chat DM で `Gemini Enterprise` アプリが見つからない

**原因:**
1. Google Chat API 構成画面で **インタラクティブ機能を有効にする** が OFF
2. 公開設定が自分のドメインの自分のメールを含んでいない

**対処:** Cloud Console → Google Chat API → 構成 で再確認。

### D-2. Apps Script でスクリプトプロパティ未設定エラー

**対処:**
- `REASONING_ENGINE_RESOURCE_NAME`
- `APP_SERVICE_ACCOUNT_KEY`

両方が設定されているか Apps Script のプロジェクト設定で確認。

### D-3. サイドバーで認可エラー

**対処:** Apps Script の **デプロイ → デプロイをテスト → インストール** をもう一度実行し、認可フローを完了させる。

---

## E. その他

### E-1. ライセンス期限切れ

**対処:** Cloud Console → Gemini Enterprise → アプリ → ライセンス確認。
30日トライアル切れの場合、有償ライセンス購入か別アカウントで再トライアル。

### E-2. デモ中にレスポンスが遅い

**原因:**
1. MCP 検索のタイムアウト (15秒) を超えそうな場合
2. データストアが大きい

**対処:**
- `agent.py` の `VERTEXAI_SEARCH_TIMEOUT = 15.0` を `30.0` あたりに伸ばす
- 再デプロイ

### E-3. ローカルで `adk` コマンドが見つからない

**対処:**
```bash
source .venv/bin/activate
pip install google-adk
# または
poetry install
```

### E-4. 古い deployment が残ってリソース名が混乱する

**対処:** Vertex AI Console → **Agent Engine** から不要なエージェントを削除しておく。

---

## F. デモ直前30分のチェックリスト

- [ ] Web App URL がブラウザの別タブで開いている
- [ ] Gmail / Google Chat / Cloud Console をそれぞれ別タブで開く
- [ ] エディタで `agent.py` を開いておく
- [ ] 自分のカレンダーに当日の予定 2〜3件あるか確認
- [ ] テスト用メール送信スクリプト or 受信箱を準備
- [ ] 画面共有の文字サイズを確認 (見やすい大きさに)
- [ ] ネットワーク確認 (Wi-Fi より有線推奨)
- [ ] ノーコード/プロコード/アドオン それぞれ一度通しで動くか **直前確認**
