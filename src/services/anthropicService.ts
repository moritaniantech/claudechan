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
}
