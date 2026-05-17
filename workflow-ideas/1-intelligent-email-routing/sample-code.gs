/**
 * インテリジェント メールルーティング - サンプルコード
 *
 * このファイルは Google Apps Script で使用できるコード集です
 * 各関数をコピーして自身の Apps Script プロジェクトに貼り付けてください
 *
 * 必須設定:
 * 1. CONFIG オブジェクトで環境変数を設定
 * 2. setupScriptProperties() 関数を実行して API キーを設定
 * 3. processNewEmails() 関数をトリガーに登録
 */

// ================================
// 設定・定数
// ================================

const CONFIG = {
  // Google Sheets 設定
  SPREADSHEET_ID: "YOUR_SPREADSHEET_ID_HERE",
  RULES_SHEET: "ルール定義",
  LOGS_SHEET: "ログ記録",

  // Gemini API 設定
  GEMINI_API_KEY: "", // setupScriptProperties() で設定される
  GEMINI_MODEL: "gemini-2.5-flash",

  // Gmail 設定
  LABEL_PREFIX: "🔴 ",
  ARCHIVE_LABEL: "✓ 処理済み",
  ERROR_LABEL: "⚠️ エラー",

  // Google Chat 設定
  CHAT_WEBHOOK_ENABLED: false,
  CHAT_WEBHOOK_URL: "https://chat.googleapis.com/v1/spaces/YOUR_SPACE_ID/messages",

  // 処理設定
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  TIMEOUT_SECONDS: 30,
  LOG_RETENTION_DAYS: 90
};

// ================================
// セットアップ関数（初回実行時）
// ================================

/**
 * 初期セットアップ
 * 実行: Apps Script エディタで setupScript() を実行
 */
function setupScript() {
  Logger.log("⚙️ セットアップ開始");

  // 1. プロパティサービスに API キーを保存
  const scriptProperties = PropertiesService.getScriptProperties();
  const apiKey = "YOUR_GEMINI_API_KEY_HERE"; // これを自分のキーで置き換え
  scriptProperties.setProperty('GEMINI_API_KEY', apiKey);
  scriptProperties.setProperty('SPREADSHEET_ID', CONFIG.SPREADSHEET_ID);

  Logger.log("✅ プロパティ設定完了");

  // 2. トリガー設定
  setupTrigger();

  // 3. テスト実行
  Logger.log("📋 設定情報:");
  Logger.log(`  - Spreadsheet ID: ${CONFIG.SPREADSHEET_ID}`);
  Logger.log(`  - Rules Sheet: ${CONFIG.RULES_SHEET}`);
  Logger.log(`  - Logs Sheet: ${CONFIG.LOGS_SHEET}`);
  Logger.log("✅ セットアップ完了！");
}

/**
 * トリガー設定（5分ごと実行）
 */
function setupTrigger() {
  // 既存トリガーを削除
  const projectTriggers = ScriptApp.getProjectTriggers();
  projectTriggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processNewEmails') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log("既存トリガー削除");
    }
  });

  // 新規トリガー作成: 5分ごと
  ScriptApp.newTrigger('processNewEmails')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("✅ トリガー設定: 5分ごと実行");
}

// ================================
// メイン処理
// ================================

/**
 * メール処理メイン関数
 * トリガーで定期実行される
 */
function processNewEmails() {
  try {
    const startTime = new Date();
    Logger.log(`\n🔄 [${ startTime.toLocaleTimeString('ja-JP')}] メール処理開始`);

    // 未読メール取得
    const unreadThreads = GmailApp.search('is:unread', 0, 50);
    Logger.log(`📧 未読メール: ${unreadThreads.length} 件`);

    if (unreadThreads.length === 0) {
      Logger.log("✅ 処理対象なし");
      return;
    }

    // ルール定義を取得
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const rulesSheet = ss.getSheetByName(CONFIG.RULES_SHEET);
    const rulesData = rulesSheet.getDataRange().getValues();
    const rules = parseRulesData(rulesData);

    Logger.log(`📋 ルール数: ${rules.length}`);

    let processedCount = 0;
    let errorCount = 0;

    // メール処理ループ
    for (let i = 0; i < unreadThreads.length; i++) {
      try {
        const thread = unreadThreads[i];
        const messages = thread.getMessages();

        if (messages.length === 0) continue;

        const message = messages[messages.length - 1];
        const subject = message.getSubject();
        const body = message.getPlainBody();
        const sender = message.getFrom();

        Logger.log(`\n[${i + 1}/${unreadThreads.length}] ${subject.substring(0, 50)}`);

        // Gemini で分類
        const analysis = classifyEmailWithGemini(subject, body);

        if (!analysis) {
          Logger.log("  ⚠️ 分類失敗 - スキップ");
          errorCount++;
          continue;
        }

        Logger.log(`  ✓ ${analysis.category} / ${analysis.priority} (信頼度: ${(analysis.confidence * 100).toFixed(1)}%)`);

        // ルール検索
        const rule = findRule(analysis, rules);
        if (!rule) {
          Logger.log("  ⚠️ マッチルールなし");
          errorCount++;
          continue;
        }

        Logger.log(`  → 割り当て先: ${rule.assignTo}`);

        // Gmail アクション実行
        executeGmailActions(message, thread, analysis, rule);

        // ログ記録
        logToSheet(ss, {
          timestamp: new Date(),
          subject: subject,
          sender: sender,
          category: analysis.category,
          priority: analysis.priority,
          assignedTo: rule.assignTo,
          status: "assigned",
          confidence: analysis.confidence,
          action: `ラベル: ${rule.label}`
        });

        processedCount++;

      } catch (error) {
        Logger.log(`  ❌ エラー: ${error.message}`);
        errorCount++;
      }
    }

    const endTime = new Date();
    const elapsed = (endTime - startTime) / 1000;
    Logger.log(`\n✅ 処理完了: ${processedCount}件成功, ${errorCount}件エラー (${elapsed.toFixed(1)}秒)`);

  } catch (error) {
    Logger.log(`🔴 致命的エラー: ${error.message}`);
  }
}

/**
 * Gemini でメールを分類
 */
function classifyEmailWithGemini(subject, body) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const apiKey = scriptProperties.getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    Logger.log("❌ API キーが見つかりません");
    return null;
  }

  // プロンプト作成
  const prompt = `
以下のメールを分析して、JSON形式で返答してください。

【メール情報】
件名: ${subject}
本文: ${body.substring(0, 1000)}

【分析指示】
カテゴリを以下から選択: IT, 営業, サポート, 財務, HR, その他
重要度を選択: HIGH, MEDIUM, LOW
対応時間目安（時間）
関連キーワード（3-5個）

【返答形式】
{
  "category": "カテゴリ",
  "priority": "HIGH/MEDIUM/LOW",
  "eta_hours": 数字,
  "keywords": ["キーワード1"],
  "confidence": 0.95
}
  `;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    timeout: CONFIG.TIMEOUT_SECONDS
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      Logger.log(`  ❌ API エラー: ${responseCode}`);
      return null;
    }

    const result = JSON.parse(response.getContentText());
    const textContent = result.candidates[0].content.parts[0].text;

    // JSON 抽出
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      Logger.log(`  ❌ JSON パース失敗`);
      return null;
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    Logger.log(`  ❌ 分類エラー: ${error.message}`);
    return null;
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
  // ラベル付与
  const labelName = rule.label;
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  thread.addLabel(label);

  // 既読化
  thread.markRead();

  // CC で返信（担当者に通知）
  const reply = `
こんにちは,

お問い合わせありがとうございます。
下記チームに自動割り当てさせていただきました。

【自動分類結果】
カテゴリ: ${analysis.category}
重要度: ${analysis.priority}
対応予定: ${rule.eta_hours}時間以内

担当: ${rule.assignTo}
  `.trim();

  message.createDraftReply(reply)
    .addCC(rule.assignTo)
    .send();
}

/**
 * Sheets にログ記録
 */
function logToSheet(ss, logData) {
  const logsSheet = ss.getSheetByName(CONFIG.LOGS_SHEET);
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

/**
 * ルールデータ解析
 */
function parseRulesData(data) {
  const rules = [];

  // ヘッダー行をスキップ（data[0]）
  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // 空行で終了
    if (!row[0] || row[0] === "") break;

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

// ================================
// テスト関数
// ================================

/**
 * テスト: Gemini 分類テスト
 */
function testGeminiClassification() {
  Logger.log("🧪 Gemini 分類テスト開始\n");

  const testCases = [
    {
      subject: "緊急: サーバーがダウンしています",
      body: "本番環境のサーバーが応答しなくなりました。エラーログを確認してください。"
    },
    {
      subject: "新製品についてのご質問です",
      body: "来週予定している新製品について、詳細をお知らせください。"
    },
    {
      subject: "月次報告書の提出",
      body: "今月の売上報告を提出いたします。..."
    }
  ];

  testCases.forEach((testCase, index) => {
    Logger.log(`テストケース ${index + 1}: ${testCase.subject}`);
    const result = classifyEmailWithGemini(testCase.subject, testCase.body);
    if (result) {
      Logger.log(`  結果: ${result.category} / ${result.priority} (信頼度: ${(result.confidence * 100).toFixed(1)}%)`);
    } else {
      Logger.log(`  ❌ 分類失敗`);
    }
    Logger.log("");
  });
}

/**
 * テスト: 設定確認
 */
function testConfiguration() {
  Logger.log("🧪 設定確認\n");
  Logger.log(`SPREADSHEET_ID: ${CONFIG.SPREADSHEET_ID}`);
  Logger.log(`RULES_SHEET: ${CONFIG.RULES_SHEET}`);
  Logger.log(`LOGS_SHEET: ${CONFIG.LOGS_SHEET}`);
  Logger.log(`GEMINI_MODEL: ${CONFIG.GEMINI_MODEL}`);

  const scriptProperties = PropertiesService.getScriptProperties();
  const apiKey = scriptProperties.getProperty('GEMINI_API_KEY');
  if (apiKey) {
    Logger.log(`✅ GEMINI_API_KEY は設定されています (${apiKey.substring(0, 5)}...)`);
  } else {
    Logger.log(`❌ GEMINI_API_KEY が設定されていません`);
  }
}

// ================================
// ユーティリティ
// ================================

/**
 * ログシートの古いデータを削除
 */
function cleanupOldLogs() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const logsSheet = ss.getSheetByName(CONFIG.LOGS_SHEET);
  const data = logsSheet.getDataRange().getValues();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - CONFIG.LOG_RETENTION_DAYS);

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

/**
 * 統計情報取得
 */
function getStatistics() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const logsSheet = ss.getSheetByName(CONFIG.LOGS_SHEET);
  const data = logsSheet.getDataRange().getValues();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let todayCount = 0;
  const categoryCount = {};
  const priorityCount = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDate = new Date(row[0]);
    rowDate.setHours(0, 0, 0, 0);

    if (rowDate.getTime() === today.getTime()) {
      todayCount++;

      const category = row[3];
      const priority = row[4];

      categoryCount[category] = (categoryCount[category] || 0) + 1;
      priorityCount[priority] = (priorityCount[priority] || 0) + 1;
    }
  }

  Logger.log("📊 統計情報:");
  Logger.log(`  本日処理件数: ${todayCount}件`);
  Logger.log(`  カテゴリ別: ${JSON.stringify(categoryCount)}`);
  Logger.log(`  優先度別: ${JSON.stringify(priorityCount)}`);
}
