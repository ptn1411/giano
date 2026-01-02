import { Command } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlashCommand {
  command: string;
  description: string;
}

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  onSelect: (command: string) => void;
  filterQuery: string;
}

const botCommands: Record<string, SlashCommand[]> = {
  'bot-1': [
    { command: "/start", description: "Start the bot" },
    { command: "/help", description: "Get help and support" },
    { command: "/settings", description: "Bot settings" },
    { command: "/stats", description: "View your statistics" },
    { command: "/profile", description: "View your profile" },
    { command: "/wallet", description: "Check wallet balance" },
    { command: "/notifications", description: "Manage notifications" },
    { command: "/language", description: "Change language" },
    { command: "/premium", description: "Upgrade to premium" },
    { command: "/feedback", description: "Send feedback" },
  ],
  'bot-2': [
    { command: "/start", description: "Start shopping" },
    { command: "/help", description: "Get help" },
    { command: "/browse", description: "Browse products" },
    { command: "/cart", description: "View your cart" },
    { command: "/orders", description: "View order history" },
    { command: "/deals", description: "See hot deals" },
    { command: "/wishlist", description: "View wishlist" },
    { command: "/track", description: "Track your order" },
    { command: "/support", description: "Contact support" },
  ],
  'bot-3': [
    { command: "/start", description: "Start receiving news" },
    { command: "/help", description: "Get help" },
    { command: "/subscribe", description: "Subscribe to updates" },
    { command: "/unsubscribe", description: "Unsubscribe from updates" },
    { command: "/categories", description: "Browse categories" },
    { command: "/breaking", description: "Get breaking news" },
    { command: "/saved", description: "View saved articles" },
    { command: "/settings", description: "Notification settings" },
  ],
};

const defaultCommands: SlashCommand[] = [
  { command: "/start", description: "Start the bot" },
  { command: "/help", description: "Get help" },
  { command: "/settings", description: "Settings" },
];

export function getCommandsForBot(botId: string | null): SlashCommand[] {
  if (!botId) return defaultCommands;
  return botCommands[botId] || defaultCommands;
}

export function SlashCommandMenu({ commands, onSelect, filterQuery }: SlashCommandMenuProps) {
  const query = filterQuery.slice(1).toLowerCase(); // Remove the "/" prefix
  
  const filteredCommands = commands.filter(cmd => 
    cmd.command.toLowerCase().includes(query) || 
    cmd.description.toLowerCase().includes(query)
  );

  if (filteredCommands.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-scale-in z-20">
      <div className="px-3 py-2 border-b border-border bg-muted/50 flex items-center gap-2">
        <Command className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Bot Commands</span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filteredCommands.map((cmd) => (
          <button
            key={cmd.command}
            onClick={() => onSelect(cmd.command)}
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left"
          >
            <span className="text-primary font-mono text-sm font-medium">{cmd.command}</span>
            <span className="text-muted-foreground text-sm">{cmd.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
