import { SlackMessage } from "../services/slackMessageService";

interface ClaudeApiResponse {
  content: Array<{
    text: string;
  }>;
}

export async function callClaudeApi(
  message: string,
  threadMessages: SlackMessage[],
  apiKey: string
): Promise<string> {
  console.log("Preparing conversation history for Claude API");

  // 会話履歴を整形
  const conversationHistory = threadMessages.map((msg) => ({
    role: msg.role || "user",
    content: msg.text,
  }));

  // 新しいメッセージを追加
  conversationHistory.push({
    role: "user",
    content: message,
  });

  console.log("Sending request to Claude API", {
    messageCount: conversationHistory.length,
    lastMessage: message.substring(0, 100) + "...",
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        messages: conversationHistory,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error response:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as ClaudeApiResponse;
    console.log("Successfully received response from Claude API", {
      responseLength: data.content[0].text.length,
    });

    return data.content[0].text;
  } catch (error) {
    console.error("Error calling Claude API:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
