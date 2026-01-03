import { useState, forwardRef } from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile, Clock, Heart, Utensils, Plane, Activity, Lightbulb, Flag } from "lucide-react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  children: React.ReactNode;
}

const emojiCategories = [
  {
    id: "recent",
    name: "Recent",
    icon: Clock,
    emojis: ["👍", "❤️", "😂", "🔥", "👏", "😊", "🎉", "💯"],
  },
  {
    id: "smileys",
    name: "Smileys",
    icon: Smile,
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
      "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜",
      "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐",
      "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬",
      "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷",
    ],
  },
  {
    id: "love",
    name: "Love",
    icon: Heart,
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "💟", "😍", "🥰", "😘", "😻", "💑",
      "👩‍❤️‍👨", "👨‍❤️‍👨", "👩‍❤️‍👩", "💏", "👩‍❤️‍💋‍👨", "👨‍❤️‍💋‍👨", "👩‍❤️‍💋‍👩", "🫶",
    ],
  },
  {
    id: "gestures",
    name: "Gestures",
    icon: Activity,
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏",
      "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪",
    ],
  },
  {
    id: "food",
    name: "Food",
    icon: Utensils,
    emojis: [
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓",
      "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝",
      "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑",
      "🍕", "🍔", "🍟", "🌭", "🍿", "🧂", "🥓", "🍳",
    ],
  },
  {
    id: "travel",
    name: "Travel",
    icon: Plane,
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑",
      "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "✈️", "🛫",
      "🛬", "🛩️", "🚀", "🛸", "🚁", "⛵", "🚤", "🛥️",
      "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨",
    ],
  },
  {
    id: "objects",
    name: "Objects",
    icon: Lightbulb,
    emojis: [
      "⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️",
      "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹",
      "🎥", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️",
      "💡", "🔦", "🕯️", "📔", "📕", "📖", "📗", "📘",
    ],
  },
  {
    id: "symbols",
    name: "Symbols",
    icon: Flag,
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💯", "💢", "💥", "💫", "💦", "💨", "🕳️", "💣",
      "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "✅", "❌",
      "❓", "❗", "‼️", "⁉️", "💲", "🔱", "📛", "🔰",
    ],
  },
];

export const EmojiPicker = forwardRef<HTMLDivElement, EmojiPickerProps>(
  function EmojiPicker({ onSelect, children }, ref) {
    const [open, setOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState("smileys");

    const handleSelect = (emoji: string) => {
      onSelect(emoji);
      setOpen(false);
    };

    const activeEmojis = emojiCategories.find((c) => c.id === activeCategory)?.emojis || [];

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent 
          ref={ref}
          className="w-80 p-0 bg-card border-border" 
          align="end"
          side="top"
          sideOffset={8}
        >
          {/* Category tabs */}
          <div className="flex border-b border-border p-1 gap-0.5">
            {emojiCategories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center p-2 rounded-md transition-colors",
                    activeCategory === category.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  title={category.name}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          {/* Emoji grid */}
          <div className="p-2 h-48 overflow-y-auto scrollbar-thin">
            <div className="grid grid-cols-8 gap-1">
              {activeEmojis.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  onClick={() => handleSelect(emoji)}
                  className="flex items-center justify-center h-8 w-8 text-xl rounded-md hover:bg-accent transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
);
