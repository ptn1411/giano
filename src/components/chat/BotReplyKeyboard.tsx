import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface BotReplyKeyboardProps {
  onButtonClick: (text: string) => void;
  botId: string;
}

const botKeyboards: Record<string, string[][]> = {
  'bot-1': [
    ["🏠 Home", "📊 Statistics"],
    ["⚙️ Settings", "❓ Help"],
    ["💳 Wallet", "👤 Profile"],
    ["❌ Cancel"],
  ],
  'bot-2': [
    ["🛒 Browse Products", "🔥 Hot Deals"],
    ["🛍️ My Cart", "📦 Orders"],
    ["💬 Support", "⚙️ Settings"],
  ],
  'bot-3': [
    ["🌍 World News", "💼 Business"],
    ["💻 Technology", "⚽ Sports"],
    ["🔔 Subscribe", "⚙️ Settings"],
  ],
};

const defaultKeyboard = [
  ["🏠 Home", "❓ Help"],
  ["⚙️ Settings"],
];

export function BotReplyKeyboard({ onButtonClick, botId }: BotReplyKeyboardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const keyboard = botKeyboards[botId] || defaultKeyboard;

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center justify-center gap-2 w-full py-2 border-t border-border bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronUp className="h-4 w-4" />
        <span className="text-xs font-medium">Show Keyboard</span>
      </button>
    );
  }

  return (
    <div className="border-t border-border bg-muted/30 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs text-muted-foreground font-medium">Quick Actions</span>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Keyboard buttons */}
      <div className="px-3 pb-3 space-y-2">
        {keyboard.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2">
            {row.map((text) => (
              <button
                key={text}
                onClick={() => onButtonClick(text)}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all",
                  "bg-background hover:bg-accent border border-border hover:border-primary/50",
                  "active:scale-[0.98] shadow-sm"
                )}
              >
                {text}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
