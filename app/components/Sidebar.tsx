"use client";

import { useState, useEffect } from "react";

interface Session {
    thread_id: string;
    title: string;
    updated_at: string;
}

interface SidebarProps {
    currentThreadId: string;
    onSelectSession: (threadId: string) => void;
    onNewChat: () => void;
    onDeleteSession: (threadId: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ currentThreadId, onSelectSession, onNewChat, onDeleteSession, isOpen, onClose }: SidebarProps) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSessions = async () => {
        try {
            const res = await fetch("/api/sessions");
            if (!res.ok) throw new Error("Failed to fetch sessions");
            const data = await res.json();
            setSessions(data || []);
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 15000);
        return () => clearInterval(interval);
    }, [currentThreadId]);

    // Mobile Overlay
    const overlayClass = isOpen ? "fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300" : "hidden";

    // Sidebar Container Class
    // Mobile: detailed fixed positioning. Desktop: relative with width transition.
    // Note: We use `overflow-hidden` to hide content when collapsed on desktop.
    const sidebarClass = `
        fixed top-0 bottom-0 left-0 z-50 bg-black border-r border-zinc-800 transition-transform duration-300 ease-in-out
        w-72 md:w-80 flex-shrink-0 overflow-hidden
        ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
        md:translate-x-0 md:relative md:z-0 md:shadow-none
        ${isOpen ? "md:w-80 md:opacity-100" : "md:w-0 md:opacity-0 md:border-r-0"}
    `;

    // Inner content container - ensure it doesn't squash during transition
    const innerContentClass = "flex flex-col h-full w-full";

    return (
        <>
            {/* Mobile Overlay */}
            <div className={overlayClass} onClick={onClose}></div>

            <aside className={sidebarClass}>
                <div className={innerContentClass}>
                    {/* Header / New Chat */}
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6 md:hidden">
                            <h2 className="text-lg font-bold text-white">Menu</h2>
                            <button onClick={onClose} className="text-zinc-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                onNewChat();
                                if (window.innerWidth < 768) onClose();
                            }}
                            className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-zinc-200 text-black rounded-lg py-3 px-4 transition-smooth font-semibold active:scale-[0.98] shadow-lg shadow-zinc-900/20"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="whitespace-nowrap">New Conversation</span>
                        </button>
                    </div>

                    {/* Session List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
                        <div className="px-3 mb-2">
                            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">Recent Chats</h2>
                        </div>

                        {loading && sessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-50">
                                <div className="w-6 h-6 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-medium text-zinc-500">Loading history...</span>
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="px-3 py-8 text-center">
                                <p className="text-sm text-zinc-600">No conversations yet</p>
                            </div>
                        ) : (
                            sessions.map((session) => (
                                <div
                                    key={session.thread_id}
                                    className={`group relative flex items-center justify-between p-3 rounded-lg cursor-pointer transition-smooth border border-transparent ${currentThreadId === session.thread_id
                                        ? "bg-zinc-900 border-zinc-800 text-white"
                                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                                        }`}
                                    onClick={() => {
                                        onSelectSession(session.thread_id);
                                        if (window.innerWidth < 768) onClose();
                                    }}
                                >
                                    <div className="flex items-center space-x-3 overflow-hidden w-full pr-8">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${currentThreadId === session.thread_id ? "bg-zinc-800 text-white" : "bg-black border border-zinc-800 text-zinc-600 group-hover:border-zinc-700"
                                            }`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                            </svg>
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="truncate text-sm font-medium">{session.title}</span>
                                            <span className="text-[10px] text-zinc-500">
                                                {new Date(session.updated_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteSession(session.thread_id);
                                        }}
                                        className={`absolute right-3 p-1.5 hover:bg-red-900/30 hover:text-red-400 rounded-lg transition-all duration-200 ${currentThreadId === session.thread_id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                            }`}
                                        title="Delete chat"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-6 border-t border-zinc-800 bg-black">
                        <div className="flex items-center space-x-3">
                            <div className="relative flex items-center justify-center">
                                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                <div className="absolute w-4 h-4 bg-emerald-500/20 rounded-full animate-ping"></div>
                            </div>
                            <span className="text-sm font-medium text-zinc-400 whitespace-nowrap">System Online</span>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
