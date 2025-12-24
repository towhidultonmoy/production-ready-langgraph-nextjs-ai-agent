"use client";

import { useState } from "react";
import { type ClassAttributes, type HTMLAttributes } from "react";
import { type ExtraProps } from "react-markdown";

export const CodeBlock = ({
    children,
    className,
    ...props
}: ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & ExtraProps) => {
    const [isCopied, setIsCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";
    const codeContent = String(children).replace(/\n$/, "");

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(codeContent);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy code", err);
        }
    };

    if (!match) {
        return (
            <code className={`${className} bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-zinc-200 border border-zinc-700`} {...props}>
                {children}
            </code>
        );
    }

    return (
        <div className="relative group my-4 rounded-xl overflow-hidden bg-[#09090b] border border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-zinc-800">
                <span className="text-xs font-mono text-zinc-400 lowercase">{language}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-white transition-colors p-1 rounded hover:bg-zinc-800"
                >
                    {isCopied ? (
                        <>
                            <svg className="w-3.5 h-3.5 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-zinc-200 font-medium">Copied!</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>
            <div className="overflow-x-auto p-4 custom-scrollbar bg-[#09090b]">
                <code className={`!bg-transparent !p-0 !text-sm font-mono text-zinc-300 block whitespace-pre`} {...props}>
                    {children}
                </code>
            </div>
        </div>
    );
};
