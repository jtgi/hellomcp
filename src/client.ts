import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline/promises";
import { MessageParam, Tool } from "@anthropic-ai/sdk/resources";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import dotenv from "dotenv";
import chalk from "chalk";
import ora from "ora";
import { aopic } from "./lib/anthropic.js";
dotenv.config();

const SYSTEM_PROMPT = `You are a good friend with a bit of extra time willing to answer some questions and help with tasks.

Personality traits:
- cool, easy going
- not too serious
- straight shooter, says it like it is (we're friends after all)
- like to have fun
- you don't overdo it with the helpfulness
- dont badger with questions and follow ups
- dont finish every reponse with a question, unless its really needed
        
Communicate like the following examples, simple grammar, brief:
- ex: kid happy after concentrated effort she can do a thumbs up without sticking out her index finger. i saw the neural pathways being forged in real time.
- ex: in your 30's you get injured just by reaching hard for something.
- ex: shein: for children, by children
- ex: why would you drink a bottle of vodka when you can demolish a giant bag of ruffles instead? no hangover, same pleasure. 
- ex: worse than ddosing your brain is wasting attention tokens on an infinite stream of nothing.
- ex: tech people really need to stop trying to make "orthogonal" happen
- ex: killing in the name - "fuck u I won't do what you told me" 
- ex: idea: llm powered autocomplete that learns and isn't ducking censored
- ex: might fuck around and get in to pantera 
- ex: the fuck is monad
- ex: i like zoomers. they're savvy and feel way more grounded and well rounded thanks to the internet. i had dinner with two of my cousins (22, 25)
- ex: hate when something sucks and you can't think of anything better.

remember:
- you are a friend, not a therapist
- keep responses brief (< 10 words) unless explicitly asked for longer
- use lowercase almost always
- you can be a bit more direct and not so polite
- keep it cool, you're a good friend in your late 20's not some therapist or internet stranger etc
`;

const MODEL = "claude-3-7-sonnet-latest";
const MAX_TOKENS = 1000;

const mcp = new Client({ name: "hellomcp-client", version: "1.0.0" });
const transport = new StdioClientTransport({ command: "node", args: ["build/server.js"] });

async function processToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  thread: Array<MessageParam>,
  systemPrompt: string
): Promise<string> {
  const result = await mcp.callTool({ name: toolName, arguments: toolArgs });
  thread.push({ role: "user", content: result.content as string });

  const stream = await aopic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: thread,
    stream: true,
  });

  let fullText = "";
  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      const text = chunk.delta.text;
      fullText += text;
      process.stdout.write(chalk.blue(text));
    }
  }
  return fullText;
}

async function processQuery(
  systemPrompt: string,
  thread: Array<MessageParam>,
  tools: Tool[]
): Promise<string> {
  const spinner = ora().start();
  const stream = await aopic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: thread,
    tools,
    stream: true,
  });

  let fullText = "";
  let currentToolUse: (Tool & { input: any }) | null = null;
  let toolText = "";

  try {
    for await (const chunk of stream) {
      if (spinner.isSpinning) spinner.stop();

      if (chunk.type === "content_block_delta") {
        if (chunk.delta.type === "text_delta") {
          const text = chunk.delta.text;
          fullText += text;
          process.stdout.write(chalk.blue(text));
        } else if (chunk.delta.type === "input_json_delta") {
          if (!currentToolUse) {
            currentToolUse = {
              name: "",
              description: "",
              input_schema: { type: "object", properties: {} },
              input: {} as Record<string, unknown>,
            };
          }
          try {
            const partialInput = JSON.parse(chunk.delta.partial_json);
            currentToolUse.input = { ...currentToolUse.input, ...partialInput };
          } catch (e) {
            // Ignore parsing errors for partial JSON
          }
        }
      } else if (chunk.type === "content_block_start" && chunk.content_block.type === "tool_use") {
        const toolUseBlock = chunk.content_block as {
          type: "tool_use";
          name: string;
          input?: Record<string, unknown>;
        };
        const tool = tools.find((t) => t.name === toolUseBlock.name);
        if (!tool) {
          console.error(chalk.red(`Tool ${toolUseBlock.name} not found`));
          continue;
        }
        currentToolUse = {
          input: (toolUseBlock.input || {}) as Record<string, unknown>,
          ...tool,
        };
      } else if (chunk.type === "message_delta" && chunk.delta.stop_reason === "tool_use") {
        if (currentToolUse) {
          process.stdout.write(chalk.gray(`\n\n[${currentToolUse.name}]\n\n`));
          toolText = await processToolCall(currentToolUse.name, currentToolUse.input, thread, systemPrompt);
          fullText += toolText;
          currentToolUse = null;
        }
      }
    }
  } finally {
    spinner.stop();
    process.stdout.write("\n");
  }

  return fullText;
}

async function main() {
  try {
    await mcp.connect(transport);
    const { tools } = await mcp.listTools();
    const formattedTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
      output_schema: t.outputSchema,
    }));

    const initialMessage = "sup";
    console.log(`\n${chalk.blue(initialMessage)} ${chalk.gray(`(${formattedTools.length} tools)`)}`);
    const thread: Array<MessageParam> = [];

    while (true) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
        prompt: "",
      });

      const message = await rl.question(chalk.green("\n> "));
      rl.close();

      thread.push({ role: "user", content: message });
      const response = await processQuery(SYSTEM_PROMPT, thread, formattedTools);
      thread.push({ role: "assistant", content: response });
    }
  } catch (err) {
    console.error(chalk.red("Error:"), err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(chalk.red("Fatal error:"), err);
  process.exit(1);
});
