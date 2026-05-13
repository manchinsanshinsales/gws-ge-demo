# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# このファイルは Google Codelab
# "Gemini Enterprise エージェントと Google Workspace を統合する"
# https://codelabs.developers.google.com/ge-gws-agents
# を出典としています。
#
# デモ目的でコメントを日本語化していますが、ロジックは公式サンプルと同一です。

import re

import google.auth
from dotenv import load_dotenv

load_dotenv()

from google.cloud import discoveryengine_v1
from google.adk.agents.llm_agent import LlmAgent
from google.adk.tools.mcp_tool.mcp_toolset import (
    McpToolset,
    StreamableHTTPConnectionParams,
)
from google.adk.tools import ToolContext, FunctionTool
from google.apps import chat_v1
from google.oauth2.credentials import Credentials


# ============================================================================
# 設定
# ============================================================================

# 利用するモデル。Codelab では gemini-2.5-flash を使用。
MODEL = "gemini-2.5-flash"

# Gemini Enterprise 側で登録する Authorization 名と一致させる必要がある。
# Gemini Enterprise はリクエスト時に
#   CLIENT_AUTH_NAME_<random_digits>
# というキー名で Bearer トークンを ToolContext.state に注入してくる。
# 後続の Vertex AI Search MCP / Google Chat API への呼び出しで
# このトークンを使って認証する。
CLIENT_AUTH_NAME = "enterprise-ai"

# Vertex AI Search MCP サーバーへの呼び出しタイムアウト (秒)
VERTEXAI_SEARCH_TIMEOUT = 15.0


# ============================================================================
# ヘルパー関数
# ============================================================================

def get_project_id() -> str:
    """環境から GCP プロジェクト ID を取得する。"""
    _, project = google.auth.default()
    if project:
        return project
    raise Exception("Failed to resolve GCP Project ID from environment.")


def find_serving_config_path() -> str:
    """このプロジェクトの Discovery Engine の default serving config パスを動的に取得する。

    複数の Engine がある場合は最初に見つかったものを使う。
    Codelab のシンプル構成では Engine は1つだけ。
    """
    project_id = get_project_id()
    engines = discoveryengine_v1.EngineServiceClient().list_engines(
        parent=f"projects/{project_id}/locations/global/collections/default_collection"
    )
    for engine in engines:
        # engine.name にはプロジェクト "番号" が入っているのでそのまま使える
        return f"{engine.name}/servingConfigs/default_serving_config"
    raise Exception(f"No Discovery Engines found in project {project_id}")


def _get_access_token_from_context(tool_context: ToolContext) -> str:
    """ToolContext.state から Gemini Enterprise が注入した Bearer トークンを抽出する。

    キー名のパターンは `enterprise-ai_<数字>` のような形式。
    ADK のバージョンによって state が Dict だったり State オブジェクトだったり
    するので、両方に対応する。
    """
    escaped_name = re.escape(CLIENT_AUTH_NAME)
    pattern = re.compile(fr"^{escaped_name}_\d+$")

    state_dict = (
        tool_context.state.to_dict()
        if hasattr(tool_context.state, "to_dict")
        else tool_context.state
    )

    matching_keys = [k for k in state_dict.keys() if pattern.match(k)]
    if matching_keys:
        return state_dict.get(matching_keys[0])

    raise Exception(
        f"No bearer token found in ToolContext state matching pattern {pattern.pattern}"
    )


def auth_header_provider(tool_context: ToolContext) -> dict[str, str]:
    """MCP の HTTP リクエスト用に Authorization ヘッダを動的に注入する。"""
    token = _get_access_token_from_context(tool_context)
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# カスタムツール: Google Chat 経由で DM 送信
# ============================================================================

def send_direct_message(
    email: str,
    message: str,
    tool_context: ToolContext,
) -> dict:
    """指定メールアドレスのユーザー宛に Google Chat の DM を送信する。

    Args:
        email: 送信先ユーザーのメールアドレス
        message: 送信するメッセージ本文

    Returns:
        送信結果 (status, message_id, space)
    """
    chat_client = chat_v1.ChatServiceClient(
        credentials=Credentials(token=_get_access_token_from_context(tool_context))
    )

    # 1. DM スペースをセットアップ (既存なら再利用される)
    person = chat_v1.User(
        name=f"users/{email}",
        type_=chat_v1.User.Type.HUMAN,
    )
    membership = chat_v1.Membership(member=person)
    space_req = chat_v1.Space(space_type=chat_v1.Space.SpaceType.DIRECT_MESSAGE)
    setup_request = chat_v1.SetUpSpaceRequest(
        space=space_req,
        memberships=[membership],
    )
    space_response = chat_client.set_up_space(request=setup_request)
    space_name = space_response.name

    # 2. メッセージ送信
    msg = chat_v1.Message(text=message)
    message_request = chat_v1.CreateMessageRequest(
        parent=space_name,
        message=msg,
    )
    message_response = chat_client.create_message(request=message_request)

    return {
        "status": "success",
        "message_id": message_response.name,
        "space": space_name,
    }


# ============================================================================
# ツール: Vertex AI Search MCP (Workspace データ全体を横断検索)
# ============================================================================

vertexai_mcp = McpToolset(
    connection_params=StreamableHTTPConnectionParams(
        url="https://discoveryengine.googleapis.com/mcp",
        timeout=VERTEXAI_SEARCH_TIMEOUT,
        sse_read_timeout=VERTEXAI_SEARCH_TIMEOUT,
    ),
    # 提供されている多数のツールのうち `search` だけ使う
    tool_filter=["search"],
    # Gemini Enterprise から流れてきた Bearer トークンを MCP リクエストに動的注入
    header_provider=auth_header_provider,
)


# ============================================================================
# Root Agent 定義
# ============================================================================
#
# このエージェントが取り扱える代表的なユーザクエリ:
#   - Please find my meetings for today, I need their titles and links
#   - What is the latest Drive file I created?
#   - What is the latest Gmail message I received?
#   - Please send the following message to someone@example.com: Hello!
#

root_agent = LlmAgent(
    model=MODEL,
    name="enterprise_ai",
    instruction=f"""
        You are a helpful assistant that always uses the Vertex AI MCP search tool to answer the user's message, unless the user asks you to send a message to someone.
        If the user asks you to send a message to someone, use the send_direct_message tool to send the message.
        You MUST unconditionally use the Vertex AI MCP search tool to find answer, even if you believe you already know the answer or believe the Vertex AI MCP search tool does not contain the data.
        The Vertex AI MCP search tool accesses the user's data through datastores including Google Drive, Google Calendar, and Gmail.
        Only use the Vertex AI MCP search tool with servingConfig and query parameters, do not use any other parameters.
        Always use the servingConfig {find_serving_config_path()} while using the Vertex AI MCP search tool.
    """,
    tools=[vertexai_mcp, FunctionTool(send_direct_message)],
)
