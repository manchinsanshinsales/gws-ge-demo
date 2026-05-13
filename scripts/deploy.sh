#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Vertex AI Agent Engine に ADK エージェントをデプロイするスクリプト
# -----------------------------------------------------------------------------
# 使い方:
#   bash scripts/deploy.sh
#
# 前提:
#   - .venv が activate されていること
#   - poetry install 済み
#   - gcloud auth 済み

set -euo pipefail

# プロジェクトを gcloud から取得
PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
DISPLAY_NAME="Enterprise AI"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "❌ gcloud のプロジェクトが未設定です。"
  echo "   gcloud config set project <YOUR_PROJECT_ID> を実行してください。"
  exit 1
fi

echo "============================================================"
echo " 🚀 ADK エージェントをデプロイします"
echo "============================================================"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "  Name    : ${DISPLAY_NAME}"
echo "------------------------------------------------------------"
echo
echo " 5〜10分かかります。途中で 'Deploying to agent engine...'"
echo " と表示されたら、別ターミナルで:"
echo "   bash scripts/grant-permissions.sh"
echo " を実行して権限を付与してください。"
echo "============================================================"
echo

adk deploy agent_engine \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --display_name="${DISPLAY_NAME}" \
  enterprise_ai

echo
echo "✅ デプロイ完了"
echo "緑色で表示された Reasoning Engine リソース名をコピーして"
echo "Gemini Enterprise の Agent 登録画面に貼り付けてください。"
echo "形式: projects/<PROJECT_ID>/locations/${REGION}/reasoningEngines/<ID>"
