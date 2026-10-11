import { logger } from '../logger';

export interface ParsedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  rawArgs: string;
}

export class ToolCallParser {
  /**
   * Parses tool calls returned by OpenAI-compatible API responses.
   */
  static parseOpenAIToolCalls(
    toolCalls: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }>,
  ): ParsedToolCall[] {
    const results: ParsedToolCall[] = [];

    for (const call of toolCalls) {
      if (call.type !== 'function' || !call.function) continue;

      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(call.function.arguments || '{}');
      } catch (err) {
        logger.warn(`Failed to parse tool call JSON arguments for ${call.function.name}:`, err);
        // Fallback: try to repair common unescaped string issues or return empty
        parsedArgs = {};
      }

      results.push({
        id: call.id,
        name: call.function.name,
        args: parsedArgs,
        rawArgs: call.function.arguments,
      });
    }

    return results;
  }

  /**
   * Fallback parser that inspects raw text output for embedded JSON or tool call blocks.
   * Useful when models output JSON in message text instead of native function calling.
   */
  static parseTextToolCalls(content: string): ParsedToolCall[] {
    const results: ParsedToolCall[] = [];
    if (!content) return results;

    // Pattern 1: Markdown JSON code block containing tool/action
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    let match: RegExpExecArray | null;

    while ((match = jsonBlockRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.tool || parsed.name || parsed.action) {
          const toolName = parsed.tool || parsed.name || parsed.action;
          const args = parsed.args || parsed.parameters || parsed.arguments || {};
          results.push({
            id: `call-text-${Date.now()}-${results.length}`,
            name: String(toolName),
            args: typeof args === 'object' && args !== null ? args : {},
            rawArgs: match[1],
          });
        }
      } catch {
        // Not a JSON tool call block, continue
      }
    }

    return results;
  }
}
