import { AgentMode, LLMConfig, PermissionRequest } from '@koala/shared';
import { streamText, tool, ModelMessage, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type AgentCallbacks = {
  onChunk: (chunk: string) => void;
  onRequestPermission: (request: PermissionRequest) => Promise<boolean>;
};

export class KoalaAgent {
  private config: LLMConfig;
  private mode: AgentMode;

  constructor(config: LLMConfig, mode: AgentMode) {
    this.config = config;
    this.mode = mode;
  }

  private getProvider() {
    if (this.config.provider === 'openrouter') {
      const openrouter = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: this.config.apiKey || '',
      });
      return openrouter(this.config.model);
    }
    
    if (this.config.provider === 'anthropic') {
      const anthropic = createAnthropic({
        apiKey: this.config.apiKey || '',
      });
      return anthropic(this.config.model);
    }
    
    // Default fallback to standard OpenAI
    const openai = createOpenAI({
      apiKey: this.config.apiKey || '',
    });
    return openai(this.config.model);
  }

  public async processChat(
    messages: ModelMessage[],
    callbacks: AgentCallbacks
  ): Promise<void> {
    const model = this.getProvider();
    
    const result = streamText({
      model,
      system: `You are Koala Code, a highly capable AI programming assistant. You operate in ${this.mode} mode. You can read, write, and execute commands on the user's system. Use your tools carefully. Always prioritize addressing the user's request.`,
      messages,
      tools: {
        read_file: tool({
          description: 'Read the contents of a file',
          inputSchema: z.object({
            filePath: z.string().describe('Absolute path to the file to read'),
          }),
          execute: async ({ filePath }: { filePath: string }) => {
            const approved = await callbacks.onRequestPermission({
              id: Math.random().toString(36).substring(7),
              tool: 'read_file',
              args: { filePath },
              description: `Read file: ${filePath}`,
            });
            
            if (!approved) return "Execution blocked: User denied permission to read this file.";
            
            try {
              const content = await fs.readFile(filePath, 'utf-8');
              return content;
            } catch (e: any) {
              return `Error reading file: ${e.message}`;
            }
          }
        }),
        write_file: tool({
          description: 'Write contents to a file, overwriting existing content',
          inputSchema: z.object({
            filePath: z.string().describe('Absolute path to the file to write'),
            content: z.string().describe('The content to write into the file'),
          }),
          execute: async ({ filePath, content }: { filePath: string; content: string }) => {
            const approved = await callbacks.onRequestPermission({
              id: Math.random().toString(36).substring(7),
              tool: 'write_file',
              args: { filePath },
              description: `Write to file: ${filePath}`,
            });
            
            if (!approved) return "Execution blocked: User denied permission to write this file.";
            
            try {
              await fs.mkdir(path.dirname(filePath), { recursive: true });
              await fs.writeFile(filePath, content, 'utf-8');
              return `Successfully wrote to ${filePath}`;
            } catch (e: any) {
              return `Error writing file: ${e.message}`;
            }
          }
        }),
        run_command: tool({
          description: 'Execute a CLI command in the background',
          inputSchema: z.object({
            command: z.string().describe('The command to execute (e.g. npm run build, ls -la)'),
            cwd: z.string().describe('The working directory to execute the command in').optional(),
          }),
          execute: async ({ command, cwd }: { command: string; cwd?: string }) => {
             const approved = await callbacks.onRequestPermission({
              id: Math.random().toString(36).substring(7),
              tool: 'run_command',
              args: { command, cwd },
              description: `Run command: ${command}`,
            });
            
            if (!approved) return "Execution blocked: User denied permission to run this command.";
            
            try {
              const { stdout, stderr } = await execAsync(command, { cwd });
              return `Command executed.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
            } catch (e: any) {
              return `Command failed:\n${e.message}\nSTDOUT:\n${e.stdout}\nSTDERR:\n${e.stderr}`;
            }
          }
        })
      },
      stopWhen: stepCountIs(10),
    });

    // Use fullStream to properly handle text + tool call steps.
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        const textPart = part as { text?: unknown; delta?: unknown; textDelta?: unknown };
        const delta = typeof textPart.text === 'string'
          ? textPart.text
          : typeof textPart.delta === 'string'
            ? textPart.delta
            : typeof textPart.textDelta === 'string'
              ? textPart.textDelta
            : '';

        if (delta) {
          callbacks.onChunk(delta);
        }
      }
      // tool-call and tool-result parts are handled automatically by maxSteps
    }
  }
}
