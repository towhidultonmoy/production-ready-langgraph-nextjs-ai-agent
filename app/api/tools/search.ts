import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { LinkupClient } from "linkup-sdk";

export const searchTool = new DynamicStructuredTool({
    name: "linkup_search",
    description: "Performs a deep web search to find real-time information, news, and answer questions about current events, companies, or people. Use this when you need facts that are not in your training data.",
    schema: z.object({
        query: z.string().describe("The detailed search query. Include keywords for best results."),
        depth: z.enum(["standard", "deep"]).optional().default("deep").describe("Search depth. defaulting to 'deep' for thorough research."),
    }),
    func: async ({ query, depth }) => {
        const apiKey = process.env.LINKUP_API_KEY;
        if (!apiKey) {
            throw new Error("LINKUP_API_KEY is not set in environment variables.");
        }

        const client = new LinkupClient({ apiKey });

        try {
            const response = await client.search({
                query: query,
                depth: depth || "deep",
                outputType: "searchResults",
            });

            const rawResults = (response as any).results || [];

            // 1. Filter and slice results first to ensure consistency
            const validResults = rawResults
                .filter((r: any) => r.name && r.url)
                .slice(0, 10);

            // 2. Format results for the LLM to read (same indices as validResults)
            const searchItems = validResults
                .map((r: any, idx: number) => `[${idx + 1}] Title: ${r.name}\nURL: ${r.url}\nSnippet: ${r.content}`)
                .join("\n\n---\n\n");

            // 3. Extract structured sources for the frontend
            const sources = validResults
                .map((r: any) => ({
                    title: r.name,
                    url: r.url
                }));

            if (!searchItems) {
                return "No relevant search results found.";
            }

            // Return a structured string that includes both the content and a hidden metadata block
            return JSON.stringify({
                content: `Create a comprehensive answer based on these search results. Cite your sources using [number] format, e.g., [1]. ONLY cite sources that are listed below. Do NOT use citation numbers that do not exist in the list. Only cite information that is actually found in the snippets.\n\n${searchItems}`,
                metadata: {
                    sources: sources
                }
            });
        } catch (error: any) {
            console.error("Linkup Search Error:", error);
            return `Error performing search: ${error?.message || "Unknown error"}`;
        }
    },
});
