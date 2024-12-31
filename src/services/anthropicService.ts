import { AnthropicMessage, Env } from "../types";
import { logger } from "../utils/logger";
import { AppError } from "../utils/errorHandler";

export class AnthropicService {
  constructor(private env: Env) {}

  async generateResponse(messages: AnthropicMessage[]): Promise<string> {
    try {
      logger.info("Generating response from Anthropic API", {
        messageCount: messages.length,
      });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.env.ANTHROPIC_API_KEY,
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

  async analyzePdfContent(
    pdfBase64: string,
    userMessage?: string
  ): Promise<string> {
    try {
      logger.info("Analyzing PDF content with Anthropic API");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: pdfBase64,
                  },
                },
                {
                  type: "text",
                  text:
                    userMessage || "このPDFの内容を要約して説明してください。",
                },
              ],
            },
          ],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new AppError("Anthropic API PDF analysis failed", error);
      }

      const result = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };
      logger.debug("Received PDF analysis from Anthropic API", result);

      return result.content[0].text;
    } catch (error) {
      logger.error("Error analyzing PDF with Anthropic API", error);
      throw new AppError("Failed to analyze PDF with Anthropic API", error);
    }
  }
}
