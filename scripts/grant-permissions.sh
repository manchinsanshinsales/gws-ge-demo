#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Vertex AI Reasoning Engine の Service Agent に
# Discovery Engine Viewer ロールを付与するスクリプト
# -----------------------------------------------------------------------------
# 使い方:
#   bash scripts/grant-permissions.sh
#
# タイミング:
#   `bash scripts/deploy.sh` 実行中、ログに
#   "Deploying to agent engine..." と出たタイミングで
#   別ターミナルから実行する。

set -euo pipefail

PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
SERVICE_ACCOUNT="service-${PROJECT_NUMBER}@gcp-sa-aiplatform-re.iam.gserviceaccount.com"

echo "============================================================"
echo " 🔐 Reasoning Engine SA に権限を付与します"
echo "============================================================"
echo "  Project ID     : ${PROJECT_ID}"
echo "  Project Number : ${PROJECT_NUMBER}"
echo "  SA             : ${SERVICE_ACCOUNT}"
echo "  Role           : roles/discoveryengine.viewer"
echo "============================================================"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/discoveryengine.viewer"

echo
echo "✅ 権限付与完了"
