import { TelegramBotDemo } from "@/components/telegram/TelegramBotDemo";
import { ThemeToggle } from "@/components/chat/ThemeToggle";

const TelegramDemo = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4 md:p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Telegram Bot Menu Demo
            </h1>
            <p className="text-muted-foreground">
              Interactive demonstration of all official Telegram bot menu types
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Menu Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
              <div className="w-4 h-4 rounded bg-green-500" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Reply Keyboard</h3>
            <p className="text-xs text-muted-foreground">
              Large buttons below input. Great for onboarding and common actions.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
              <div className="w-4 h-4 rounded bg-blue-500" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Inline Keyboard</h3>
            <p className="text-xs text-muted-foreground">
              Buttons inside messages. Used for workflows and confirmations.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
              <div className="w-4 h-4 rounded bg-purple-500" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Bot Menu Button</h3>
            <p className="text-xs text-muted-foreground">
              Fixed menu at input corner. Main entry point for bot navigation.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3">
              <div className="w-4 h-4 rounded bg-orange-500" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Slash Commands</h3>
            <p className="text-xs text-muted-foreground">
              Type "/" to see commands. Preferred by power users.
            </p>
          </div>
        </div>
      </div>

      {/* Demo */}
      <div className="max-w-md mx-auto relative">
        <TelegramBotDemo />
      </div>

      {/* Instructions */}
      <div className="max-w-4xl mx-auto mt-8">
        <div className="p-6 rounded-xl bg-card border border-border">
          <h3 className="font-semibold text-foreground mb-4">How to Use</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <p><strong>Reply Keyboard:</strong> Tap the large buttons below the input to send quick responses.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <p><strong>Inline Keyboard:</strong> Click buttons inside bot messages to trigger actions.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <p><strong>Bot Menu:</strong> Click the menu icon (☰) next to input to open the main menu.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <p><strong>Slash Commands:</strong> Type "/" in the input field to see available commands.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramDemo;
