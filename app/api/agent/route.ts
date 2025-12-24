import { NextRequest, NextResponse } from "next/server";
import { basicAgent } from "./agent";
import { supabase } from "../../lib/supabase";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, threadId, apiKey: clientApiKey } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // --- Session Management (Parallel) ---
    // Start session operations in background to not block the first token
    // We will await this promise at the end of the stream to ensure it completes.
    const sessionPromise = (async () => {
      if (threadId) {
        try {
          const { data: existingSession } = await supabase
            .from("sessions")
            .select("title")
            .eq("thread_id", threadId)
            .maybeSingle();

          if (!existingSession) {
            // First message of a new thread - use it as title
            const firstUserMessage = messages.find((m: any) => m.role === "user")?.content || "New Conversation";
            const title = firstUserMessage.length > 50
              ? firstUserMessage.substring(0, 47) + "..."
              : firstUserMessage;

            await supabase.from("sessions").insert({
              thread_id: threadId,
              title: title,
              updated_at: new Date().toISOString()
            });
          } else {
            // Just update the timestamp for existing sessions
            await supabase.from("sessions")
              .update({ updated_at: new Date().toISOString() })
              .eq("thread_id", threadId);
          }
        } catch (sessionError) {
          console.warn("[Session Management] Non-blocking error:", sessionError);
        }
      }
    })();
    // --------------------------

    const agentStream = await basicAgent({
      messages,
      threadId,
      apiKey: clientApiKey,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let isFirstChunk = true;
        let hasEmittedThinking = false;

        try {
          // Emit initial "thinking" status
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              event: "status_update",
              data: { status: "thinking" }
            })}\n\n`)
          );

          for await (const event of agentStream) {
            // Handle tool start events
            if (event.event === "on_tool_start") {
              const toolName = event.name;
              console.log(`[Stream] Tool started: ${toolName}`);

              if (toolName === "linkup_search") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    event: "status_update",
                    data: { status: "searching", toolName }
                  })}\n\n`)
                );
              }
            }

            // Handle tool end events
            if (event.event === "on_tool_end") {
              const toolName = event.name;
              const output = event.data?.output;
              console.log(`[Stream] Tool ended: ${toolName}`);

              if (toolName === "linkup_search") {
                let status = "analyzing";
                try {
                  // Debug logging to a file
                  fs.appendFileSync("debug_agent.log", `[Tool End] ${toolName} output: ${JSON.stringify(output).substring(0, 100)}...\n`);

                  // Handle LangChain's ToolMessage object if present
                  let toolOutput = output;
                  if (output && typeof output === 'object' && output.content) {
                    toolOutput = output.content;
                  }

                  // Try to parse the output if it's our structured JSON string or object
                  const parsed = typeof toolOutput === 'string' ? JSON.parse(toolOutput) : toolOutput;
                  if (parsed && parsed.metadata?.sources) {
                    fs.appendFileSync("debug_agent.log", `[Stream] Found sources: ${parsed.metadata.sources.length}\n`);
                    console.log(`[Stream] Emitting source_data for ${toolName}`);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        event: "source_data",
                        data: { sources: parsed.metadata.sources }
                      })}\n\n`)
                    );
                  }
                } catch (e) {
                  fs.appendFileSync("debug_agent.log", `[Error] Failed to parse: ${e}\n`);
                  console.warn(`[Stream] Failed to parse tool output for ${toolName}:`, e);
                }

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    event: "status_update",
                    data: { status }
                  })}\n\n`)
                );
              }
            }

            // Handle chat model streaming
            if (event.event === "on_chat_model_stream") {
              const content = event.data?.chunk?.content;
              if (content && typeof content === "string") {
                // Emit "generating" status on first chunk
                if (isFirstChunk) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({
                      event: "status_update",
                      data: { status: "generating" }
                    })}\n\n`)
                  );
                  isFirstChunk = false;
                }

                const data = {
                  event: "on_chat_model_stream",
                  data: {
                    chunk: {
                      content: content,
                    },
                  },
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );
              }
            }
          }

          // Clear status when done
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              event: "status_update",
              data: { status: null }
            })}\n\n`)
          );

          // Wait for session management to finish (in case it's still running)
          await sessionPromise;
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in agent route:", error);

    // Determine strict error type for response
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isAuthError = errorMessage.includes("API key");

    // Production Safety: Don't leak internal stack traces for 500 errors
    const clientMessage = isAuthError
      ? errorMessage // Safe to show auth errors (usually configuration)
      : "Our AI service is currently experiencing issues. Please try again later.";

    return NextResponse.json(
      { error: clientMessage },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
