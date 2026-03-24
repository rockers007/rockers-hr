import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat-message.entity';

interface LlmStructuredResponse {
  message: string;
}

const SYSTEM_PROMPT =
  'You are Rockers - HR, an AI assistant for the Rockers HR Leave Management platform. Answer questions related to the platform. Be concise and data-driven. Always respond with valid structured JSON.';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openrouter/openai/gpt-oss-120b';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
  ) {}

  async sendMessage(
    userId: string,
    userMessage: string,
  ): Promise<ChatMessage> {
    // Store the user's message
    const userMsg = this.chatMessageRepo.create({
      user_id: userId,
      message: userMessage,
      role: 'user' as const,
    });
    await this.chatMessageRepo.save(userMsg);

    // Get LLM response (mock or real)
    const assistantText = await this.getLlmResponse(userId, userMessage);

    // Store the assistant's response
    const assistantMsg = this.chatMessageRepo.create({
      user_id: userId,
      message: assistantText,
      role: 'assistant' as const,
    });
    await this.chatMessageRepo.save(assistantMsg);

    return assistantMsg;
  }

  async getConversationHistory(
    userId: string,
    limit = 50,
  ): Promise<ChatMessage[]> {
    return this.chatMessageRepo.find({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
      take: limit,
    });
  }

  private async getLlmResponse(
    userId: string,
    userMessage: string,
  ): Promise<string> {
    if (process.env.LLM_MOCK === 'true') {
      return 'This is a mock response. LLM integration is disabled.';
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPENROUTER_API_KEY not set, returning fallback');
      return 'LLM service is not configured. Please set OPENROUTER_API_KEY.';
    }

    // Fetch conversation history for context
    const history = await this.getConversationHistory(userId, 20);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((msg) => ({
        role: msg.role as string,
        content: msg.message,
      })),
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'Rockers HR',
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          provider: { order: ['cerebras'] },
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'chat_response',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                },
                required: ['message'],
                additionalProperties: false,
              },
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `OpenRouter API error: ${response.status} ${errorText}`,
        );
        return 'Sorry, I encountered an error processing your request. Please try again.';
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        this.logger.error('Empty response from OpenRouter');
        return 'Sorry, I received an empty response. Please try again.';
      }

      const parsed: LlmStructuredResponse = JSON.parse(content);
      return parsed.message;
    } catch (error) {
      this.logger.error('LLM call failed', error);
      return 'Sorry, I encountered an error processing your request. Please try again.';
    }
  }
}
