import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { ToolDefinition } from '@coding-harness/shared';
import { config } from '../config';
import { logger } from '../logger';

export interface LLMResponse {
  content: string | null;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class LLMClient {
  private client: OpenAI | null = null;
  private isMock: boolean;

  constructor(apiKey?: string, baseUrl?: string, isMock: boolean = false) {
    this.isMock = isMock || config.aiProvider === 'mock' || (!apiKey && !config.aiApiKey);

    if (!this.isMock) {
      this.client = new OpenAI({
        apiKey: apiKey || config.aiApiKey,
        baseURL: baseUrl || config.aiBaseUrl,
      });
    }
  }

  /**
   * Transforms shared ToolDefinition objects into OpenAI function calling format.
   */
  static formatToolsForOpenAI(toolDefinitions: ToolDefinition[]): ChatCompletionTool[] {
    return toolDefinitions.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Sends chat messages and available tools to the LLM and retrieves the model's response.
   */
  async chat(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[],
    options: ChatOptions = {},
  ): Promise<LLMResponse> {
    if (this.isMock || !this.client) {
      logger.info('LLMClient running in MOCK mode (no live API request dispatched)');
      return this.mockChatResponse(messages);
    }

    const model = options.model || config.aiModel;
    const temperature = options.temperature ?? config.agentTemperature;

    logger.debug(
      `Dispatching LLM chat completion request to model "${model}" (${messages.length} messages)`,
    );

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        temperature,
        max_tokens: options.maxTokens || 4096,
      });

      const choice = completion.choices[0];
      const message = choice?.message;

      const toolCalls = message?.tool_calls
        ? message.tool_calls
            .filter(
              (
                tc,
              ): tc is typeof tc & {
                type: 'function';
                function: { name: string; arguments: string };
              } => tc.type === 'function' && 'function' in tc,
            )
            .map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            }))
        : undefined;

      return {
        content: message?.content || null,
        toolCalls,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('LLM API completion failed:', err);
      throw error;
    }
  }

  /**
   * Deterministic mock response generator for testing and offline environments.
   */
  private mockChatResponse(messages: ChatCompletionMessageParam[]): LLMResponse {
    const lastMessage = messages[messages.length - 1];
    const userText = typeof lastMessage?.content === 'string' ? lastMessage.content : '';

    // If initial prompt, simulate listing the directory first
    if (messages.length <= 2) {
      return {
        content: 'I will analyze the project directory first to understand the workspace layout.',
        toolCalls: [
          {
            id: 'mock-call-list-dir',
            type: 'function',
            function: {
              name: 'list_dir',
              arguments: JSON.stringify({ path: '.' }),
            },
          },
        ],
      };
    }

    // If tool response received, conclude task in mock
    if (lastMessage?.role === 'tool') {
      return {
        content:
          'I have inspected the repository and verified the required changes. Task is complete.',
      };
    }

    return {
      content: `Received instruction: "${userText}". Executed planned changes successfully.`,
    };
  }
}
