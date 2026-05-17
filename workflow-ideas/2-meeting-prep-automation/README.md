# ミーティング準備の自動化

## 📌 概要

Google カレンダーから自動で予定を取得し、AIで関連する資料・参加者情報・議題を事前に準備するワークフロー。会議前日に Slack/Chat で詳細情報を自動通知します。

```
カレンダー予定追加
    ↓ [Google Apps Script]
[Gemini で議題推測]
    ↓
[Drive でファイル検索]
[Gmail で過去対話検索]
[Gmail で参加者プロフィール検索]
    ↓
[自動でドキュメント生成]
    ├─ アジェンダ
    ├─ 参加者情報リスト
    ├─ 関連ファイルまとめ
    └─ 参考リンク集
    ↓
[開催前24時間にChat通知]
```

---

## 🎯 解決する課題

| 課題 | 現状 | 改善後 |
|------|------|--------|
| **ミーティング準備時間** | 1回30分 | 10分 |
| **資料の見落とし** | 月10%程度 | 0.1% |
| **参加者情報確認** | 手動で各自確認 | 自動まとめ配信 |
| **見当たらない資料** | 月2-3件 | ほぼ0件 |

---

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────┐
│ Google Calendar                │
│ (新規/変更イベント)           │
└────────────┬────────────────────┘
             │
   ┌─────────▼──────────┐
   │ Apps Script        │
   │ onEventChanged()   │
   └─────────┬──────────┘
             │
   ┌─────────▼──────────────────────┐
   │ 1. イベント詳細抽出             │
   │ - 時刻                         │
   │ - 参加者メール                  │
   │ - 場所/URL                      │
   │ - 説明文                        │
   └─────────┬──────────────────────┘
             │
   ┌─────────▼──────────────────────┐
   │ 2. Gemini で処理                │
   │ - 議題推定                      │
   │ - 優先度判定                    │
   │ - 必要資料の種類判定            │
   │ - アジェンダ案生成              │
   └─────────┬──────────────────────┘
             │
   ┌─────────▼──────────────────────┐
   │ 3. データ収集                    │
   │ - Drive: 関連ファイル検索       │
   │ - Gmail: メール履歴検索         │
   │ - Contacts: 参加者情報取得      │
   └─────────┬──────────────────────┘
             │
   ┌─────────▼──────────────────────┐
   │ 4. ドキュメント自動生成        │
   │ - Google Docs: 議事録テンプレ   │
   │ - Google Sheets: 出席者一覧    │
   │ - 共有フォルダに保存            │
   └─────────┬──────────────────────┘
             │
   ┌─────────▼──────────────────────┐
   │ 5. 通知送信                     │
   │ - 24時間前: Chat で準備開始     │
   │ - 1時間前: リマインダー         │
   │ - 議題・資料・参加者をまとめ    │
   └─────────────────────────────────┘
```

---

## 📋 実装ステップ

### Step 1: カレンダーイベントスキーマ定義（5分）

```javascript
// Apps Script で定義すべき構造
const eventStructure = {
  id: "event123",
  title: "Q2 ビジネスレビュー",
  startTime: "2026-05-20T10:00:00",
  endTime: "2026-05-20T11:00:00",
  description: "四半期決算報告\n議題:\n- 売上実績\n- 顧客満足度",
  attendees: [
    "ceo@company.com",
    "cfo@company.com",
    "sales-lead@company.com"
  ],
  location: "Conference Room A / Google Meet: https://...",
  organizer: "business@company.com"
};
```

### Step 2: Gemini プロンプト設計（10分）

```javascript
const prepPrompt = `
以下のカレンダーイベントについて、ミーティング準備資料を提案してください:

【イベント情報】
タイトル: ${event.title}
開催日時: ${event.startTime} ~ ${event.endTime}
参加者: ${event.attendees.join(', ')}
説明: ${event.description}

【生成物】
1. アジェンダ案 (3-5項目)
2. 必要資料のキーワード (3-5個)
3. 事前準備項目 (チェックリスト)

JSON 形式で返答してください。
`;
```

### Step 3: Google Drive/Gmail 統合（15分）

```javascript
// Drive でファイル検索
const searchFiles = (keywords) => {
  const query = keywords.map(k => `fullText contains '${k}'`).join(' OR ');
  const files = DriveApp.searchFiles(query);
  return files.map(f => ({
    name: f.getName(),
    url: f.getUrl(),
    owner: f.getOwner().getEmail()
  }));
};

// Gmail で関連メール検索
const findRelatedEmails = (keywords, from) => {
  const query = `from:${from} (${keywords.join(' OR ')})`;
  const threads = GmailApp.search(query, 0, 5);
  return threads.map(t => ({
    subject: t.getFirstMessageSubject(),
    date: t.getLastMessageDate(),
    snippet: t.getMessages()[0].getPlainBody().substring(0, 100)
  }));
};
```

### Step 4: ドキュメント自動生成（20分）

```javascript
// Google Docs テンプレートの複製
const createMeetingDoc = (event, agenda, files, emails) => {
  const template = DriveApp.getFileById("TEMPLATE_DOC_ID");
  const copy = template.makeCopy(`${event.title} - 準備ドキュメント`);
  const doc = DocumentApp.openById(copy.getId());
  
  // アジェンダを挿入
  const body = doc.getBody();
  body.insertParagraph(0, `【${event.title}】`)
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.insertParagraph(1, `開催日時: ${event.startTime}`);
  body.insertParagraph(2, "【アジェンダ】");
  
  // アジェンダ項目
  agenda.forEach((item, i) => {
    body.insertParagraph(3 + i, `${i + 1}. ${item}`);
  });
  
  // 資料リンク挿入
  body.insertParagraph(4 + agenda.length, "【関連資料】");
  files.forEach((file, i) => {
    const link = body.insertParagraph(5 + agenda.length + i, file.name);
    link.setLinkUrl(0, file.name.length, file.url);
  });
  
  doc.saveAndClose();
  
  // 参加者と共有
  event.attendees.forEach(email => {
    copy.addEditor(email);
  });
  
  return copy.getUrl();
};
```

### Step 5: Chat 通知（10分）

```javascript
// 24時間前に Chat で通知
const notifyPreparation = (event, docUrl, agenda) => {
  const message = `
🗓️ **明日のミーティング準備**

【タイトル】${event.title}
【時刻】${event.startTime}
【場所】${event.location}

【アジェンダ】
${agenda.map((a, i) => `${i + 1}. ${a}`).join('\n')}

【準備ドキュメント】
${docUrl}

【参加予定者】
${event.attendees.join(', ')}

✅ 準備ドキュメントを確認して、必要な資料を用意してください
  `;
  
  sendChatNotification(message);
};
```

---

## ⏱️ 所要時間と効果

| フェーズ | 所要時間 | 効果 |
|---------|---------|------|
| 準備ドキュメント生成 | 10分 | 準備時間 70% 削減 |
| 資料自動検索 | 5分 | 見落とし 0% |
| 参加者情報自動抽出 | 3分 | 事前確認 100% |
| Chat 通知 | 1分 | リマインダー効率化 |
| **合計** | **19分** | **総準備時間 30→10分** |

---

## 🔧 カスタマイズポイント

### 議題推定の精度向上
- 社内の過去会議議事録を Few-shot 学習に使用
- 参加者の役職データを含める
- 季節的パターン（年度末、期末など）を加味

### 資料検索の改善
- ファイル更新日時フィルタ（最新のみ）
- 機密性ラベル確認（取り扱い注意ファイルは除外）
- Drive でのカスタムプロパティ活用

### スケーラビリティ
- 大人数組織向け: Cloud Tasks で非同期処理
- 多言語対応: Gemini の多言語機能活用
- API コスト最適化: キャッシング層導入

---

## 📊 期待される効果

### 定量効果
- **準備時間**: 月80時間削減
- **資料見落とし**: 月10件 → 0件
- **会議開始遅延**: 月3-4件 → 0件

### 定性効果
- 参加者の準備状況向上
- 会議の質と効率向上
- ストレス軽減

---

**実装難易度**: ⭐⭐⭐⭐ (中上)  
**ROI**: ⭐⭐⭐⭐ (高)  
**優先度**: 🟠 中
