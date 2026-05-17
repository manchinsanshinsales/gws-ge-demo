# インテリジェント メールルーティング — 実装ガイド

## 📋 事前準備チェックリスト

- [ ] Google Cloud プロジェクト作成済み
- [ ] Gmail API 有効化済み
- [ ] Google Sheets API 有効化済み
- [ ] Generative Language API (Gemini) 有効化済み
- [ ] Google Chat API 有効化済み
- [ ] Python 3.9+ またはNode.js 環境

---

## 🚀 ステップ 1: Google Sheets のセットアップ

### 1-1. スプレッドシート作成

```bash
# Google Sheets を開く → 新規スプレッドシート
# タイトル: "メールルーティング - ルール定義"
```

### 1-2. ルール定義シート

**Sheet名: "ルール定義"**

以下のヘッダーを作成:

```
A列: ID
B列: カテゴリ
C列: 重要度
D列: 担当者メール
E列: ラベル
F列: 対応時間（時間）
G列: 備考
```

サンプルデータ:

```
ID | カテゴリ | 重要度 | 担当者メール | ラベル | 時間 | 備考
1  | IT | HIGH | it-team@company.com | 🔴 IT High | 1 | 即座対応
2  | IT | MEDIUM | it-support@company.com | 🟡 IT Medium | 4 | 営時間内対応
3  | 営業 | HIGH | sales-team@company.com | 🔴 Sales High | 2 | VIP客向け
4  | 営業 | MEDIUM | sales@company.com | 🟡 Sales Medium | 8 | 通常対応
5  | サポート | HIGH | support-team@company.com | 🔴 Support High | 2 | 即座対応
6  | サポート | MEDIUM | support@company.com | 🟡 Support Med | 8 | 通常対応
7  | その他 | LOW | admin@company.com | ⚪ Other Low | 24 | その他全般
```

### 1-3. ログシート

**Sheet名: "ログ記録"**

ヘッダー:

```
A: 日時
B: メール件名
C: 送信者
D: カテゴリ
E: 重要度
F: 割り当て先
G: ステータス
H: 確信度
I: アクション内容
```

### 1-4. ダッシュボードシート（オプション）

**Sheet名: "ダッシュボード"**

```
┌─────────────────────────────────┐
│  📊 メールルーティング統計      │
│  更新日時: [TODAY]               │
├─────────────────────────────────┤
│ 本日処理件数: [COUNTIF(...)]     │
│ 本週処理件数: [SUMIFS(...)]      │
│ 平均確信度: [AVERAGE(...)]      │
│ エラー件数: [COUNTIF(...)]      │
└─────────────────────────────────┘

┌──────────────────────────────────┐
│ カテゴリ別統計 (本月)            │
├──────┬──────┬──────┬────────┐   │
│カテゴリ│件数 │完了率│平均時間│   │
├──────┼──────┼──────┼────────┤   │
│IT    │  45  │ 99% │ 1.2h  │   │
│営業  │  67  │ 98% │ 2.1h  │   │
│サポート│ 34  │ 97% │ 4.3h  │   │
└──────┴──────┴──────┴────────┘   │
```

---

## 🔑 ステップ 2: Gemini API キー取得

### 2-1. Google Cloud Console で設定

```bash
# 1. https://console.cloud.google.com にアクセス
# 2. プロジェクト選択 → "APIs & Services" → "有効な API とサービス"
# 3. "+ API とサービスを有効にする" をクリック
# 4. "Generative Language API" を検索 → 有効化
```

### 2-2. API キー作成

```bash
# "認証情報" → "+ 認証情報を作成" → "APIキー"
# 作成されたキーをコピーして保管（後で使う）
```

### 2-3. Google Cloud Console でのクォータ確認

```
https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
```

確認項目:
- Requests per minute (RPM): 600
- Requests per day (RPD): 制限なし (課金ベース)

---

## 📝 ステップ 3: Apps Script コード実装

### 3-1. Apps Script プロジェクト作成

```javascript
// Google Apps Script (script.google.com) → 新しいプロジェクト作成
// プロジェクト名: "メールルーティング自動化"
```

### 3-2. ファイル構成

以下4つのファイルを作成:

```
プロジェクト/
├── main.gs          ← メイン処理
├── gemini.gs        ← Gemini API ラッパー
├── sheets.gs        ← Sheets ヘルパー
└── config.gs        ← 設定・定数
```

### 3-3. config.gs

```javascript
// ================================
// 設定ファイル
// ================================

const CONFIG = {
  // Google Sheets 設定
  SPREADSHEET_ID: "YOUR_SPREADSHEET_ID_HERE",
  RULES_SHEET: "ルール定義",
  LOGS_SHEET: "ログ記録",
  
  // Gemini API 設定
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE",
  GEMINI_MODEL: "gemini-2.5-flash",
  
  // Gmail 設定
  LABEL_PREFIX: "🔴 ",  // ラベルのプレフィックス
  ARCHIVE_LABEL: "✓ 処理済み",
  ERROR_LABEL: "⚠️ エラー",
  
  // Google Chat 設定（通知用）
  CHAT_WEBHOOK_ENABLED: true,
  CHAT_WEBHOOK_URL: "https://chat.googleapis.com/v1/spaces/SPACES_ID/messages",
  
  // 処理設定
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  TIMEOUT_SECONDS: 30,
  LOG_RETENTION_DAYS: 90,
  
  // 分類プロンプト
  CLASSIFICATION_PROMPT_TEMPLATE: `
以下のメールを分析して、JSON形式で以下を返してください。

【メール情報】
件名: {subject}
本文: {body}
送信者: {sender}
添付ファイル: {attachments}

【分析指示】
1. カテゴリを以下から選択: IT, 営業, サポート, 財務, HR, その他
2. 重要度を選択: HIGH (即座対応), MEDIUM (8時間以内), LOW (24時間以内)
3. 対応時間目安（時間）
4. 関連キーワード（3-5個）
5. 推奨アクション

【返答形式】(JSONのみ、他の説明は不要)
{
  "category": "カテゴリ",
  "priority": "HIGH/MEDIUM/LOW",
  "eta_hours": 数字,
  "keywords": ["キーワード1", "キーワード2"],
  "action": "推奨アクション",
  "confidence": 0.00-1.00
}
  `
};

// キー設定（Apps Script 上部で実行）
function setupScriptProperties() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('GEMINI_API_KEY', CONFIG.GEMINI_API_KEY);
  scriptProperties.setProperty('SPREADSHEET_ID', CONFIG.SPREADSHEET_ID);
  Logger.log("✅ プロパティ設定完了");
}
```

### 3-4. main.gs

```javascript
// ================================
// メイン処理
// ================================

/**
 * メール受信トリガー（手動実行またはスケジュール）
 * 実行: メニュー → processNewEmails() 手動実行
 * または: スケジュールトリガー設定（5分ごと）
 */
function processNewEmails() {
  try {
    Logger.log("🔄 メール処理開始");
    
    // 未処理メール取得 (ラベル検索で効率化)
    const unreadThreads = GmailApp.search('is:unread', 0, 50);
    Logger.log(`📧 未読メール: ${unreadThreads.length} 件`);
    
    if (unreadThreads.length === 0) {
      Logger.log("✅ 処理対象なし");
      return;
    }
    
    const rulesSheet = SheetHelper.getRulesSheet();
    const rulesData = rulesSheet.getDataRange().getValues();
    const rules = parseRulesData(rulesData);
    
    let processedCount = 0;
    let errorCount = 0;
    
    // メール処理ループ
    unreadThreads.forEach(thread => {
      try {
        const messages = thread.getMessages();
        if (messages.length === 0) return;
        
        const message = messages[messages.length - 1];
        const subject = message.getSubject();
        const body = message.getPlainBody();
        const sender = message.getFrom();
        const timestamp = message.getDate();
        
        Logger.log(`📝 処理中: ${subject}`);
        
        // ステップ1: Gemini で分類
        const analysis = GeminiHelper.classifyEmail({
          subject: subject,
          body: body,
          sender: sender
        });
        
        if (!analysis) {
          throw new Error("分類失敗");
        }
        
        Logger.log(`✓ 分類: ${analysis.category} / ${analysis.priority}`);
        
        // ステップ2: ルール適用
        const matchingRule = findRule(analysis, rules);
        if (!matchingRule) {
          Logger.log("⚠️ マッチルールなし → デフォルト割り当て");
          // デフォルトルール適用
          matchingRule = rules.find(r => r.id === "DEFAULT");
        }
        
        // ステップ3: Gmail アクション実行
        executeGmailActions(message, thread, analysis, matchingRule);
        
        // ステップ4: ログ記録
        SheetHelper.logProcessing({
          timestamp: new Date(),
          subject: subject,
          sender: sender,
          category: analysis.category,
          priority: analysis.priority,
          assignedTo: matchingRule.assignTo,
          status: "assigned",
          confidence: analysis.confidence,
          action: `ラベル付与: ${matchingRule.label}`
        });
        
        // ステップ5: 通知送信
        if (CONFIG.CHAT_WEBHOOK_ENABLED) {
          notifyChatChannel(analysis, matchingRule);
        }
        
        processedCount++;
        
      } catch (error) {
        Logger.log(`❌ エラー: ${error.message}`);
        errorCount++;
        
        // エラーログ記録
        SheetHelper.logProcessing({
          timestamp: new Date(),
          subject: message.getSubject(),
          sender: message.getFrom(),
          status: "error",
          action: `エラー: ${error.message}`
        });
      }
    });
    
    Logger.log(`✅ 処理完了: ${processedCount}件成功, ${errorCount}件エラー`);
    
  } catch (error) {
    Logger.log(`🔴 致命的エラー: ${error.message}`);
    sendErrorNotification(error);
  }
}

/**
 * ルール検索
 */
function findRule(analysis, rules) {
  return rules.find(rule =>
    rule.category === analysis.category &&
    rule.priority === analysis.priority
  );
}

/**
 * Gmail アクション実行
 */
function executeGmailActions(message, thread, analysis, rule) {
  // アクション1: ラベル付与
  const label = GmailApp.getUserLabelByName(rule.label);
  if (label) {
    thread.addLabel(label);
  } else {
    // ラベルなければ作成
    const newLabel = GmailApp.createLabel(rule.label);
    thread.addLabel(newLabel);
  }
  
  // アクション2: 担当者に CC で返信
  const reply = createAutoReply(analysis, rule);
  message.createDraftReply(reply)
    .addCC(rule.assignTo)
    .send();
  
  // アクション3: 既読化
  thread.markRead();
}

/**
 * 自動返信メール生成
 */
function createAutoReply(analysis, rule) {
  return `
こんにちは,

お問い合わせありがとうございます。
下記チームに自動割り当てさせていただきました。

【自動分類結果】
カテゴリ: ${analysis.category}
重要度: ${analysis.priority}
対応予定時間: ${rule.eta_hours}時間以内
信頼度: ${(analysis.confidence * 100).toFixed(1)}%

担当: ${rule.assignTo}

よろしくお願いいたします。
--
Automated Message by Email Routing System
  `.trim();
}

/**
 * Chat チャネルへ通知
 */
function notifyChatChannel(analysis, rule) {
  const payload = {
    text: `🚨 新規メール: ${analysis.category} (${analysis.priority})\n割り当て先: ${rule.assignTo}`
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };
  
  UrlFetchApp.fetch(CONFIG.CHAT_WEBHOOK_URL, options);
}

/**
 * トリガー設定（手動実行）
 */
function setupTrigger() {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processNewEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 新規トリガー作成: 5分ごと
  ScriptApp.newTrigger('processNewEmails')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  Logger.log("✅ トリガー設定完了 (5分ごと実行)");
}

/**
 * エラー通知
 */
function sendErrorNotification(error) {
  GmailApp.sendEmail(
    Session.getEffectiveUser().getEmail(),
    "❌ メールルーティング エラー",
    `エラー: ${error.message}\n\n時刻: ${new Date()}`
  );
}
```

### 3-5. gemini.gs

```javascript
// ================================
// Gemini API ラッパー
// ================================

const GeminiHelper = {
  
  /**
   * メール分類 (Gemini に問い合わせ)
   */
  classifyEmail: function(emailData) {
    const scriptProperties = PropertiesService.getScriptProperties();
    const apiKey = scriptProperties.getProperty('GEMINI_API_KEY');
    
    if (!apiKey) {
      throw new Error("Gemini API キーが設定されていません");
    }
    
    // プロンプト組立
    const prompt = CONFIG.CLASSIFICATION_PROMPT_TEMPLATE
      .replace('{subject}', emailData.subject)
      .replace('{body}', emailData.body.substring(0, 2000))  // 2000文字まで
      .replace('{sender}', emailData.sender)
      .replace('{attachments}', 'なし'); // TODO: 添付ファイル情報
    
    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: CONFIG.TIMEOUT_SECONDS
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
    
    let response = null;
    let retryCount = 0;
    
    // リトライロジック
    while (retryCount < CONFIG.MAX_RETRIES) {
      try {
        response = UrlFetchApp.fetch(url, options);
        break;
      } catch (error) {
        retryCount++;
        Logger.log(`⚠️ リトライ ${retryCount}/${CONFIG.MAX_RETRIES}: ${error.message}`);
        Utilities.sleep(CONFIG.RETRY_DELAY_MS * retryCount);
      }
    }
    
    if (!response) {
      throw new Error("Gemini API 呼び出し失敗");
    }
    
    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log(`❌ Gemini API エラー: ${responseCode}`);
      Logger.log(response.getContentText());
      throw new Error(`API エラー: ${responseCode}`);
    }
    
    const result = JSON.parse(response.getContentText());
    const textContent = result.candidates[0].content.parts[0].text;
    
    // JSON 抽出
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      Logger.log(`❌ JSON パース失敗: ${textContent}`);
      throw new Error("JSON 抽出失敗");
    }
    
    return JSON.parse(jsonMatch[0]);
  }
};
```

### 3-6. sheets.gs

```javascript
// ================================
// Sheets ヘルパー
// ================================

const SheetHelper = {
  
  getRulesSheet: function() {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return ss.getSheetByName(CONFIG.RULES_SHEET);
  },
  
  getLogsSheet: function() {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return ss.getSheetByName(CONFIG.LOGS_SHEET);
  },
  
  logProcessing: function(logData) {
    const logsSheet = this.getLogsSheet();
    logsSheet.appendRow([
      logData.timestamp,
      logData.subject,
      logData.sender,
      logData.category || "-",
      logData.priority || "-",
      logData.assignedTo || "-",
      logData.status,
      (logData.confidence * 100).toFixed(1) + "%" || "-",
      logData.action || ""
    ]);
  }
};

/**
 * ルールデータ解析
 */
function parseRulesData(data) {
  const headers = data[0];
  const rules = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) break;  // 空行で終了
    
    rules.push({
      id: row[0],
      category: row[1],
      priority: row[2],
      assignTo: row[3],
      label: row[4],
      eta_hours: row[5],
      remarks: row[6]
    });
  }
  
  return rules;
}
```

---

## ✅ ステップ 4: テストと検証

### 4-1. スクリプト設定

```javascript
// Apps Script エディタ → メニュー → "プロジェクトの設定"
// 実行ユーザー: 自分のメール
// スコープ確認: Gmail, Sheets, Chat API が含まれているか
```

### 4-2. テスト実行

```javascript
// Apps Script エディタ → 実行ボタン
// または: メニュー → "setupScriptProperties()" 実行

function testClassification() {
  const result = GeminiHelper.classifyEmail({
    subject: "テスト: API が動作しません",
    body: "15分前からAPI呼び出しがタイムアウトします。",
    sender: "test@example.com"
  });
  Logger.log(result);
}
```

### 4-3. 本番テスト

1. **テストメール送信** → 自分または同僚から
2. **ログシート確認** → 分類が記録されているか
3. **ラベル確認** → Gmail で正しくラベルが付与されているか
4. **Chat 通知確認** → 割り当てが通知されているか
5. **複数パターンテスト** → 高/中/低優先度を確認

---

## 🚀 ステップ 5: スケジュール設定

### 5-1. トリガー自動化

```javascript
// メニュー → 時計アイコン → "+ 新しいトリガー"
// 関数を選択: processNewEmails
// イベントを選択: 時間駆動
// 頻度: 5分ごと (またはビジネス要件に応じて)
```

### 5-2. 定期メンテナンスタスク

```javascript
function scheduleMaintenance() {
  // 毎週日曜 22:00 に実行
  // 1. ログ古いデータ削除（90日以上前）
  // 2. 統計レポート生成
  // 3. ルール定義の見直し通知
  
  const logsSheet = SheetHelper.getLogsSheet();
  const data = logsSheet.getDataRange().getValues();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  let deletedCount = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    const rowDate = new Date(data[i][0]);
    if (rowDate < ninetyDaysAgo) {
      logsSheet.deleteRow(i + 1);
      deletedCount++;
    }
  }
  
  Logger.log(`🗑️ 古いログ削除: ${deletedCount}行`);
}
```

---

## 📊 動作確認チェックリスト

- [ ] Gemini API キー設定済み
- [ ] Sheets ID 設定済み
- [ ] Gmail が正常に読み取れる
- [ ] ルール定義テーブル作成完了
- [ ] テストメール分類が正常に動作
- [ ] ラベル付与が機能
- [ ] Chat 通知が送信される
- [ ] ログシートに記録される
- [ ] トリガー設定完了
- [ ] エラーハンドリング確認

---

**次ステップ**: `sample-code/` の完全なコード例を参照してください。
