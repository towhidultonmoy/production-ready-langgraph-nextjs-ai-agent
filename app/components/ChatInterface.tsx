"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ChatInput from "./ChatInput";
import { CodeBlock } from "./CodeBlock";
import Sidebar from "./Sidebar";
import StatusIndicator, { AgentStatus } from "./StatusIndicator";

interface Source {
  title: string;
  url: string;
}

interface Message {
  role: string;
  content: string;
  id: string;
  sources?: Source[];
}

export default function ChatInterface({ apiKey: initialApiKey }: { apiKey?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [streamingThreadId, setStreamingThreadId] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [currentThreadId, setCurrentThreadId] = useState<string>("");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>(null);
  const [currentSources, setCurrentSources] = useState<Source[]>([]);

  // Sidebar State: Default to true on desktop (will be adjusted by effect or default)
  // We initialize as false to match mobile-first logic, but on mount verify width.
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false); // To prevent hydration mismatch

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeThreadRef = useRef<string>("");
  const sendingThreadIdRef = useRef<string | null>(null);
  const sourcesRef = useRef<Source[]>([]);
  const streamingContentEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);

  // Initialize sidebar state based on screen size
  useEffect(() => {
    const checkScreen = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
      setIsDataLoaded(true);
    };

    checkScreen();
    // Optional: Auto-collapse on resize? User didn't ask, but good practice.
    // window.addEventListener('resize', checkScreen);
    // return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Keep activeThreadRef synced with state for use in closures
  useEffect(() => {
    activeThreadRef.current = currentThreadId;
  }, [currentThreadId]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Consider "at bottom" if within 50px of the bottom
    const isBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsUserAtBottom(isBottom);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    // If user is not at bottom and we are just streaming, don't force scroll
    // But if it's a new message (behavior="smooth" usually implies new message logic here), we might force it
    // For now, strict 'stick to bottom' logic: only scroll if user was already at bottom
    if (!isUserAtBottom) return;

    if (streamingMessage && streamingContentEndRef.current) {
      streamingContentEndRef.current.scrollIntoView({ behavior });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  };

  // Auto-scroll when messages change (new message sent/received)
  useEffect(() => {
    // For new messages, we generally want to force scroll or at least try
    // But to respect "reading history", let's check:
    // If it's the user's own message, we MUST scroll.
    // If it's an incoming message...

    // Simplification: logic inside scrollToBottom handles the "stickiness"
    // We just trigger it.
    // Note: When sending a message, we should force isUserAtBottom to true manually
    // This is handled in handleSendMessage
    scrollToBottom("smooth");
  }, [messages]);

  // Auto-scroll during streaming (INSTANT to avoid vibration)
  useEffect(() => {
    if (streamingMessage) {
      scrollToBottom("auto");
    }
  }, [streamingMessage]);

  // Load history when session changes
  useEffect(() => {
    if (currentThreadId) {
      if (sendingThreadIdRef.current !== currentThreadId) {
        loadHistory(currentThreadId);
      }
    } else {
      setMessages([]);
    }
  }, [currentThreadId]);

  const loadHistory = async (threadId: string) => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`/api/history?threadId=${threadId}`);
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      if (activeThreadRef.current === threadId) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("History load error:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    const threadIdToUse = currentThreadId || `sid-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11)}`;
    if (!currentThreadId) setCurrentThreadId(threadIdToUse);

    const userMessage: Message = {
      role: "user",
      content,
      id: Date.now().toString(),
    };

    setIsUserAtBottom(true); // Force scroll to bottom when sending


    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setStreamingThreadId(threadIdToUse);
    sendingThreadIdRef.current = threadIdToUse;
    setStreamingMessage("");
    setCurrentSources([]);
    sourcesRef.current = [];
    setAgentStatus("thinking");

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: initialApiKey,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          threadId: threadIdToUse,
        }),
      });

      if (!response.ok) {
        let serverError = "";
        try {
          const errorData = await response.json();
          serverError = errorData.error;
        } catch { }

        if (response.status >= 500 || !serverError) {
          throw new Error("Unable to connect to AI service. Please try again later.");
        }
        throw new Error(serverError);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the last partial line in the buffer

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

            try {
              const data = JSON.parse(trimmedLine.slice(6));
              if (data.event === "status_update") {
                if (activeThreadRef.current === threadIdToUse) {
                  setAgentStatus(data.data?.status || null);
                }
              }
              if (data.event === "on_chat_model_stream" && data.data?.chunk?.content) {
                assistantMessage += data.data.chunk.content;
                if (activeThreadRef.current === threadIdToUse) {
                  setStreamingMessage(assistantMessage);
                }
              }
              if (data.event === "source_data" && data.data?.sources) {
                if (activeThreadRef.current === threadIdToUse) {
                  console.log("[Chat] Received sources:", data.data.sources);
                  const newSources = data.data.sources;
                  const existingUrls = new Set(sourcesRef.current.map(s => s.url));
                  const filteredNew = newSources.filter((s: Source) => s && s.url && !existingUrls.has(s.url));
                  sourcesRef.current = [...sourcesRef.current, ...filteredNew];
                  setCurrentSources([...sourcesRef.current]);
                }
              }
            } catch (e) {
              console.warn("[Chat] Error parsing stream chunk:", e, trimmedLine);
            }
          }
        }
      }

      // Process any remaining data in the buffer
      if (buffer.trim().startsWith("data: ")) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (data.event === "source_data" && data.data?.sources) {
            const newSources = data.data.sources;
            const existingUrls = new Set(sourcesRef.current.map(s => s.url));
            const filteredNew = newSources.filter((s: Source) => s && s.url && !existingUrls.has(s.url));
            sourcesRef.current = [...sourcesRef.current, ...filteredNew];
            setCurrentSources([...sourcesRef.current]);
          }
        } catch (e) { }
      }

      // --- Process Content and Sources ---
      let finalContent = assistantMessage;
      let finalSources = [...sourcesRef.current];

      if (finalContent.includes('[') && finalSources.length > 0) {
        // Robust regex for [1], [ 1 ], etc.
        const citationRegex = /\[\s*(\d+)\s*\]/g;
        const citations = Array.from(finalContent.matchAll(citationRegex));
        const usedIndices = Array.from(new Set(citations.map(c => parseInt(c[1]) - 1)))
          .filter(idx => idx >= 0 && idx < finalSources.length)
          .sort((a, b) => a - b);

        if (usedIndices.length > 0) {
          const newSourcesList: Source[] = [];
          const indexMap: Record<number, number> = {};

          usedIndices.forEach((oldIdx, newIdx) => {
            newSourcesList.push(finalSources[oldIdx]);
            indexMap[oldIdx + 1] = newIdx + 1;
          });

          // Replace citations in text with new sequential numbers
          finalContent = finalContent.replace(citationRegex, (match, p1) => {
            const oldNum = parseInt(p1);
            return indexMap[oldNum] ? `[${indexMap[oldNum]}]` : match;
          });

          finalSources = newSourcesList;
        }
      }

      if (finalContent) {
        const assistantMsg: Message = {
          role: "assistant",
          content: finalContent,
          id: Date.now().toString(),
          sources: finalSources.length > 0 ? finalSources : undefined,
        };
        console.log("[Chat] Creating assistant message with sources:", assistantMsg.sources);
        if (activeThreadRef.current === threadIdToUse) {
          setMessages((prev) => {
            const newMessages = [...prev, assistantMsg];
            console.log("[Chat] Updated messages array, last message sources:", newMessages[newMessages.length - 1].sources);
            return newMessages;
          });
        }
      }
      if (activeThreadRef.current === threadIdToUse) {
        setStreamingMessage("");
        setCurrentSources([]);
        sourcesRef.current = [];
        setAgentStatus(null);
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMsg: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please check your configuration and try again.`,
        id: (Date.now() + 1).toString(),
      };
      if (activeThreadRef.current === threadIdToUse) {
        setMessages((prev) => [...prev, errorMsg]);
        setAgentStatus(null);
      }
    } finally {
      setStreamingThreadId((curr) => curr === threadIdToUse ? null : curr);
      sendingThreadIdRef.current = null;
    }
  };

  const handleNewChat = () => {
    setCurrentThreadId("");
    setMessages([]);
    setStreamingMessage("");
    setAgentStatus(null);
    if (window.innerWidth < 768) setIsSidebarOpen(false); // Close sidebar on mobile
  };

  const handleSelectSession = (threadId: string) => {
    setCurrentThreadId(threadId);
    setStreamingMessage("");
    setAgentStatus(null);
    if (window.innerWidth < 768) setIsSidebarOpen(false); // Close sidebar on mobile
  };

  const handleDeleteSession = async (threadId: string) => {
    if (confirm("Are you sure you want to delete this conversation?")) {
      try {
        const res = await fetch(`/api/sessions?threadId=${threadId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        if (currentThreadId === threadId) {
          handleNewChat();
        }
      } catch (error) {
        console.error("Delete error:", error);
        alert("Failed to delete session");
      }
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-black text-white">
      {/* Sidebar */}
      <Sidebar
        currentThreadId={currentThreadId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0 w-full h-full bg-zinc-950 transition-all duration-300">
        {/* Header */}
        <div className="p-3 md:p-6 border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center space-x-3 md:space-x-4">
            {/* Sidebar Toggle Button (Mobile & Desktop) */}
            <button
              onClick={toggleSidebar}
              className="p-2 -ml-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
              title="Toggle Sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]" style={{ background: 'linear-gradient(135deg, #222 0%, #000 100%)', border: '1px solid #333' }}>
              <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">Ally</h1>
              <p className="hidden md:block text-xs text-zinc-500 font-medium">
                Your AI Agent
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {messages.length > 0 && (
              <button
                onClick={handleNewChat}
                className="flex items-center space-x-2 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-semibold text-white hover:bg-zinc-900 rounded-lg transition-smooth border border-zinc-800 hover:border-zinc-700 hover-lift"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden md:inline">New</span>
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6 md:space-y-8 custom-scrollbar flex flex-col bg-zinc-950"
        >
          {!isDataLoaded ? (
            <div className="flex-1 flex items-center justify-center"></div> // hydration spacer
          ) : isHistoryLoading && messages.length === 0 && !streamingMessage ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-fade-in">
              <div className="w-10 h-10 border-2 border-zinc-800 border-t-white rounded-full animate-spin"></div>
              <p className="text-zinc-600 font-medium animate-pulse text-sm">Loading...</p>
            </div>
          ) : messages.length === 0 && !streamingMessage && !currentThreadId ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 md:py-20 animate-fade-in-up">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl flex items-center justify-center mb-6 md:mb-8 animate-float bg-gradient-to-br from-zinc-800/20 to-black border border-zinc-800 shadow-2xl shadow-black">
                <svg className="w-10 h-10 md:w-12 md:h-12 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2 md:mb-4 tracking-tight">
                Hello, I'm Ally.
              </h2>
              <p className="text-zinc-400 text-sm md:text-base max-w-md mx-auto mb-8 px-4">
                What would you like to achieve today?
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-2xl w-full px-2 md:px-4 mt-6 md:mt-8">
                {[
                  "Write a Python script to parse CSV",
                  "Explain quantum computing simply",
                  "Debug a React useEffect hook",
                  "Plan a marketing campaign"
                ].map((text, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(text)}
                    className="p-4 bg-[#09090b] border border-zinc-800 rounded-lg hover:border-zinc-600 hover:bg-zinc-900 transition-smooth text-left text-sm text-zinc-400 hover:text-white font-medium group hover-lift"
                  >
                    <span className="group-hover:translate-x-1 transition-transform inline-block">{text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                >
                  <div className={`flex items-start gap-3 md:gap-12 max-w-[95%] md:max-w-[85%] min-w-0 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                    {/* Avatars */}
                    <div className={`hidden md:flex w-8 h-8 rounded-lg items-center justify-center flex-shrink-0 border ${message.role === "user"
                      ? "bg-white text-black border-white"
                      : "bg-black border-zinc-800 text-white"
                      }`}>
                      {message.role === "user" ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      )}
                    </div>
                    {/* Message Bubble */}
                    <div className={`px-4 py-3 rounded-2xl transition-smooth min-w-0 ${message.role === "user"
                      ? "bg-zinc-800 text-white shadow-lg border border-zinc-700/50"
                      : "bg-transparent text-zinc-100"
                      }`}>

                      {/* Sources Section - MOVED TO TOP */}
                      {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                        <div className="mb-4 pb-4 border-b border-zinc-900">
                          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            Sources
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                id={`source-${idx + 1}-${message.id}`}
                                className="group/source flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900/50 border border-zinc-800/50 rounded-lg hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200"
                              >
                                <span className="flex-shrink-0 w-4 h-4 rounded bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-500 group-hover/source:bg-white group-hover/source:text-black transition-colors">
                                  {idx + 1}
                                </span>
                                <span className="text-[11px] text-zinc-400 group-hover/source:text-zinc-200 truncate max-w-[120px] md:max-w-[180px]">
                                  {source.title}
                                </span>
                                <svg className="w-2.5 h-2.5 text-zinc-700 group-hover/source:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="prose prose-sm max-w-none prose-invert leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code: CodeBlock,
                            a: ({ href, children }) => {
                              const safeHref = href || '';
                              const isCitation = safeHref.startsWith('source-');
                              if (isCitation) {
                                const index = parseInt(safeHref.split('-')[1]) - 1;
                                const sourcesToUse = message.sources || [];
                                const source = sourcesToUse[index];
                                return (
                                  <a
                                    href={source?.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold bg-zinc-800 text-zinc-500 rounded-sm hover:bg-white hover:text-black transition-all duration-200 mx-0.5 -translate-y-1 citation-link no-underline"
                                    title={source?.title || `Source ${index + 1}`}
                                  >
                                    {children}
                                  </a>
                                );
                              }
                              return (
                                <a href={safeHref || '#'} target="_blank" rel="noopener noreferrer" className="text-zinc-400 underline decoration-zinc-800 hover:text-white hover:decoration-white transition-colors">
                                  {children}
                                </a>
                              );
                            }
                          }}
                        >
                          {message.role === "assistant" && message.content.includes('[')
                            ? message.content.replace(/\[\s*(\d+)\s*\]/g, '[$1](source-$1)')
                            : message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Status Indicator & Streaming Response */}
              {(agentStatus || streamingMessage || currentSources.length > 0) && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-3 md:space-x-4 max-w-[95%] md:max-w-[85%]">
                    <div className="w-8 h-8 rounded-lg bg-black border border-zinc-800 flex items-center justify-center flex-shrink-0">
                      {(streamingMessage || agentStatus === "generating") ? (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-zinc-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      )}
                    </div>
                    <div className="text-zinc-100 min-w-[50px] px-4 py-2">
                      {agentStatus && (
                        <div className="mb-2">
                          <StatusIndicator status={agentStatus} />
                        </div>
                      )}

                      {/* Sources Section (shown as soon as they are found) */}
                      {currentSources.length > 0 && (
                        <div className="mb-4 pb-4 border-b border-zinc-900">
                          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            Sources found
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {currentSources.map((source, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900/30 border border-zinc-800/30 rounded-lg"
                              >
                                <span className="flex-shrink-0 w-4 h-4 rounded bg-zinc-800/50 flex items-center justify-center text-[9px] font-bold text-zinc-600">
                                  {idx + 1}
                                </span>
                                <span className="text-[11px] text-zinc-500 truncate max-w-[120px] md:max-w-[180px]">
                                  {source.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {streamingMessage && (
                        <div className="prose prose-sm max-w-none prose-invert leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code: CodeBlock,
                              a: ({ href, children }) => {
                                const safeHref = href || '';
                                const isCitation = safeHref.startsWith('source-');
                                if (isCitation) {
                                  const index = parseInt(safeHref.split('-')[1]) - 1;
                                  const source = currentSources?.[index];
                                  return (
                                    <a
                                      href={source?.url || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold bg-zinc-800/50 text-zinc-500 rounded-sm hover:bg-white hover:text-black transition-all duration-200 mx-0.5 -translate-y-1 citation-link no-underline"
                                      title={source?.title || `Source ${index + 1}`}
                                    >
                                      {children}
                                    </a>
                                  );
                                }
                                return <span className="text-zinc-500 underline decoration-zinc-800">{children}</span>;
                              }
                            }}
                          >
                            {streamingMessage.includes('[')
                              ? streamingMessage.replace(/\[\s*(\d+)\s*\]/g, '[$1](source-$1)')
                              : streamingMessage}
                          </ReactMarkdown>
                        </div>
                      )}

                      <div ref={streamingContentEndRef} />

                      {agentStatus === "generating" && !streamingMessage && (
                        <span className="inline-block w-1.5 h-1.5 bg-white rounded-full animate-bounce mt-2"></span>
                      )}
                      {streamingMessage && agentStatus && (
                        <span className="inline-block w-1.5 h-1.5 bg-white rounded-full animate-bounce mt-2"></span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-6 bg-zinc-950 border-t border-zinc-900 z-10 pb-6 md:pb-6">
          <ChatInput onSendMessage={handleSendMessage} disabled={streamingThreadId === currentThreadId} />
          <p className="mt-3 text-center text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
