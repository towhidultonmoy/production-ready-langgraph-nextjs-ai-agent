import { AIMessage } from "@langchain/core/messages";

/**
 * Type guard function to check if a message is an AI message.
 *
 * This function handles multiple message formats that can come from the LangChain SDK:
 * 1. SDK serialized format: messages with `type: "ai"` property
 * 2. LangChain Core format: instances of the `AIMessage` class
 *
 * The function first checks for the SDK format (type property), then falls back to
 * checking if it's an instance of the `AIMessage` class. This dual-check approach
 * ensures compatibility with both serialized and live message objects.
 *
 * @param message - The message object to check (can be any type)
 * @returns `true` if the message is an AI message, `false` otherwise
 *
 * @example
 * ```tsx
 * const message = { type: "ai", content: "Hello!" };
 * if (isAIMessage(message)) {
 *   // TypeScript now knows message is an AI message
 *   console.log(message.content);
 * }
 * ```
 */
export function isAIMessage(message: unknown): boolean {
  // Early return for falsy values or non-objects
  if (!message || typeof message !== "object") return false;

  const msg = message as Record<string, unknown>;

  // Check SDK serialized format first (most common in streaming scenarios)
  if (msg.type === "ai") return true;

  // Fallback to LangChain Core instance check
  return AIMessage.isInstance(message);
}

/**
 * Type guard function to check if a message is a tool message.
 *
 * Tool messages are returned by tools/functions that the AI agent calls during execution.
 * This function checks for the `type: "tool"` property which is the standard format
 * for tool messages in the LangChain SDK.
 *
 * @param message - The message object to check (can be any type)
 * @returns `true` if the message is a tool message, `false` otherwise
 *
 * @example
 * ```tsx
 * const message = { type: "tool", content: "Result", tool_call_id: "call_123" };
 * if (isToolMessage(message)) {
 *   // Handle tool message result
 *   console.log(message.content);
 * }
 * ```
 */
export function isToolMessage(message: unknown): boolean {
  // Early return for falsy values or non-objects
  if (!message || typeof message !== "object") return false;

  const msg = message as Record<string, unknown>;

  // Tool messages are identified by their type property
  return msg.type === "tool";
}

/**
 * Type guard function to check if a message is a human message.
 *
 * Human messages represent user input in the chat conversation. This function checks
 * for the `type: "human"` property which is the standard format for human messages
 * in the LangChain SDK.
 *
 * @param message - The message object to check (can be any type)
 * @returns `true` if the message is a human message, `false` otherwise
 *
 * @example
 * ```tsx
 * const message = { type: "human", content: "What's the weather?" };
 * if (isHumanMessage(message)) {
 *   // Handle user message
 *   console.log(message.content);
 * }
 * ```
 */
export function isHumanMessage(message: unknown): boolean {
  // Early return for falsy values or non-objects
  if (!message || typeof message !== "object") return false;

  const msg = message as Record<string, unknown>;

  // Human messages are identified by their type property
  return msg.type === "human";
}

/**
 * Extracts text content from message content that can be in various formats.
 *
 * LangChain messages can have content in multiple formats:
 * - **String**: Simple string content (e.g., `"Hello, world!"`)
 * - **Array of strings**: Multiple text segments (e.g., `["Hello", "world"]`)
 * - **Array of objects**: Structured content with text properties (e.g., `[{text: "Hello"}]`)
 * - **Object with text property**: Single structured object (e.g., `{text: "Hello"}`)
 * - **Other types**: Fallback to string conversion
 *
 * This function normalizes all these formats into a single string, making it safe
 * to display message content in the UI regardless of the format it arrives in.
 *
 * @param content - The message content in any supported format
 * @returns A string representation of the content, with arrays joined together
 *
 * @example
 * ```tsx
 * // String content
 * extractTextContent("Hello") // "Hello"
 *
 * // Array of strings
 * extractTextContent(["Hello", "world"]) // "Helloworld"
 *
 * // Array of objects with text property
 * extractTextContent([{text: "Hello"}, {text: "world"}]) // "Helloworld"
 *
 * // Object with text property
 * extractTextContent({text: "Hello"}) // "Hello"
 *
 * // Other types (fallback)
 * extractTextContent(123) // "123"
 * ```
 */
export function extractTextContent(content: unknown): string {
  // Handle simple string content (most common case)
  if (typeof content === "string") {
    return content;
  }

  // Handle array content (can be array of strings or objects)
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        // Array item is a string
        if (typeof item === "string") {
          return item;
        }
        // Array item is an object with text property
        if (item && typeof item === "object" && "text" in item) {
          return String(item.text);
        }
        // Skip invalid array items
        return "";
      })
      .join("");
  }

  // Handle object with text property
  if (content && typeof content === "object" && "text" in content) {
    return String(content.text);
  }

  // Fallback: convert any other type to string
  return String(content || "");
}
