# インテリジェント メールルーティング — 詳細アーキテクチャ

## 🏗️ システム全体図

```
┌─────────────────────────────────────────────────────────────────┐
│                    Gmail インボックス                          │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ 受信メール                                             │   │
│  │ - 件名: "顧客Aから問い合わせ"                          │   │
│  │ - 本文: "APIが返答していません..."                     │   │
│  │ - 添付: error.log                                      │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │ Gmail Apps Script       │
        │ トリガー: onNewMail()   │
        │                        │
        │ 処理:                  │
        │ 1. メール取得          │
        │ 2. 本文・件名抽出      │
        │ 3. Gemini へ送信       │
        └────────────┬───────────┘
                     │
        ┌────────────▼─────────────────────┐
        │  Gemini 2.5 Flash API            │
        │                                  │
        │  プロンプト:                     │
        │  "このメールを以下で分類:        │
        │   - カテゴリ                    │
        │   - 重要度                      │
        │   - 対応時間目安"               │
        │                                  │
        │  出力:                          │
        │  {                               │
        │    "category": "IT",            │
        │    "priority": "HIGH",          │
        │    "eta_hours": 1,              │
        │    "confidence": 0.95           │
        │  }                              │
        └────────────┬──────────────────────┘
                     │
        ┌────────────▼────────────────┐
        │ Google Sheets API           │
        │                            │
        │ ルール参照:                 │
        │ category=IT AND            │
        │ priority=HIGH              │
        │ → "it-team@company.com"    │
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────────────┐
        │ アクション実行                     │
        │                                   │
        │ ①Gmail:                          │
        │   - ラベル付与 [IT][High]        │
        │   - 担当者にCC                    │
        │                                   │
        │ ②Google Sheets:                  │
        │   - ログシートに記録              │
        │   - 統計データ更新               │
        │                                   │
        │ ③Google Chat:                    │
        │   - Slack通知                    │
        │   - "新規チケット: IT 高優先度"  │
        └────────────┬──────────────────────┘
                     │
        ┌────────────▼──────────────────────┐
        │ チームメンバーが対応              │
        │                                   │
        │ - メールで通知受け取り            │
        │ - Chat で詳細確認                │
        │ - 返信 → 自動ラベル更新          │
        └───────────────────────────────────┘
```

---

## 📋 データフロー詳細

### フェーズ1: メール分析（1-2秒）

```javascript
// 入力データ
{
  messageId: "abc123def456",
  from: "customer@company.com",
  to: "support@mycompany.com",
  subject: "緊急: APIが動作していません",
  body: "15分前からAPIが返答を返さなくなりました。エラーログを添付します。",
  timestamp: "2026-05-17T10:30:00Z",
  hasAttachment: true,
  attachmentNames: ["error.log", "request.json"]
}

// Gemini への送信内容
const prompt = `
以下のメールを分析して、JSON形式で返答してください:

件名: ${email.subject}
本文: ${email.body}

分析項目:
1. カテゴリ (営業/サポート/IT/財務/HR/その他)
2. 重要度 (HIGH/MEDIUM/LOW)
3. 対応時間目安 (hours)
4. キーワード (3-5個)
5. 推奨処理内容

JSON形式で返答:
{
  "category": "...",
  "priority": "...",
  "eta_hours": ...,
  "keywords": [...],
  "suggested_action": "...",
  "confidence": 0.0-1.0
}
`;

// Gemini からの返信
{
  "category": "IT",
  "priority": "HIGH",
  "eta_hours": 1,
  "keywords": ["API", "エラー", "緊急", "ダウンタイム"],
  "suggested_action": "ITチームに即座に引き継ぎ。エラーログ確認必須",
  "confidence": 0.98
}
```

---

### フェーズ2: ルール適用（0.5秒）

```javascript
// Sheets のルール定義テーブルから検索
RULES_TABLE = {
  headers: ["id", "category", "priority", "assign_to", "label", "eta_hours"],
  rows: [
    {
      id: 1,
      category: "IT",
      priority: "HIGH",
      assign_to: "it-team@company.com",
      label: "🔴 IT High",
      eta_hours: 1,
    },
    {
      id: 2,
      category: "IT",
      priority: "MEDIUM",
      assign_to: "it-support@company.com",
      label: "🟡 IT Medium",
      eta_hours: 4,
    },
    // ... more rules
  ]
};

// マッチングロジック
function findMatchingRule(analysis) {
  return RULES_TABLE.rows.find(rule => 
    rule.category === analysis.category &&
    rule.priority === analysis.priority
  );
}

// 結果
matchingRule = {
  assign_to: "it-team@company.com",
  label: "🔴 IT High",
  eta_hours: 1
}
```

---

### フェーズ3: アクション実行（2-3秒）

```javascript
// アクション1: Gmail ラベル付与
GmailApp.search('from:customer@company.com subject:"緊急: APIが動作していません"')[0]
  .addLabel(GmailApp.createLabel("🔴 IT High"));

// アクション2: CC 追加（返信）
var message = GmailApp.search(...)[0];
var reply = "Thank you for reporting. IT team has been assigned.";
message.createDraftReply(reply)
  .addCC("it-team@company.com")
  .send();

// アクション3: Sheets に記録
logsSheet.appendRow([
  new Date(),
  email.subject,
  email.from,
  analysis.category,
  analysis.priority,
  "it-team@company.com",
  "assigned",
  analysis.confidence
]);

// アクション4: Google Chat 通知
sendChatNotification({
  space: "spaces/AAAABBBB",
  text: `🚨 新しい高優先度チケット\nカテゴリ: IT\n件名: ${email.subject}\n割り当て先: it-team@company.com`
});
```

---

### フェーズ4: ログ記録（リアルタイム）

```javascript
// ログシート (Sheets)
┌──────────┬─────────────────────┬──────────────┬───────┬────────┬──────────────┬──────┬──────────┐
│   日時   │      件名            │   送信者     │カテゴリ│重要度 │  割り当て先   │ステ  │確信度   │
├──────────┼─────────────────────┼──────────────┼───────┼────────┼──────────────┼──────┼──────────┤
│10:30:00  │緊急: APIが動作していない│customer@... │IT    │HIGH   │it-team@...   │assign│  0.98   │
│10:35:15  │新製品についての質問    │sales@...    │営業   │MEDIUM │sales-team@..│assign│  0.92   │
│10:40:45  │経費報告書の承認依頼    │user@...     │財務   │LOW    │finance@...  │assign│  0.87   │
└──────────┴─────────────────────┴──────────────┴───────┴────────┴──────────────┴──────┴──────────┘

// 統計シート (ダッシュボード)
┌─────────┬─────┬──────┬──────┬──────────┬──────────┐
│カテゴリ │今日 │今週  │平均時間│処理率   │エスカレ │
├─────────┼─────┼──────┼──────┼──────────┼──────────┤
│IT       │  15 │  87  │ 1.2h │  98.5%  │   2件   │
│営業     │  23 │ 142  │ 0.5h │  99.2%  │   1件   │
│サポート │  18 │  98  │ 2.1h │  97.8%  │   3件   │
└─────────┴─────┴──────┴──────┴──────────┴──────────┘
```

---

## 🔄 エラーハンドリングフロー

```
メール処理
    │
    ├─ Gemini API エラー
    │  └─ フォールバック: キーワード分析で簡易分類
    │
    ├─ ルールマッチ失敗
    │  └─ デフォルトルール適用 (一般担当者へ)
    │
    ├─ Gmail API エラー
    │  └─ リトライ (最大3回)
    │     └─ 失敗時: 管理者へ通知
    │
    └─ Sheets API エラー
       └─ ローカルキャッシュに記録
          └─ 後で同期
```

---

## 🛡️ セキュリティアーキテクチャ

```
┌──────────────────────────────────┐
│  Gmail (メール内容)              │
│  ⚠️ 機密情報を含む可能性        │
└────────────┬─────────────────────┘
             │
    ┌────────▼────────┐
    │ テキスト抽出     │
    │ (オンプレミス)  │
    └────────┬────────┘
             │
    ┌────────▼──────────────────┐
    │ PII マスキング             │
    │ - メールアドレス → [EMAIL]  │
    │ - 電話番号 → [PHONE]       │
    │ - クレジットカード → [CC]   │
    └────────┬──────────────────┘
             │
    ┌────────▼────────────────┐
    │ Gemini API へ送信       │
    │ (https/TLS)             │
    └────────┬────────────────┘
             │
    ┌────────▼────────────────┐
    │ 返却値のみ保存          │
    │ {category, priority}    │
    │ 元のテキストは破棄      │
    └────────────────────────┘
```

---

## 📊 パフォーマンス指標

| 指標 | 目標値 | 実績 (予想) |
|------|--------|-----------|
| 平均処理時間 | < 5秒 | 3-4秒 |
| API 呼び出し成功率 | > 99% | 98.5% |
| ルールマッチ精度 | > 95% | 92-98% |
| スループット (メール/分) | 20+ | 15-20 |
| キャッシュヒット率 | 30-40% | 35% |

---

## 💾 スケーラビリティ考慮事項

### 現在の構成（~1000メール/日）
- Apps Script で十分
- Gemini API コストは月$50-100程度

### スケール時（~10,000メール/日）
- **必須**: バッチ処理 + キューイング
- **推奨**: Cloud Tasks で非同期処理
- **検討**: Vertex AI Matching Engine でベクトル分類

### 大規模運用（~100,000メール/日）
- **必須**: Cloud Run + Pub/Sub アーキテクチャ
- **検討**: ローカル LLM (Llama など) で高速化
- **推奨**: エッジキャッシング (Redis)

---

**最終更新**: 2026-05-17
