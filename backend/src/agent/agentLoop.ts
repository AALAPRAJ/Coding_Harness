import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { AgentActionType, AgentLoopResult, AgentStepLog, ToolResult } from '@coding-harness/shared';
import { LLMClient } from './llmClient';
import { ToolCallParser, ParsedToolCall } from './parser';
import {
  SYSTEM_PROMPT,
  buildProjectContext,
  createInitialUserPrompt,
  createErrorFeedbackPrompt,
} from './prompts';
import { ToolRegistry } from '../tools/toolRegistry';
import { GitService } from '../services/gitService';
import { config } from '../config';
import { logger } from '../logger';

export interface AgentLoopOptions {
  taskId: string;
  workspacePath: string;
  prompt: string;
  containerId?: string;
  llmClient?: LLMClient;
  maxIterations?: number;
  onProgress?: (message: string, stepLog?: AgentStepLog) => Promise<void> | void;
}

export class AgentLoop {
  /**
   * Executes the autonomous AI agent loop on the workspace.
   * Runs the state machine: Analyze -> Plan -> Execute Tools -> Verify -> Fix -> Diff.
   */
  static async run(options: AgentLoopOptions): Promise<AgentLoopResult> {
    const {
      taskId,
      workspacePath,
      prompt,
      containerId,
      maxIterations = config.agentMaxIterations,
      onProgress,
    } = options;

    const llm = options.llmClient || new LLMClient();
    const steps: AgentStepLog[] = [];
    let totalToolCalls = 0;

    const notify = async (msg: string, stepLog?: AgentStepLog) => {
      logger.info(`[Task ${taskId}] ${msg}`);
      if (onProgress) {
        await onProgress(msg, stepLog);
      }
    };

    await notify('Phase 4: Initializing AI Agent reasoning engine...');

    // 1. Analyze Project: build initial context
    await notify('Analyzing repository structure and dependency manifests...');
    const projectContext = await buildProjectContext(workspacePath);

    // 2. Setup conversation history
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: createInitialUserPrompt(prompt, projectContext),
      },
    ];

    // Format all 6 tools for OpenAI function calling
    const tools = LLMClient.formatToolsForOpenAI(ToolRegistry.getToolDefinitions());

    let iteration = 0;
    let isCompleted = false;
    let loopError: string | undefined;

    // 3. Autonomous Iteration Loop
    while (iteration < maxIterations && !isCompleted) {
      iteration++;
      await notify(`--- Starting Agent Iteration ${iteration}/${maxIterations} ---`);

      try {
        const response = await llm.chat(messages, tools);

        // Record thought / assistant explanation if provided
        if (response.content) {
          await notify(`Agent Reasoning: ${response.content}`);
          steps.push({
            step: iteration,
            action: AgentActionType.PLAN,
            thought: response.content,
            timestamp: new Date().toISOString(),
          });
        }

        // Parse tool calls
        let parsedCalls: ParsedToolCall[] = [];
        if (response.toolCalls && response.toolCalls.length > 0) {
          parsedCalls = ToolCallParser.parseOpenAIToolCalls(response.toolCalls);
        } else if (response.content) {
          // Fallback parser for text-embedded JSON tool calls
          parsedCalls = ToolCallParser.parseTextToolCalls(response.content);
        }

        // If no tool calls were requested and model responded with content, agent signals task complete
        if (parsedCalls.length === 0) {
          await notify('Agent determined that no further tool calls are required. Task complete.');
          isCompleted = true;
          steps.push({
            step: iteration,
            action: AgentActionType.FINISH,
            thought: response.content || 'Completed without additional tool calls.',
            timestamp: new Date().toISOString(),
          });
          break;
        }

        // Append assistant message containing the tool calls to history
        messages.push({
          role: 'assistant',
          content: response.content,
          tool_calls: response.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: tc.function,
          })),
        });

        // Execute each tool call sequentially
        for (const toolCall of parsedCalls) {
          totalToolCalls++;
          await notify(
            `Executing tool [${toolCall.name}] with args: ${JSON.stringify(toolCall.args)}`,
          );

          const toolResult: ToolResult = await ToolRegistry.executeTool(
            toolCall.name,
            toolCall.args,
            {
              taskId,
              workspacePath,
              containerId,
            },
          );

          const stepLog: AgentStepLog = {
            step: iteration,
            action: AgentActionType.TOOL_CALL,
            toolName: toolCall.name,
            toolArgs: toolCall.args,
            toolResult,
            timestamp: new Date().toISOString(),
          };
          steps.push(stepLog);

          await notify(
            `Tool [${toolCall.name}] ${toolResult.success ? 'succeeded' : 'failed'} in ${toolResult.executionTimeMs}ms`,
            stepLog,
          );

          // Append tool execution result back into conversation history
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult.output ?? { error: toolResult.error }),
          });

          // Verification feedback: if run_command returned a non-zero exit code, feed failure into next prompt
          if (toolCall.name === 'run_command' && toolResult.output) {
            const cmdOutput = toolResult.output as {
              exitCode: number;
              stdout: string;
              stderr: string;
            };
            if (cmdOutput.exitCode !== 0) {
              await notify(
                `Verification failure detected (exit code: ${cmdOutput.exitCode}). Requesting automated fix...`,
              );
              messages.push({
                role: 'user',
                content: createErrorFeedbackPrompt(
                  String(toolCall.args.command || ''),
                  cmdOutput.exitCode,
                  cmdOutput.stdout,
                  cmdOutput.stderr,
                ),
              });
            }
          }
        }
      } catch (err) {
        const error = err as Error;
        loopError = error.message;
        await notify(`Agent iteration encountered error: ${error.message}`);
        steps.push({
          step: iteration,
          action: AgentActionType.ERROR,
          thought: error.message,
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }

    if (iteration >= maxIterations && !isCompleted) {
      await notify(
        `Warning: Reached maximum allowed agent iterations (${maxIterations}). Halting loop.`,
      );
    }

    // 4. Capture Final Diff
    await notify('Generating final unified Git diff of all applied changes...');
    const finalDiff = await GitService.getGitDiff(workspacePath);
    if (finalDiff && finalDiff.trim().length > 0) {
      await notify(`Captured diff (${finalDiff.split('\n').length} lines modified).`);
    } else {
      await notify('No file modifications detected in Git tree.');
    }

    const success = (isCompleted || totalToolCalls > 0) && !loopError;

    return {
      success,
      iterations: iteration,
      totalToolCalls,
      steps,
      finalDiff: finalDiff || undefined,
      error: loopError,
    };
  }
}
