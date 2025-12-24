"use client";

interface ToolCallProps {
  toolCall: {
    name: string;
    input: any;
    output?: any;
  };
}

export default function ToolCall({ toolCall }: ToolCallProps) {
  return (
    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p className="text-sm font-semibold text-yellow-800 mb-2">
        🛠️ Tool: {toolCall.name}
      </p>
      <div className="text-xs space-y-2">
        <div>
          <p className="font-semibold text-gray-700">Input:</p>
          <pre className="bg-white p-2 rounded overflow-x-auto">
            {JSON.stringify(toolCall.input, null, 2)}
          </pre>
        </div>
        {toolCall.output && (
          <div>
            <p className="font-semibold text-gray-700">Output:</p>
            <pre className="bg-white p-2 rounded overflow-x-auto">
              {JSON.stringify(toolCall.output, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}