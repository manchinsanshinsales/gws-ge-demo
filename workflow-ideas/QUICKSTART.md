# Google Workspace ワークフロー改善 — クイックスタートガイド

このドキュメントは、3つのワークフロー改善アイディアを**最短2-3日で実装する**ためのガイドです。

---

## 🚀 30秒で選ぶ！あなたに最適なアイディア

### 質問1: 最も改善したい業務は？

**A. メール処理**
→ **[1️⃣ インテリジェント メールルーティング](./1-intelligent-email-routing/)**
- 実装期間: 2-3日
- 効果: メール処理時間 60% 削減
- 難易度: ⭐⭐⭐

**B. 会議準備**
→ **[2️⃣ ミーティング準備の自動化](./2-meeting-prep-automation/)**
- 実装期間: 3-4日
- 効果: 準備時間 70% 削減
- 難易度: ⭐⭐⭐⭐

**C. 経費処理**
→ **[3️⃣ 経費報告書の自動生成](./3-expense-report-automation/)**
- 実装期間: 5-7日
- 効果: 経費処理時間 80% 削減
- 難易度: ⭐⭐⭐⭐⭐

---

## ✅ 実装前の準備チェック（10分）

### 環境確認

```bash
# 1. Google Cloud プロジェクトはあるか？
# → ない場合: https://console.cloud.google.com で作成

# 2. Gemini API は有効か？
# → 有効にする: Cloud Console → APIs & Services → Generative Language API

# 3. Google Workspace (Business以上) を使用しているか？
# → ない場合は不可。Google Workspace 契約が必須

# 4. Admin 権限はあるか？
# → メール/カレンダー/ドライブの API スコープが必要
```

### 必須の Google API

各アイディアで有効化が必要な API:

```
【全アイディア共通】
- Generative Language API (Gemini)
- Google Workspace APIs (Gmail/Calendar/Drive/Chat)

【アイディア1: メールルーティング】
- Gmail API
- Google Sheets API
- Google Chat API (通知用・オプション)

【アイディア2: ミーティング準備】
- Google Calendar API
- Google Drive API
- Google Docs API
- Gmail API (過去メール検索用)

【アイディア3: 経費報告書】
- Gmail API (領収書添付検出)
- Google Sheets API (報告書記録)
- Google Drive API (領収書保存)
- Gemini 2.5 Flash Vision (OCR)
```

**有効化コマンド** (Google Cloud CLI):

```bash
gcloud services enable \
  generativelanguage.googleapis.com \
  gmail.googleapis.com \
  calendar-json.googleapis.com \
  drive.googleapis.com \
  docs.googleapis.com \
  sheets.googleapis.com \
  chat.googleapis.com
```

---

## 🎯 アイディア別実装手順

### アイディア1: インテリジェント メールルーティング

**⏱️ 実装時間: 2-3日**

#### Day 1: セットアップ（4時間）
- [ ] Google Sheets でルール定義テーブル作成
- [ ] Google Cloud で Gemini API キー取得
- [ ] Apps Script プロジェクト作成

#### Day 2: コード実装（3時間）
- [ ] `sample-code.gs` をコピーして Apps Script に貼り付け
- [ ] CONFIG オブジェクトを環境に合わせてカスタマイズ
- [ ] Gemini API キーを設定

#### Day 3: テスト & 本番化（2時間）
- [ ] テストメール送信
- [ ] ログシート確認
- [ ] ラベル付与確認
- [ ] トリガー設定

**最短ルート** (経験者向け):

```bash
1. Sheets を作成 (10分)
2. API キーを取得 (15分)
3. コードをコピペ (30分)
4. テスト実行 (30分)
  → 合計: 1.5時間で動作可能
```

👉 **開始**: `1-intelligent-email-routing/README.md` を開く

---

### アイディア2: ミーティング準備の自動化

**⏱️ 実装時間: 3-4日**

#### Day 1: 設計（2時間）
- [ ] Gemini プロンプトを作成・テスト
- [ ] Google Drive テンプレート作成（議事録）
- [ ] Chat ワークスペース設定

#### Day 2: コード実装（4時間）
- [ ] Calendar トリガー設定
- [ ] Drive ファイル検索ロジック
- [ ] Gemini 統合

#### Day 3-4: 統合 & テスト（3時間）
- [ ] E2E テスト（カレンダーイベント作成→通知確認）
- [ ] パフォーマンス確認
- [ ] 本番運用

👉 **開始**: `2-meeting-prep-automation/README.md` を開く

---

### アイディア3: 経費報告書の自動生成

**⏱️ 実装時間: 5-7日**（最複雑）

#### Day 1: 設計（3時間）
- [ ] Google Sheets テンプレート設計
- [ ] Gemini Vision プロンプト作成
- [ ] 承認フロー定義

#### Day 2: OCR 実装（4時間）
- [ ] Gemini Vision API テスト
- [ ] 領収書画像テスト
- [ ] 抽出精度検証

#### Day 3-4: Sheets 統合（4時間）
- [ ] 自動記入ロジック
- [ ] 月次レポート生成
- [ ] 統計ダッシュボード

#### Day 5: 承認フロー構築（3時間）
- [ ] Google Forms 自動生成
- [ ] 承認プロセス
- [ ] 会計システム連携

#### Day 6-7: テスト & 本番化（3時間）
- [ ] エンドツーエンドテスト
- [ ] エラーハンドリング
- [ ] ドキュメント作成

👉 **開始**: `3-expense-report-automation/README.md` を開く

---

## 🔧 共通セットアップ手順

### Step 1: Google Cloud プロジェクト確認

```bash
# 既存プロジェクトがあるか確認
gcloud projects list

# ない場合は作成
gcloud projects create my-workflow-project

# プロジェクト設定
gcloud config set project my-workflow-project
```

### Step 2: API 有効化

```bash
# アイディアに応じた API を有効化
gcloud services enable generativelanguage.googleapis.com gmail.googleapis.com
```

### Step 3: 認証情報作成

```bash
# API キーまたは OAuth クライアントを作成
# → Cloud Console → APIs & Services → Credentials
```

### Step 4: Apps Script にキーを設定

```javascript
// Apps Script エディタで
const scriptProperties = PropertiesService.getScriptProperties();
scriptProperties.setProperty('GEMINI_API_KEY', 'YOUR_API_KEY_HERE');
```

---

## 📊 実装優先度の決定基準

| 指標 | 優先 | 次点 | 検討中 |
|------|------|------|--------|
| **実装期間** | 短い | 中程度 | 長い |
| **ROI** | 高い | 中程度 | 低い |
| **難易度** | 低い | 中程度 | 高い |
| **組織影響度** | 広い | 部門別 | 限定的 |

**推奨実装順序**:
1. 🥇 **アイディア1** (最速・最高ROI)
2. 🥈 **アイディア2** (中程度・中ROI)
3. 🥉 **アイディア3** (時間掛かる・中ROI)

---

## 🆘 トラブルシューティング

### 「API キーが見つかりません」
```javascript
// App Script 上部メニュー → プロジェクト設定
// スクリプトプロパティを確認して、GEMINI_API_KEY が設定されているか確認
```

### 「Sheets が見つかりません」
```javascript
// SPREADSHEET_ID を確認
// Google Sheets のURLから取得:
// https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
```

### 「Gmail ラベルが作成されない」
```javascript
// Apps Script の承認スコープを確認
// 必要: gmail.modify スコープ
// リセット方法: プロジェクト設定 → リセット
```

### 「Gemini API の割当超過」
```javascript
// Cloud Console で API 使用状況を確認
// Quotas → Generative Language API
// RPM (Requests per Minute) の制限: 600
// 超過時はバッチ処理でリトライスケジューリング
```

---

## 📚 次のステップ

### 1. このドキュメントを読む（10分）
✅ あなたはここです

### 2. 選んだアイディアの README を読む（15分）
```bash
cat workflow-ideas/1-intelligent-email-routing/README.md  # または 2/ または 3/
```

### 3. 環境をセットアップ（20-30分）
- Google Cloud API を有効化
- 認証情報を取得

### 4. サンプルコードをコピー（10分）
```bash
# アイディア1の場合
# sample-code.gs の内容を Apps Script にコピペ
```

### 5. テスト実行（30分）
- テストメール送信
- ログ確認
- 本番化

---

## 💡 ヒントとコツ

### 開発効率を上げるコツ
- **Gemini プロンプトは iterative に改良する**
  - 1回のプロンプトで完璧を目指さない
  - テストケース > テスト > 改良 の繰り返し

- **Apps Script のデバッグ方法**
  ```javascript
  Logger.log("デバッグ情報"); // ロギング
  // 実行 → ログを表示（Ctrl+Enter）
  ```

- **Sheets で統計を可視化**
  - COUNTIF / SUMIF で集計
  - グラフで可視化 → チームに共有

### セキュリティのベストプラクティス
- ✅ API キーは Apps Script プロパティで管理
- ❌ コード内に直接記入しない
- ✅ 機密情報（PII）をログに含めない
- ✅ Sheets/Drive の共有範囲を制限

---

## 📞 サポート情報

### 公式ドキュメント
- [Google Apps Script 公式ドキュメント](https://developers.google.com/apps-script)
- [Gemini API 公式ドキュメント](https://ai.google.dev)
- [Google Workspace APIs](https://developers.google.com/workspace)

### コミュニティ
- Google Workspace Dev Community
- Stack Overflow (タグ: google-apps-script, gemini)
- GitHub Discussions

---

**準備完了？** 次のステップ:

```bash
# アイディア1を選んだ場合:
cd workflow-ideas/1-intelligent-email-routing/
cat README.md  # 詳細説明を読む
cat implementation.md  # 実装ガイドを読む
cat sample-code.gs  # コードをコピーして Apps Script に貼り付け
```

🎉 **Happy coding!**
