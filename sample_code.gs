function doGet(e) {  
  // TTS APIキーを設定
  const ttsApiKey = 'ttsApiKey'; // ここにTTS APIキーを入力

  // レスポンスとしてAPIキーを返す
  return ContentService.createTextOutput(JSON.stringify({ key: ttsApiKey }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    Logger.log("Request parameters: " + JSON.stringify(e.parameters)); // 送信されたパラメータをログに記録

    if (e.parameters.text && e.parameters.text.length > 0) {
      // テキスト入力を処理
      var transcript = e.parameters.text[0]; // テキストを取得
      if (!transcript || transcript.trim() === "") {
        transcript = "ラーメンの種類を教えてください。";
      } else {
        transcript = transcript.replace(/[\r\n]+/g, ' ').trim();
      }

      // Gemini APIに送信
      var geminiResponse = sendToGemini(transcript);

      // スプレッドシートに保存
      saveToSpreadsheet(transcript, geminiResponse);

      return ContentService.createTextOutput(JSON.stringify({
        'result': 'success',
        'transcript': transcript,
        'geminiResponse': geminiResponse
      })).setMimeType(ContentService.MimeType.JSON);

    } else {
      return ContentService.createTextOutput(JSON.stringify({
        'result': 'error',
        'error': 'No text provided.'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (f) {
    Logger.log("Error in doPost: " + f.toString());
    return ContentService.createTextOutput(JSON.stringify({
      'result': 'error',
      'error': f.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function sendToGemini(transcript) {
  // GoogleドキュメントのIDを使用してプロンプトを取得
  var docId = 'docId';
  var doc = DocumentApp.openById(docId);
  var docText = doc.getBody().getText();  // ドキュメントの本文を取得
  
  // Gemini APIのエンドポイントとAPIキー
  var apiKey = 'Gemini APIキー';  // ここにGemini APIキーを入力
  var url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`; // フラッシュからプロに変更

  // Googleドキュメントの内容を元にしたプロンプトを生成
  var prompt = `${docText} ${transcript} あなたはロビーというAIロボットです。質問された言語で回答して下さい。礼儀正しい話し方です。100字程度で簡潔に回答してください。`;

  // APIへ送信するペイロード
  var payload = {
    "contents": [{ "parts": [{ "text": prompt }] }]
  };

  // APIリクエストのオプション設定
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    // APIリクエストを送信
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    Logger.log("Gemini API Response: " + responseText);  // レスポンスをログに出力

    // レスポンスをJSON形式にパース
    var json = JSON.parse(responseText);

    // レスポンスに候補が存在すれば、そのテキストを返す
    if (json && json.candidates && json.candidates.length > 0) {
      var responseText = json.candidates[0].content.parts[0].text || "No response text available.";
      return truncateText(responseText, 120);  // 必要に応じてテキストをトリミング
    } else {
      return "No response from Gemini API or unexpected response format.";
    }
  } catch (error) {
    Logger.log("Error fetching from Gemini API: " + error.toString());
    return "Error: " + error.toString();
  }
}

// スプレッドシートに質問と回答を保存する関数
function saveToSpreadsheet(question, answer) {
  var sheetId = 'スプレッドシートID'; // スプレッドシートID
  var sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
  
  // 新しいデータを追加
  var timestamp = new Date();
  sheet.appendRow([timestamp, question, answer]);
}

// テキストをトリミングするヘルパー関数
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  var truncated = text.slice(0, maxLength);
  var lastPunctuation = Math.max(truncated.lastIndexOf('。'), truncated.lastIndexOf('、'), truncated.lastIndexOf(' '));
  if (lastPunctuation > 0) truncated = truncated.slice(0, lastPunctuation + 1);
  return truncated + '...';
}
