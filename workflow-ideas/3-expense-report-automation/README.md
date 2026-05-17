# 経費報告書の自動生成

## 📌 概要

Gmail に添付された領収書から自動でOCR処理を行い、経費報告書を自動生成・ワークフロー化する仕組み。Gemini Vision で領収書をスキャン→自動抽出→申請フロー化→承認完了まで。

```
領収書が Gmail に添付
    ↓ [Apps Script]
[Gemini Vision で OCR]
    ├─ 日付
    ├─ 金額
    ├─ 支払先
    └─ カテゴリ推定
    ↓
[自動で Google Sheets に記入]
    ├─ 日付
    ├─ 支払先
    ├─ 金額（円/JPY）
    ├─ カテゴリ（営業/交通/宿泊等）
    └─ 領収書画像リンク
    ↓
[申請フロー（Google Forms）]
    └─ 誰が/いつまでに承認？
    ↓
[部長・経理が承認]
    ↓
[承認完了 → 計上処理]
```

---

## 🎯 解決する課題

| 課題 | 現状 | 改善後 |
|------|------|--------|
| **領収書作成時間** | 1件5分 | 30秒 |
| **データ入力エラー** | 月2-3件 | 0件 |
| **承認時間** | 平均3日 | 当日 |
| **月間工数削減** | - | **月40時間** |

---

## 🏗️ アーキテクチャ

```
┌──────────────────────┐
│ Gmail 受信            │
│ (領収書添付メール)   │
└─────────┬────────────┘
          │
┌─────────▼──────────────────┐
│ Apps Script トリガー        │
│ onMailReceived()           │
└─────────┬──────────────────┘
          │
┌─────────▼──────────────────┐
│ Gemini Vision API          │
│ - 画像から OCR             │
│ - 情報抽出:               │
│   * 日付                   │
│   * 金額                   │
│   * 支払先                 │
│   * カテゴリ               │
│   * 説明                   │
└─────────┬──────────────────┘
          │
┌─────────▼──────────────────────┐
│ Google Sheets 記録            │
│ - 支出明細シート              │
│ - データ自動入力              │
│ - 領収書ファイルリンク        │
└─────────┬──────────────────────┘
          │
┌─────────▼──────────────────────┐
│ Google Forms 承認フロー       │
│ - 月次報告書生成              │
│ - 部長/経理にルーティング     │
│ - コメント・修正対応          │
└─────────┬──────────────────────┘
          │
┌─────────▼──────────────────────┐
│ 会計システム連携（API）      │
│ - CSV エクスポート            │
│ - SAP/会計ソフト送信          │
│ - 計上確定                    │
└──────────────────────────────┘
```

---

## 📋 詳細実装フロー

### Phase 1: メール受信 → 領収書抽出（2秒）

```javascript
function processExpenseEmail() {
  const threads = GmailApp.search('has:attachment label:未処理', 0, 10);
  
  threads.forEach(thread => {
    const message = thread.getMessages()[0];
    const attachments = message.getAttachments();
    
    attachments.forEach(attachment => {
      // 画像ファイルのみ処理
      if (['image/jpeg', 'image/png', 'image/pdf'].includes(
        attachment.getContentType())) {
        
        const blob = attachment.getAs('image/png');
        const result = scanReceiptWithGemini(blob);
        
        logExpense(result, message, attachment);
      }
    });
  });
}
```

### Phase 2: Gemini Vision で OCR（3-5秒）

```javascript
function scanReceiptWithGemini(imageBlob) {
  const base64Image = Utilities.base64Encode(imageBlob.getBytes());
  
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `
以下の領収書画像を分析して、JSON形式で抽出してください:

抽出対象:
1. 日付 (YYYY-MM-DD形式)
2. 支払先 (企業名/店舗名)
3. 金額 (数値のみ)
4. 通貨 (JPY)
5. カテゴリ (営業費/交通費/宿泊費/食事費/その他から選択)
6. 明細 (どの商品/サービスか)
7. 支払い方法 (現金/クレカ/etc)
8. 信頼度 (0-100%)

返答形式:
{
  "date": "YYYY-MM-DD",
  "merchant": "支払先名",
  "amount": 12345,
  "currency": "JPY",
  "category": "営業費",
  "description": "〇〇会議の飲食代",
  "payment_method": "クレジットカード",
  "confidence": 95
}
            `
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Image
            }
          }
        ]
      }
    ]
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-vision:generateContent?key=${API_KEY}`,
    options
  );
  
  const result = JSON.parse(response.getContentText());
  const jsonText = result.candidates[0].content.parts[0].text;
  
  // JSON 抽出
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch[0]);
}
```

### Phase 3: Sheets に自動記入（2秒）

```javascript
function logExpense(extractedData, originalMessage, attachment) {
  const ss = SpreadsheetApp.openById(EXPENSE_SHEET_ID);
  const sheet = ss.getSheetByName('支出明細');
  
  // ドライブに領収書を保存
  const folder = DriveApp.getFolderById(RECEIPTS_FOLDER_ID);
  const fileName = `${extractedData.date}_${extractedData.merchant}_${extractedData.amount}`;
  const file = folder.createFile(attachment.copyBlob().setName(fileName));
  
  // Sheets に記入
  sheet.appendRow([
    new Date(extractedData.date),              // A: 日付
    extractedData.merchant,                    // B: 支払先
    extractedData.amount,                      // C: 金額
    extractedData.currency,                    // D: 通貨
    extractedData.category,                    // E: カテゴリ
    extractedData.description,                 // F: 説明
    extractedData.payment_method,              // G: 支払方法
    file.getUrl(),                             // H: 領収書リンク
    Session.getEffectiveUser().getEmail(),     // I: 申告者
    new Date(),                                // J: 登録日時
    'pending',                                 // K: ステータス
    extractedData.confidence + '%'             // L: OCR 信頼度
  ]);
  
  // ステータスを「処理済み」に変更
  const label = GmailApp.getUserLabelByName('✓ 経費処理済み') 
    || GmailApp.createLabel('✓ 経費処理済み');
  originalMessage.getThread().addLabel(label).removeLabel(
    GmailApp.getUserLabelByName('未処理')
  );
}
```

### Phase 4: 月次報告書生成（10秒）

```javascript
function generateMonthlyExpenseReport(year, month) {
  const ss = SpreadsheetApp.openById(EXPENSE_SHEET_ID);
  const sheet = ss.getSheetByName('支出明細');
  const data = sheet.getDataRange().getValues();
  
  // 月別フィルタリング
  const monthlyExpenses = data.filter(row => {
    const rowDate = new Date(row[0]);
    return rowDate.getFullYear() === year && rowDate.getMonth() === month - 1;
  });
  
  // カテゴリ別集計
  const categoryTotals = {};
  let grandTotal = 0;
  
  monthlyExpenses.forEach(row => {
    const category = row[4]; // カテゴリ
    const amount = row[2];   // 金額
    
    if (!categoryTotals[category]) categoryTotals[category] = 0;
    categoryTotals[category] += amount;
    grandTotal += amount;
  });
  
  // Google Docs 報告書テンプレートを複製
  const template = DriveApp.getFileById(REPORT_TEMPLATE_ID);
  const reportCopy = template.makeCopy(
    `経費報告書_${year}年${month}月_${Session.getEffectiveUser().getEmail()}`
  );
  
  const doc = DocumentApp.openById(reportCopy.getId());
  const body = doc.getBody();
  
  // テンプレートに値を入力
  body.replaceText('{{申告者}}', Session.getEffectiveUser().getEmail());
  body.replaceText('{{期間}}', `${year}年${month}月`);
  body.replaceText('{{合計金額}}', `¥${grandTotal.toLocaleString()}`);
  
  // カテゴリ別内訳テーブルを挿入
  let summaryText = '【カテゴリ別内訳】\n';
  for (const [category, total] of Object.entries(categoryTotals)) {
    summaryText += `${category}: ¥${total.toLocaleString()}\n`;
  }
  body.replaceText('{{内訳}}', summaryText);
  
  doc.saveAndClose();
  
  // 承認者に送信
  const approvers = getApprovers(Session.getEffectiveUser());
  approvers.forEach(approver => {
    reportCopy.addEditor(approver);
    sendApprovalRequest(approver, reportCopy, categoryTotals, grandTotal);
  });
  
  return reportCopy.getUrl();
}
```

### Phase 5: 承認フロー（管理者操作）

```javascript
// Google Forms 自動生成
function createApprovalForm(reportUrl, expenseData) {
  const form = FormApp.create('経費承認フォーム');
  
  form.addTextItem()
    .setTitle('申告者メール')
    .setRequired(true)
    .setHelpText(expenseData.employee);
  
  form.addMultipleChoiceItem()
    .setTitle('承認/却下')
    .setChoiceValues(['承認', '一部修正が必要', '却下'])
    .setRequired(true);
  
  form.addTextItem()
    .setTitle('コメント')
    .setHelpText('修正が必要な場合は詳細を記入');
  
  form.setDestination(FormApp.DestinationType.SPREADSHEET, APPROVAL_SHEET_ID);
  
  return form.getPublishedUrl();
}

// 承認完了後の処理
function processApproval(formResponse) {
  const answers = formResponse.getItemResponses();
  const status = answers[1].getResponse(); // "承認/却下"
  const comment = answers[2].getResponse();
  
  if (status === '承認') {
    // 会計システムへ送信
    sendToAccountingSystem(formResponse);
    updateExpenseStatus('approved');
  } else if (status === '一部修正が必要') {
    sendRevisionRequest(formResponse, comment);
    updateExpenseStatus('revision_requested');
  } else {
    updateExpenseStatus('rejected');
  }
}
```

---

## 🔐 セキュリティ考慮事項

```javascript
// PII（個人情報）マスキング
function maskSensitiveData(scannedData) {
  // クレジットカード番号: 最後4桁のみ保持
  if (scannedData.cardNumber) {
    scannedData.cardNumber = '****-****-****-' + 
      scannedData.cardNumber.slice(-4);
  }
  
  // ドライブの領収書ファイルはアクセス制限
  const file = DriveApp.getFileById(scannedData.fileId);
  file.revokeAccess('anyone');
  file.addEditor('accounting@company.com');
  
  return scannedData;
}
```

---

## 💰 コスト削減効果

| 項目 | 削減量 | 月間削減時間 |
|-----|-------|-----------|
| 領収書入力 | 80% | 32時間 |
| 修正・再入力 | 95% | 5時間 |
| 承認進行管理 | 60% | 4時間 |
| **合計** | **-** | **41時間** |

**年間コスト削減**: 41時間 × 12月 × 時給2,000円 = **¥984,000**

---

## 🚀 カスタマイズ例

### 複数通貨対応
```javascript
// 海外出張の場合、USD/EUR も自動認識
const exchangeRates = {
  'USD': 110.0,
  'EUR': 130.0,
  'CNY': 16.5
};

const jpyAmount = scannedData.amount * exchangeRates[scannedData.currency];
```

### 部門別レポート
```javascript
// 営業部/企画部/IT部など部門ごとにレポート集計
function generateDepartmentReport(department) {
  const expenses = getExpensesByDepartment(department);
  // ... 集計処理
}
```

### Slack/Teams 統合
```javascript
// 承認結果を自動通知
function notifyApprovalResult(employee, status, amount) {
  const message = `${employee}さんの${month}月経費報告(¥${amount})が${status}されました`;
  sendSlackNotification(message);
}
```

---

## 📊 期待される効果

### 定量効果
- **月間工数削減**: 41時間（年間492時間）
- **エラー削減**: 月2件 → 0件
- **承認時間**: 3日 → 当日

### 定性効果
- 経理業務の負担軽減
- 従業員の不満削減
- 監査対応の効率化
- 会計データの精度向上

---

**実装難易度**: ⭐⭐⭐⭐⭐ (高)  
**ROI**: ⭐⭐⭐⭐ (高)  
**優先度**: 🟠 中

---

**参考**: Gemini Vision API はPDF領収書にも対応しています。
