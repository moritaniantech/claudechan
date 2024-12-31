import Anthropic from "@anthropic-ai/sdk";
import { AnthropicMessage, Env } from "../types";
import { logger } from "../utils/logger";
import { AppError } from "../utils/errorHandler";

export class AnthropicService {
  private client: Anthropic;

  constructor(private env: Env) {
    this.client = new Anthropic({
      apiKey: this.env.ANTHROPIC_API_KEY,
    });
  }

  async generateResponse(messages: AnthropicMessage[]): Promise<string> {
    try {
      logger.info(`Generating response from Anthropic API`, {
        messageCount: messages.length,
      });

      const response = await this.client.messages
        .create({
          model: "claude-3-5-sonnet-latest",
          messages: messages,
          max_tokens: 1024,
        })
        .catch((err) => {
          if (err instanceof Anthropic.APIError) {
            logger.error("Anthropic API Error", err);
            throw err;
          } else {
            throw err;
          }
        });

      logger.debug(`Received response from Anthropic API`, {
        response,
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new AppError("Unexpected response type from Anthropic API", null);
      }

      return content.text;
    } catch (error) {
      logger.error(`Error generating response from Anthropic API`, {
        error,
      });
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
      logger.info(`Analyzing PDF content with Anthropic API`);

      const response = await this.client.messages
        .create({
          model: "claude-3-5-sonnet-latest",
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
        })
        .catch((err) => {
          if (err instanceof Anthropic.APIError) {
            logger.error("Anthropic API Error", err);
            throw err;
          } else {
            throw err;
          }
        });

      logger.debug(`Received PDF analysis from Anthropic API`, {
        response,
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new AppError("Unexpected response type from Anthropic API", null);
      }

      return content.text;
    } catch (error) {
      logger.error(`Error analyzing PDF with Anthropic API`, {
        error,
      });
      throw new AppError("Failed to analyze PDF with Anthropic API", error);
    }
  }
}
