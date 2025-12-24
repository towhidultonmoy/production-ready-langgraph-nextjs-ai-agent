# Ally
### The Production-Ready LangGraph Agent for Next.js

A production-ready AI agent template built with **Next.js**, **LangGraph**, **Linkup**, and **Supabase**. Features real-time streaming responses, deep observability with **LangSmith**, web search capabilities, persistent conversation history, and a modern generative UI.

## 🚀 Features

-   **Agentic Intelligence**: Powered by LangGraph for stateful, multi-step reasoning and tool execution
-   **Real-time Streaming**: Server-Sent Events (SSE) deliver token-by-token responses with status updates ("Thinking", "Searching", "Analyzing")
-   **Web Search**: Integrated Linkup tool for accurate, citation-backed web searches
-   **Persistent Memory**: Supabase (PostgreSQL) stores conversation history and checkpoints for seamless session resumption
-   **Modern UI**: Responsive sidebar with conversation history, Markdown rendering with syntax highlighting, optimistic UI updates
-   **Type-Safe**: Built with TypeScript and Zod validations

## 🛠️ Tech Stack

-   **Frontend**: Next.js 15, React 18, Tailwind CSS
-   **AI & Agents**: LangChain.js, LangGraph, OpenAI GPT-4
-   **Backend & Database**: Supabase (PostgreSQL), Next.js API Routes
-   **Tools**: Linkup Search API
-   **Package Manager**: pnpm

## ⚡ Getting Started

### Prerequisites

-   Node.js 18+
-   pnpm (recommended) or npm/yarn
-   A Supabase project
-   API Keys for OpenAI and Linkup

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/ai-agent-chatbot.git
    cd ai-agent-chatbot
    ```

2.  **Install dependencies**
    ```bash
    pnpm install
    ```

3.  **Environment Setup**
    
    Create a `.env.local` file in the root directory:

    ```env
    # OpenAI
    OPENAI_API_KEY=sk-...

    # Supabase
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

    # Linkup (Web Search)
    LINKUP_API_KEY=your-linkup-key
    ```

4.  **Database Setup**
    
    In your Supabase project, go to the SQL Editor and run the following SQL to create the required tables:

    ```sql
    -- Sessions table to track conversations
    CREATE TABLE IF NOT EXISTS sessions (
        thread_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Checkpoints table for LangGraph state persistence
    CREATE TABLE IF NOT EXISTS checkpoints (
        thread_id TEXT NOT NULL,
        checkpoint JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (thread_id) REFERENCES sessions(thread_id) ON DELETE CASCADE
    );

    -- Index for faster queries
    CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id ON checkpoints(thread_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
    ```

5.  **Run the development server**
    ```bash
    pnpm dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Customization

### Changing the AI Model

The model is configured in `app/api/agent/agent.ts`. To change models:

1. Open `app/api/agent/agent.ts`
2. Modify the `ChatOpenAI` configuration:

```typescript
const model = new ChatOpenAI({
    model: "gpt-4o",  // Change to: "gpt-4o-mini", "gpt-4-turbo", etc.
    apiKey: apiKey,
    temperature: 0,   // Adjust creativity (0-2)
    streaming: true,
});
```

**Using Other Providers:**

To use Anthropic Claude, Google Gemini, or other providers:

```typescript
// For Anthropic Claude
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
    model: "claude-3-5-sonnet-20241022",
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
});

// For Google Gemini
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash-exp",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0,
});
```

Don't forget to install the required package and add the API key to `.env.local`.

### Adding New Tools

Tools are managed in `app/api/tools/`. To add a new tool:

1. **Create the tool** (e.g., `app/api/tools/calculator.ts`):

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const calculatorTool = new DynamicStructuredTool({
    name: "calculator",
    description: "Perform mathematical calculations",
    schema: z.object({
        expression: z.string().describe("Mathematical expression to evaluate"),
    }),
    func: async ({ expression }) => {
        try {
            // Your tool logic here
            const result = eval(expression); // Use a safe math library in production
            return `Result: ${result}`;
        } catch (error) {
            return `Error: ${error.message}`;
        }
    },
});
```

2. **Register the tool** in `app/api/agent/agent.ts`:

```typescript
import { searchTool } from "../tools/search";
import { calculatorTool } from "../tools/calculator";

const agent = createReactAgent({
    llm: model,
    tools: [searchTool, calculatorTool], // Add your new tool here
    checkpointSaver: new SupabaseSaver(supabase),
    messageModifier: getSystemPrompt(),
});
```

3. **Update the system prompt** (optional) to inform the agent about the new tool's capabilities.

That's it! The agent will automatically use your new tool when appropriate.

### Observability (LangSmith)

To trace your agent's reasoning steps, tool calls, and latency:

1.  Sign up for [LangSmith](https://smith.langchain.com/).
2.  Get your API Key.
3.  Add the following to your `.env.local`:

```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
LANGCHAIN_API_KEY="your-langchain-api-key"
LANGCHAIN_PROJECT="ai-agent-chatbot"
```

Restart your server, and you will instantly see traces in your LangSmith dashboard!

## 🏗️ Architecture

### Agentic Loop (LangGraph)
The application uses a graph-based architecture instead of a linear chain, allowing the AI to:
-   Plan → Act (Call Tool) → Observe → Plan → Response
-   Self-correct if a tool fails or needs more information

### Custom Streaming Protocol
The `/api/agent` route streams distinct events:
-   `status_update`: Real-time states like "Thinking", "Searching", or "Analyzing"
-   `on_chat_model_stream`: Actual text tokens

### State Persistence
Supabase stores the entire LangGraph execution state (Checkpoints), preserving context across page reloads for long-running conversations.

### Optimistic UI
React state updates immediately reflect user actions (e.g., "Thinking" state), masking network latency for a native app feel.

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   ├── agent/          # Main chat endpoint (route.ts) & agent config (agent.ts)
│   │   ├── sessions/       # Session management
│   │   ├── history/        # Conversation history
│   │   └── tools/          # Tool definitions (e.g., search.ts)
│   ├── components/         # React components
│   └── lib/               # Supabase client, utilities
├── public/                # Static assets
└── .env.local            # Environment variables (not committed)
```

## 🤝 Contributing

Contributions are welcome! Please fork the repository and open a pull request.

## 📄 License

Distributed under the MIT License.

## 🙏 Acknowledgments

-   Built with [LangChain](https://js.langchain.com/)
-   Powered by [OpenAI](https://openai.com/)
-   Database by [Supabase](https://supabase.com/)
-   Search by [Linkup](https://linkup.so/)
