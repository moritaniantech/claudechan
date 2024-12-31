import { AnthropicMessage } from "../types";
import { logger } from "../utils/logger";
import { AppError } from "../utils/errorHandler";

export class AnthropicService {
  constructor(private apiKey: string) {}

  async generateResponse(messages: AnthropicMessage[]): Promise<string> {
    try {
      logger.info("Generating response from Anthropic API", {
        messageCount: messages.length,
      });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          messages: messages,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError("Anthropic API request failed", error);
      }

      const result = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };
      logger.debug("Received response from Anthropic API", result);

      return result.content[0].text;
    } catch (error) {
      logger.error("Error generating response from Anthropic API", error);
      throw new AppError(
        "Failed to generate response from Anthropic API",
        error
      );
    }
  }

  async analyzePdf(
    pdfData: ArrayBuffer,
    messages: AnthropicMessage[]
  ): Promise<string> {
    try {
      // PDFデータをBase64にエンコード
      const pdfBase64 = Buffer.from(pdfData).toString("base64");

      // APIリクエストのボディを構築
      const requestBody = {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [
          {
            content: [
              {
                type: "document",
                source: {
                  media_type: "application/pdf",
                  type: "base64",
                  data: pdfBase64,
                },
                cache_control: { type: "ephemeral" },
              },
              ...messages.map((message) => ({
                type: "text",
                text: message.content,
              })),
            ],
            role: "user",
          },
        ],
      };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError("Anthropic PDF analysis request failed", error);
      }

      const result = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };
      return result.content[0].text;
    } catch (error) {
      logger.error("Error analyzing PDF with Anthropic API", error);
      throw new AppError("Failed to analyze PDF with Anthropic API", error);
    }
  }
}
