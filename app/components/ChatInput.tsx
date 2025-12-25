"use client";

import { useState, useRef } from "react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSendMessage(input.trim());
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-end space-x-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift + Enter for new line)"
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 pr-12 border border-zinc-700 bg-zinc-900 text-white rounded-lg focus:outline-none focus:border-zinc-500 disabled:bg-zinc-800 disabled:text-zinc-600 resize-none transition-all placeholder-zinc-600 text-base md:text-sm"
            style={{ minHeight: "48px", maxHeight: "200px" }}
          />
          <div className="absolute right-3 bottom-3 text-xs text-zinc-600">
            {input.length > 0 && <span>{input.length}</span>}
          </div>
        </div>
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-4 py-3 bg-white text-black font-semibold rounded-lg focus:outline-none disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-smooth flex items-center justify-center hover:bg-zinc-200 shadow-lg shadow-zinc-900/20 active:scale-95"
        >
          <span className="mr-2">Send</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Press Enter to send, Shift + Enter for new line
      </p>
    </form>
  );
}