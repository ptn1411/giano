/**
 * ClickableCommand Component
 * Renders text with clickable slash commands that can be sent when clicked
 */

import { cn } from "@/lib/utils";

interface ClickableCommandProps {
  text: string;
  onCommandClick?: (command: string) => void;
  isOwn?: boolean;
  className?: string;
}

// Regex to match slash commands like /newbot, /mybots, /help, etc.
// Also matches commands with arguments like "/newbot MyBot"
const COMMAND_REGEX = /(\/[a-zA-Z_][a-zA-Z0-9_]*(?:\s+<[^>]+>)?)/g;

export function ClickableCommand({ 
  text, 
  onCommandClick, 
  isOwn = false,
  className 
}: ClickableCommandProps) {
  if (!text) return null;

  const parts = text.split(COMMAND_REGEX);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check if this part is a command
        if (part.startsWith('/')) {
          // Extract just the command (without placeholder args like <name>)
          const commandOnly = part.split(/\s+/)[0];
          
          return (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                onCommandClick?.(commandOnly);
              }}
              className={cn(
                "font-mono font-medium px-1 py-0.5 rounded transition-all",
                "hover:scale-105 active:scale-95 cursor-pointer",
                isOwn 
                  ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" 
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              )}
              title={`Click to send ${commandOnly}`}
            >
              {part}
            </button>
          );
        }
        return part;
      })}
    </span>
  );
}

/**
 * Format text with clickable commands and mentions
 */
export function formatTextWithClickableCommands(
  text: string, 
  isOwn: boolean, 
  onCommandClick?: (command: string) => void
): React.ReactNode {
  if (!text) return null;

  // Split by lines first to preserve formatting
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => (
    <span key={lineIndex}>
      {lineIndex > 0 && <br />}
      <ClickableCommand 
        text={line} 
        onCommandClick={onCommandClick} 
        isOwn={isOwn} 
      />
    </span>
  ));
}
