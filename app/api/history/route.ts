import { supabase } from "@/app/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
        return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    console.log(`[History API] Fetching history for thread: ${threadId}`);

    try {
        const { data, error } = await supabase
            .from("checkpoints")
            .select("checkpoint")
            .eq("thread_id", threadId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("[History API] Supabase error:", error);
            throw error;
        }

        if (!data || !data.checkpoint) {
            return NextResponse.json({ messages: [] });
        }

        const checkpoint = data.checkpoint as any;

        // LangGraph often nests state in channel_values
        const state = checkpoint?.channel_values || {};

        // Try to find the message list. Usually it's 'messages', but let's be flexible.
        let rawMessages = state.messages;

        if (!rawMessages || !Array.isArray(rawMessages)) {
            // Fallback: search for any array that looks like messages
            const arrays = Object.values(state).filter(v => Array.isArray(v));
            rawMessages = arrays.find((a: any) =>
                a.length > 0 && (a[0].content !== undefined || a[0].text !== undefined || a[0].type !== undefined || a[0].kwargs?.content !== undefined)
            ) || [];
        }

        console.log(`[History API] Found ${rawMessages.length} raw messages for thread ${threadId}`);

        // Map LangGraph messages to our frontend format
        let accumulatedSources: any[] = [];
        const messages = (rawMessages as any[]).map((m: any, index: number) => {
            let role = "assistant";

            // Handle LangChain serialized format where type info is in the 'id' array
            const idArray = Array.isArray(m.id) ? m.id : [];
            const lastIdPart = idArray[idArray.length - 1] || "";

            // Also check traditional type/role fields
            const type = (m.type || m.role || "").toLowerCase();
            const idStr = JSON.stringify(m.id || "");
            const lc_namespace = (m.lc_namespace || []).join(".");
            const roleHint = (m.role || m.kwargs?.role || "").toLowerCase();

            if (
                type === "human" ||
                roleHint === "user" ||
                idStr.includes("HumanMessage") ||
                lc_namespace.includes("HumanMessage") ||
                lastIdPart === "HumanMessage"
            ) {
                role = "user";
            } else if (
                type === "ai" ||
                roleHint === "assistant" ||
                idStr.includes("AIMessage") ||
                lc_namespace.includes("AIMessage") ||
                lastIdPart === "AIMessage" ||
                lastIdPart === "AIMessageChunk"
            ) {
                role = "assistant";
            } else if (
                type === "system" ||
                idStr.includes("SystemMessage") ||
                lc_namespace.includes("SystemMessage") ||
                lastIdPart === "SystemMessage"
            ) {
                role = "system";
            } else if (
                type === "tool" ||
                idStr.includes("ToolMessage") ||
                lc_namespace.includes("ToolMessage") ||
                lastIdPart === "ToolMessage"
            ) {
                role = "tool";
            }

            // Defensive content extraction
            let content = m.kwargs?.content || m.content || m.text || "";

            if (Array.isArray(content)) {
                content = content
                    .map((c: any) => {
                        if (typeof c === "string") return c;
                        return c.text || c.content || (c.type === "text" ? c.text : "");
                    })
                    .filter(Boolean)
                    .join("\n");
            } else if (typeof content !== "string") {
                content = content ? JSON.stringify(content) : "";
            }

            // If it's a tool message, accumulate sources for the NEXT AI message
            if (role === "tool") {
                try {
                    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                    const metadata = parsed.metadata || (typeof parsed === 'object' ? parsed.metadata : null);
                    if (metadata?.sources) {
                        const newSources = metadata.sources;
                        const existingUrls = new Set(accumulatedSources.map(s => s.url));
                        newSources.forEach((s: any) => {
                            if (s && s.url && !existingUrls.has(s.url)) {
                                accumulatedSources.push(s);
                                existingUrls.add(s.url);
                            }
                        });
                    }
                } catch (e) {
                    // Not JSON or doesn't have sources, that's fine
                }
            }

            // --- Process Content and Sources for Assistant ---
            let finalContent = content;
            let finalSources: any[] = [];

            if (role === "assistant") {
                finalSources = [...accumulatedSources];
                accumulatedSources = []; // Consume sources

                if (finalContent.includes('[') && finalSources.length > 0) {
                    // 1. Find all numerical citations like [1], [2], etc.
                    const citationRegex = /\[\s*(\d+)\s*\]/g;
                    const citations = Array.from(finalContent.matchAll(citationRegex));
                    const usedIndices = Array.from(new Set(citations.map((c: any) => parseInt(c[1]) - 1)))
                        .filter(idx => idx >= 0 && idx < finalSources.length)
                        .sort((a, b) => a - b);

                    if (usedIndices.length > 0) {
                        const newSourcesList: any[] = [];
                        const indexMap: Record<number, number> = {};

                        usedIndices.forEach((oldIdx, newIdx) => {
                            newSourcesList.push(finalSources[oldIdx]);
                            indexMap[oldIdx + 1] = newIdx + 1;
                        });

                        // Replace citations with new sequential numbers
                        finalContent = finalContent.replace(citationRegex, (match: string, p1: string) => {
                            const oldNum = parseInt(p1);
                            return indexMap[oldNum] ? `[${indexMap[oldNum]}]` : match;
                        });

                        finalSources = newSourcesList;
                    }
                }
            }

            // Generate a stable ID
            const messageId = m.kwargs?.id || m.id?.toString() || `msg-${index}-${Date.now()}`;

            return {
                role,
                content: finalContent,
                id: typeof messageId === "string" ? messageId : JSON.stringify(messageId),
                sources: finalSources.length > 0 ? finalSources : undefined,
            };
        }).filter((m: any) => m.role !== "system" && m.role !== "tool" && m.content);

        console.log(`[History API] Returning ${messages.length} filtered messages for thread ${threadId}`);

        return NextResponse.json({ messages });
    } catch (error: any) {
        console.error("[History API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
