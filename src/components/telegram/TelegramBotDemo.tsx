import { useState, useRef, useEffect } from "react";
import { 
  Menu, Send, X, Command, Home, BarChart3, Settings, 
  HelpCircle, ChevronDown, ChevronUp, Check, RefreshCw,
  ArrowRight, Bot, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  inlineKeyboard?: InlineButton[][];
  timestamp: Date;
}

interface InlineButton {
  text: string;
  callbackData?: string;
  url?: string;
}

interface SlashCommand {
  command: string;
  description: string;
}

const slashCommands: SlashCommand[] = [
  { command: "/start", description: "Start the bot" },
  { command: "/help", description: "Get help and support" },
  { command: "/settings", description: "Bot settings" },
  { command: "/stats", description: "View your statistics" },
  { command: "/subscribe", description: "Subscribe to updates" },
  { command: "/feedback", description: "Send feedback" },
  { command: "/profile", description: "View your profile" },
  { command: "/wallet", description: "Check wallet balance" },
  { command: "/notifications", description: "Manage notifications" },
  { command: "/language", description: "Change language" },
  { command: "/premium", description: "Upgrade to premium" },
  { command: "/export", description: "Export your data" },
];

const replyKeyboardButtons = [
  ["🏠 Home", "📊 Statistics"],
  ["⚙️ Settings", "❓ Help"],
  ["💳 Wallet", "👤 Profile"],
  ["❌ Cancel"],
];

const menuItems = [
  { icon: Home, label: "Home", action: "home" },
  { icon: BarChart3, label: "Statistics", action: "stats" },
  { icon: Settings, label: "Settings", action: "settings" },
  { icon: HelpCircle, label: "Help", action: "help" },
];

const initialMessages: Message[] = [
  {
    id: "1",
    type: "bot",
    content: "👋 Welcome to the Demo Bot!\n\nI can help you explore all Telegram bot menu types. Try the different menus below!",
    inlineKeyboard: [
      [
        { text: "✅ Get Started", callbackData: "start" },
        { text: "ℹ️ Learn More", callbackData: "learn" },
      ],
      [
        { text: "🔄 Refresh", callbackData: "refresh" },
      ],
    ],
    timestamp: new Date(Date.now() - 60000 * 5),
  },
  {
    id: "2",
    type: "user",
    content: "Hello! What can you do?",
    timestamp: new Date(Date.now() - 60000 * 4),
  },
  {
    id: "3",
    type: "bot",
    content: "🤖 I'm a demo bot showcasing Telegram's menu systems!\n\n📋 Here's what I can do:\n• Show Reply Keyboards\n• Display Inline Buttons\n• Handle Slash Commands\n• Navigate via Bot Menu\n\nTry typing / to see available commands!",
    inlineKeyboard: [
      [
        { text: "📱 Reply Keyboard Demo", callbackData: "reply_demo" },
      ],
      [
        { text: "🔘 Inline Buttons Demo", callbackData: "inline_demo" },
      ],
      [
        { text: "⌨️ Commands Demo", callbackData: "cmd_demo" },
      ],
    ],
    timestamp: new Date(Date.now() - 60000 * 3),
  },
  {
    id: "4",
    type: "user",
    content: "/stats",
    timestamp: new Date(Date.now() - 60000 * 2),
  },
  {
    id: "5",
    type: "bot",
    content: "📊 Your Statistics\n\n📈 Messages sent: 142\n📥 Messages received: 89\n⭐ Bot rating: 4.8/5\n🕐 Active time: 24h 35m\n💎 Premium status: Active",
    inlineKeyboard: [
      [
        { text: "📅 Daily", callbackData: "stats_daily" },
        { text: "📆 Weekly", callbackData: "stats_weekly" },
        { text: "📊 Monthly", callbackData: "stats_monthly" },
      ],
      [
        { text: "📤 Export Report", callbackData: "export" },
        { text: "🔄 Refresh", callbackData: "refresh_stats" },
      ],
    ],
    timestamp: new Date(Date.now() - 60000),
  },
];

export function TelegramBotDemo() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [showReplyKeyboard, setShowReplyKeyboard] = useState(true);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showBotMenu, setShowBotMenu] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(slashCommands);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputValue.startsWith("/")) {
      setShowSlashMenu(true);
      const query = inputValue.slice(1).toLowerCase();
      setFilteredCommands(
        slashCommands.filter(cmd => 
          cmd.command.toLowerCase().includes(query) || 
          cmd.description.toLowerCase().includes(query)
        )
      );
    } else {
      setShowSlashMenu(false);
    }
  }, [inputValue]);

  const addBotMessage = (content: string, inlineKeyboard?: InlineButton[][]) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type: "bot",
      content,
      inlineKeyboard,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const addUserMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    addUserMessage(inputValue);
    
    // Simulate bot response
    setTimeout(() => {
      if (inputValue.startsWith("/")) {
        const cmd = inputValue.split(" ")[0];
        switch (cmd) {
          case "/start":
            addBotMessage("🚀 Bot started! Use the menus to navigate.\n\n🎯 Quick Actions:", [
              [{ text: "📖 View Tutorial", callbackData: "tutorial" }],
              [{ text: "🎁 Claim Welcome Bonus", callbackData: "bonus" }],
            ]);
            break;
          case "/help":
            addBotMessage("📚 Help Center\n\nChoose a topic:", [
              [{ text: "🚀 Getting Started", callbackData: "help_start" }],
              [{ text: "❓ FAQ", callbackData: "help_faq" }],
              [{ text: "💬 Contact Support", callbackData: "help_support" }],
              [{ text: "📹 Video Tutorials", callbackData: "help_video" }],
            ]);
            break;
          case "/settings":
            addBotMessage("⚙️ Settings\n\nConfigure your preferences:", [
              [
                { text: "🔔 Notifications", callbackData: "notif" },
                { text: "🌐 Language", callbackData: "lang" },
              ],
              [
                { text: "🎨 Theme", callbackData: "theme" },
                { text: "🔒 Privacy", callbackData: "privacy" },
              ],
              [{ text: "🔙 Back", callbackData: "back" }],
            ]);
            break;
          case "/stats":
            addBotMessage("📊 Your Statistics\n\n📈 Messages: 142\n👥 Interactions: 89\n⭐ Rating: 4.8/5\n🏆 Rank: #234", [
              [
                { text: "📅 Daily", callbackData: "daily" },
                { text: "📆 Weekly", callbackData: "weekly" },
                { text: "📊 Monthly", callbackData: "monthly" },
              ],
              [{ text: "🔄 Refresh", callbackData: "refresh_stats" }],
            ]);
            break;
          case "/profile":
            addBotMessage("👤 Your Profile\n\n📛 Name: Demo User\n📧 Email: demo@example.com\n📅 Joined: Jan 2024\n💎 Status: Premium", [
              [{ text: "✏️ Edit Profile", callbackData: "edit" }],
              [{ text: "📷 Change Photo", callbackData: "photo" }],
            ]);
            break;
          case "/wallet":
            addBotMessage("💳 Wallet Balance\n\n💰 Balance: $125.50\n📈 This month: +$45.00\n📉 Spent: $32.00", [
              [
                { text: "💵 Deposit", callbackData: "deposit" },
                { text: "💸 Withdraw", callbackData: "withdraw" },
              ],
              [{ text: "📜 Transaction History", callbackData: "history" }],
            ]);
            break;
          case "/premium":
            addBotMessage("💎 Upgrade to Premium\n\n✨ Benefits:\n• Unlimited messages\n• Priority support\n• Exclusive features\n• No ads\n\n💰 Price: $9.99/month", [
              [{ text: "🛒 Subscribe Now", callbackData: "subscribe" }],
              [{ text: "📋 Compare Plans", callbackData: "plans" }],
            ]);
            break;
          case "/notifications":
            addBotMessage("🔔 Notification Settings\n\nManage your alerts:", [
              [{ text: "✅ Messages: ON", callbackData: "toggle_msg" }],
              [{ text: "✅ Updates: ON", callbackData: "toggle_update" }],
              [{ text: "❌ Marketing: OFF", callbackData: "toggle_marketing" }],
              [{ text: "💾 Save", callbackData: "save_notif" }],
            ]);
            break;
          case "/language":
            addBotMessage("🌐 Select Language:", [
              [
                { text: "🇺🇸 English", callbackData: "lang_en" },
                { text: "🇻🇳 Tiếng Việt", callbackData: "lang_vi" },
              ],
              [
                { text: "🇯🇵 日本語", callbackData: "lang_jp" },
                { text: "🇰🇷 한국어", callbackData: "lang_kr" },
              ],
              [{ text: "🇨🇳 中文", callbackData: "lang_cn" }],
            ]);
            break;
          default:
            addBotMessage("❌ Unknown command.\n\nType /help for available commands or use the menu button below.");
        }
      } else {
        addBotMessage(`📩 You said: "${inputValue}"\n\n💡 Tip: Try using the menus or type / to see commands!`, [
          [{ text: "📋 Show Commands", callbackData: "show_cmd" }],
        ]);
      }
    }, 500);
    
    setInputValue("");
    setShowSlashMenu(false);
  };

  const handleReplyKeyboard = (text: string) => {
    addUserMessage(text);
    
    setTimeout(() => {
      if (text.includes("Home")) {
        addBotMessage("🏠 Welcome Home!\n\n📌 Recent Activity:\n• 3 new messages\n• 2 pending tasks\n• 1 notification", [
          [
            { text: "📝 New Task", callbackData: "new_task" },
            { text: "📋 View Tasks", callbackData: "view_tasks" },
          ],
          [
            { text: "📬 Messages", callbackData: "messages" },
            { text: "🔔 Alerts", callbackData: "alerts" },
          ],
        ]);
      } else if (text.includes("Statistics")) {
        addBotMessage("📊 Your Statistics Dashboard\n\n📈 Today: +15 interactions\n📅 This Week: 89 messages\n📆 This Month: 342 total\n🏆 Ranking: Top 10%", [
          [
            { text: "📈 Daily", callbackData: "daily" },
            { text: "📅 Weekly", callbackData: "weekly" },
            { text: "📆 Monthly", callbackData: "monthly" },
          ],
          [{ text: "📤 Export CSV", callbackData: "export" }],
        ]);
      } else if (text.includes("Settings")) {
        addBotMessage("⚙️ Settings Menu\n\nSelect an option to configure:", [
          [
            { text: "🔔 Notifications", callbackData: "notif" },
            { text: "🎨 Theme", callbackData: "theme" },
          ],
          [
            { text: "🔐 Privacy", callbackData: "privacy" },
            { text: "🌐 Language", callbackData: "lang" },
          ],
          [{ text: "🗑️ Clear Data", callbackData: "clear" }],
        ]);
      } else if (text.includes("Help")) {
        addBotMessage("❓ Help Center\n\nHow can I assist you today?", [
          [
            { text: "📖 User Guide", callbackData: "guide" },
            { text: "💬 FAQ", callbackData: "faq" },
          ],
          [
            { text: "🎥 Video Tutorials", callbackData: "videos" },
            { text: "📧 Contact Us", callbackData: "contact" },
          ],
          [{ text: "🐛 Report Bug", callbackData: "bug" }],
        ]);
      } else if (text.includes("Wallet")) {
        addBotMessage("💳 Your Wallet\n\n💰 Balance: $125.50\n📈 Earned this month: +$45.00\n📉 Spent: -$32.00\n🎁 Bonus: $5.00", [
          [
            { text: "💵 Deposit", callbackData: "deposit" },
            { text: "💸 Withdraw", callbackData: "withdraw" },
          ],
          [{ text: "📜 History", callbackData: "history" }],
        ]);
      } else if (text.includes("Profile")) {
        addBotMessage("👤 Your Profile\n\n📛 Demo User\n📧 demo@example.com\n📅 Member since: Jan 2024\n💎 Status: Premium\n⭐ Rating: 4.8/5", [
          [
            { text: "✏️ Edit", callbackData: "edit" },
            { text: "📷 Photo", callbackData: "photo" },
          ],
          [{ text: "🔗 Share Profile", callbackData: "share" }],
        ]);
      } else if (text.includes("Cancel")) {
        setShowReplyKeyboard(false);
        addBotMessage("⌨️ Keyboard hidden.\n\nTap the menu button (☰) to show it again.");
      }
    }, 400);
  };

  const handleInlineButton = (button: InlineButton, messageId: string) => {
    // Update the message to show button was clicked
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          content: msg.content + `\n\n✓ Selected: ${button.text}`,
        };
      }
      return msg;
    }));

    setTimeout(() => {
      addBotMessage(`Action "${button.text}" triggered!\n\nThis is where the bot would perform the requested action.`, [
        [{ text: "✅ Done", callbackData: "done" }, { text: "🔙 Back", callbackData: "back" }],
      ]);
    }, 300);
  };

  const handleSlashCommand = (command: string) => {
    setInputValue(command + " ");
    setShowSlashMenu(false);
  };

  const handleMenuAction = (action: string) => {
    setShowBotMenu(false);
    addUserMessage(`[Menu: ${action}]`);
    
    setTimeout(() => {
      switch (action) {
        case "home":
          addBotMessage("🏠 Home Screen\n\nWelcome back! Here's your dashboard.", [
            [{ text: "📊 Quick Stats", callbackData: "quick_stats" }],
            [{ text: "🔔 Notifications (3)", callbackData: "notif" }],
          ]);
          break;
        case "stats":
          addBotMessage("📊 Statistics Dashboard\n\n📈 Today: +15%\n📉 This Week: -2%\n📊 This Month: +8%");
          break;
        case "settings":
          addBotMessage("⚙️ Bot Settings\n\nManage your preferences:", [
            [{ text: "Language: English 🇺🇸", callbackData: "lang" }],
            [{ text: "Notifications: ON 🔔", callbackData: "notif" }],
            [{ text: "Theme: Auto 🌗", callbackData: "theme" }],
          ]);
          break;
        case "help":
          addBotMessage("❓ Help & Support\n\nHow can we assist you?", [
            [{ text: "📚 Documentation", callbackData: "docs" }],
            [{ text: "💬 Live Chat", callbackData: "chat" }],
            [{ text: "📧 Email Support", callbackData: "email" }],
          ]);
          break;
      }
    }, 400);
  };

  return (
    <div className="flex flex-col h-[600px] max-w-md mx-auto bg-background border border-border rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-primary text-primary-foreground">
        <Avatar className="h-10 w-10 bg-primary-foreground/20">
          <AvatarFallback className="bg-transparent">
            <Bot className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold">Demo Bot</h3>
          <p className="text-xs opacity-80">bot • online</p>
        </div>
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2 animate-fade-in",
                message.type === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.type === "bot" && (
                <Avatar className="h-8 w-8 mt-1 bg-primary/10">
                  <AvatarFallback className="bg-transparent text-primary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2",
                message.type === "user" 
                  ? "bg-primary text-primary-foreground rounded-br-md" 
                  : "bg-muted rounded-bl-md"
              )}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                
                {/* Inline Keyboard */}
                {message.inlineKeyboard && (
                  <div className="mt-3 space-y-2">
                    {message.inlineKeyboard.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex gap-2">
                        {row.map((button, btnIndex) => (
                          <button
                            key={btnIndex}
                            onClick={() => handleInlineButton(button, message.id)}
                            className={cn(
                              "flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all",
                              "bg-background/80 hover:bg-background text-foreground",
                              "border border-border hover:border-primary",
                              "active:scale-95"
                            )}
                          >
                            {button.text}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                
                <p className="text-[10px] opacity-60 mt-1 text-right">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {message.type === "user" && (
                <Avatar className="h-8 w-8 mt-1 bg-accent">
                  <AvatarFallback className="bg-transparent text-accent-foreground">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Slash Command Menu */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="border-t border-border bg-card animate-fade-in">
          <div className="p-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
            <Command className="h-3 w-3" />
            Bot Commands
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredCommands.map((cmd) => (
              <button
                key={cmd.command}
                onClick={() => handleSlashCommand(cmd.command)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left"
              >
                <span className="text-primary font-mono text-sm">{cmd.command}</span>
                <span className="text-muted-foreground text-sm">{cmd.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reply Keyboard */}
      {showReplyKeyboard && !showSlashMenu && (
        <div className="border-t border-border bg-muted/50 p-2 animate-fade-in">
          <div className="flex justify-between items-center mb-2 px-2">
            <span className="text-xs text-muted-foreground">Reply Keyboard</span>
            <button 
              onClick={() => setShowReplyKeyboard(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {replyKeyboardButtons.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-2">
                {row.map((text) => (
                  <button
                    key={text}
                    onClick={() => handleReplyKeyboard(text)}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all",
                      "bg-background hover:bg-accent border border-border",
                      "active:scale-95 shadow-sm"
                    )}
                  >
                    {text}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bot Menu Popup */}
      {showBotMenu && (
        <div className="absolute bottom-20 left-4 right-4 bg-card border border-border rounded-xl shadow-xl animate-scale-in overflow-hidden z-10">
          <div className="p-3 border-b border-border bg-muted/50">
            <h4 className="font-semibold text-sm">Bot Menu</h4>
            <p className="text-xs text-muted-foreground">Select an action</p>
          </div>
          <div className="p-2">
            {menuItems.map((item) => (
              <button
                key={item.action}
                onClick={() => handleMenuAction(item.action)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
              >
                <item.icon className="h-5 w-5 text-primary" />
                <span className="font-medium">{item.label}</span>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border bg-card p-3 relative">
        <div className="flex items-center gap-2">
          {/* Bot Menu Button */}
          <button
            onClick={() => {
              setShowBotMenu(!showBotMenu);
              if (!showReplyKeyboard) setShowReplyKeyboard(true);
            }}
            className={cn(
              "p-2 rounded-full transition-all",
              showBotMenu 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
          >
            {showBotMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Show/Hide Keyboard Toggle */}
          {!showReplyKeyboard && (
            <button
              onClick={() => setShowReplyKeyboard(true)}
              className="p-2 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
          )}

          {/* Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type / for commands..."
              className="w-full px-4 py-2 rounded-full bg-muted border-none outline-none text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={cn(
              "p-2 rounded-full transition-all",
              inputValue.trim()
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>

        {/* Menu Type Indicators */}
        <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Reply Keyboard
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            Inline Keyboard
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            Bot Menu
          </div>
        </div>
      </div>
    </div>
  );
}
