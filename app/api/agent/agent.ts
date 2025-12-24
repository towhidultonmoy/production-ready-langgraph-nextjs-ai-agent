import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { searchTool } from "../tools/search";
import { supabase } from "../../lib/supabase";
import { SupabaseSaver } from "../../lib/supabase_saver";
import fs from "fs";
import path from "path";




// Cache system prompt
const promptPath = path.join(process.cwd(), "app", "prompts", "system.md");
let cachedSystemPrompt: string | null = null;

function getSystemPrompt() {
  if (!cachedSystemPrompt) {
    cachedSystemPrompt = fs.readFileSync(promptPath, "utf-8");
  }
  return cachedSystemPrompt.replace("{current_date}", new Date().toDateString());
}

export async function basicAgent(options: {
  apiKey?: string;
  messages: Array<{ role: string; content: string }>;
  threadId?: string;
}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  const messages = options.messages;

  // --- 1. CONFIG: Input Guardrails ---
  // Simple pattern matching for common injection/unsafe attempts
  const unsafePatterns = [
    /ignore previous instructions/i,
    /delete all files/i,
    /show me your secret keys/i,
    /system prompt override/i
  ];

  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage.role === "user") {
    const isUnsafe = unsafePatterns.some(pattern => pattern.test(lastUserMessage.content));
    if (isUnsafe) {
      console.warn(`[Guardrail] Blocked unsafe input from thread ${options.threadId}`);
      // Return a safe, static response without calling the LLM
      throw new Error("I cannot assist with that request due to security guidelines.");
    }
  }
  // -----------------------------------

  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  const model = new ChatOpenAI({
    model: "gpt-4o-mini", // or "gpt-4o", "gpt-4-turbo"
    apiKey: apiKey,
    temperature: 0,
    streaming: true,
  });

  console.log(`[Agent] Initializing with threadId: ${options.threadId || "default"}. Tools recognized: ${[searchTool].length}`);

  const agent = createReactAgent({
    llm: model,
    tools: [searchTool],
    checkpointSaver: new SupabaseSaver(supabase),
    messageModifier: getSystemPrompt(),
  });

  return agent.streamEvents(
    {
      messages: options.messages,
    },
    {
      configurable: {
        thread_id: options.threadId || "default",
      },
      version: "v2",
    }
  );
}