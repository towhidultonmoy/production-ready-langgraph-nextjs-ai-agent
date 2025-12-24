"use client";

import { useEffect, useState } from "react";

export type AgentStatus = "thinking" | "searching" | "analyzing" | "generating" | null;

interface StatusIndicatorProps {
    status: AgentStatus;
}

export default function StatusIndicator({ status }: StatusIndicatorProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (status) {
            setIsVisible(true);
        } else {
            // Delay hiding to allow fade-out animation
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [status]);

    // Hide completely if neither visible nor active
    if (!isVisible && !status) return null;

    const getStatusConfig = () => {
        switch (status) {
            case "thinking":
                return {
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            />
                        </svg>
                    ),
                    text: "Thinking...",
                    color: "text-purple-400",
                    bgColor: "bg-purple-900/30",
                    borderColor: "border-purple-700/50",
                };
            case "searching":
                return {
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    ),
                    text: "Searching the web...",
                    color: "text-blue-400",
                    bgColor: "bg-blue-900/30",
                    borderColor: "border-blue-700/50",
                };
            case "analyzing":
                return {
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                        </svg>
                    ),
                    text: "Analyzing results...",
                    color: "text-amber-400",
                    bgColor: "bg-amber-900/30",
                    borderColor: "border-amber-700/50",
                };
            case "generating":
                return {
                    icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                        </svg>
                    ),
                    text: "Generating response...",
                    color: "text-emerald-400",
                    bgColor: "bg-emerald-900/30",
                    borderColor: "border-emerald-700/50",
                };
            default:
                return null;
        }
    };

    const config = getStatusConfig();
    if (!config) return null;

    return (
        <div
            className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg border ${config.bgColor} ${config.borderColor} transition-all duration-300 ${status ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                }`}
        >
            <div className={`${config.color} animate-pulse`}>{config.icon}</div>
            <span className={`text-xs font-medium ${config.color}`}>{config.text}</span>
        </div>
    );
}