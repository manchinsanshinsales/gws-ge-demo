#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Vertex AI Search MCP サーバーを有効化する
# -----------------------------------------------------------------------------
# 使い方:
#   bash scripts/enable-mcp.sh

set -euo pipefail

PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"

echo "============================================================"
echo " 🔌 Vertex AI Search MCP を有効化"
echo "============================================================"
echo "  Project: ${PROJECT_ID}"
echo "============================================================"

# 関連 API を一括有効化
echo "🔧 関連 API を有効化..."
gcloud services enable \
  aiplatform.googleapis.com \
  cloudresourcemanager.googleapis.com \
  chat.googleapis.com \
  discoveryengine.googleapis.com \
  --project="${PROJECT_ID}"

# Vertex AI Search MCP を有効化
echo "🔧 Vertex AI Search MCP を有効化..."
gcloud beta services mcp enable discoveryengine.googleapis.com \
  --project="${PROJECT_ID}"

echo
echo "✅ MCP 有効化完了"
