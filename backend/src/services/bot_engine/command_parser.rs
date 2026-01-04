/// Command Parser module for parsing bot commands from messages.
/// 
/// Parses messages starting with "/" into commands and arguments,
/// supporting shell-style quoting for arguments with spaces.

/// Represents a parsed command with its name and arguments.
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedCommand {
    /// The command name (lowercase, without the leading "/")
    pub command: String,
    /// The arguments passed to the command
    pub args: Vec<String>,
}

impl ParsedCommand {
    /// Parse a message text into a command and arguments.
    /// 
    /// Returns `None` if the message doesn't start with '/'.
    /// 
    /// # Arguments
    /// * `text` - The message text to parse
    /// 
    /// # Returns
    /// * `Some(ParsedCommand)` if the message is a valid command
    /// * `None` if the message doesn't start with '/' or is invalid
    /// 
    /// # Examples
    /// ```
    /// use chat_backend::services::bot_engine::command_parser::ParsedCommand;
    /// 
    /// // Simple command
    /// let cmd = ParsedCommand::parse("/help").unwrap();
    /// assert_eq!(cmd.command, "help");
    /// assert!(cmd.args.is_empty());
    /// 
    /// // Command with arguments
    /// let cmd = ParsedCommand::parse("/echo hello world").unwrap();
    /// assert_eq!(cmd.command, "echo");
    /// assert_eq!(cmd.args, vec!["hello", "world"]);
    /// 
    /// // Command with quoted arguments
    /// let cmd = ParsedCommand::parse(r#"/say "hello world""#).unwrap();
    /// assert_eq!(cmd.command, "say");
    /// assert_eq!(cmd.args, vec!["hello world"]);
    /// 
    /// // Not a command
    /// assert!(ParsedCommand::parse("hello").is_none());
    /// ```
    pub fn parse(text: &str) -> Option<Self> {
        let text = text.trim();
        
        // Must start with '/'
        if !text.starts_with('/') {
            return None;
        }

        // Get content after '/'
        let content = &text[1..];
        if content.is_empty() {
            return None;
        }

        // Use shell_words for proper argument parsing with shell-style quoting
        let parts = shell_words::split(content).ok()?;
        if parts.is_empty() {
            return None;
        }

        // First part is the command (converted to lowercase for case-insensitive matching)
        let command = parts[0].to_lowercase();
        
        // Remaining parts are arguments
        let args = parts[1..].to_vec();

        Some(ParsedCommand { command, args })
    }

    /// Check if this command matches a given command name (case-insensitive).
    /// 
    /// # Arguments
    /// * `name` - The command name to match against
    /// 
    /// # Returns
    /// * `true` if the command matches
    pub fn is_command(&self, name: &str) -> bool {
        self.command == name.to_lowercase()
    }

    /// Get the first argument, if any.
    pub fn first_arg(&self) -> Option<&str> {
        self.args.first().map(|s| s.as_str())
    }

    /// Get all arguments joined by a space.
    pub fn args_text(&self) -> String {
        self.args.join(" ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_command() {
        let cmd = ParsedCommand::parse("/help").unwrap();
        assert_eq!(cmd.command, "help");
        assert!(cmd.args.is_empty());
    }

    #[test]
    fn test_command_with_args() {
        let cmd = ParsedCommand::parse("/echo hello world").unwrap();
        assert_eq!(cmd.command, "echo");
        assert_eq!(cmd.args, vec!["hello", "world"]);
    }

    #[test]
    fn test_command_with_quoted_args() {
        let cmd = ParsedCommand::parse(r#"/say "hello world""#).unwrap();
        assert_eq!(cmd.command, "say");
        assert_eq!(cmd.args, vec!["hello world"]);
    }

    #[test]
    fn test_command_case_insensitive() {
        let cmd = ParsedCommand::parse("/HELP").unwrap();
        assert_eq!(cmd.command, "help");

        let cmd = ParsedCommand::parse("/HeLp").unwrap();
        assert_eq!(cmd.command, "help");
    }

    #[test]
    fn test_not_a_command() {
        assert!(ParsedCommand::parse("hello").is_none());
        assert!(ParsedCommand::parse("hello /world").is_none());
    }

    #[test]
    fn test_empty_command() {
        assert!(ParsedCommand::parse("/").is_none());
        assert!(ParsedCommand::parse("/ ").is_none());
    }

    #[test]
    fn test_whitespace_handling() {
        let cmd = ParsedCommand::parse("  /help  ").unwrap();
        assert_eq!(cmd.command, "help");

        let cmd = ParsedCommand::parse("/echo   hello   world").unwrap();
        assert_eq!(cmd.command, "echo");
        assert_eq!(cmd.args, vec!["hello", "world"]);
    }

    #[test]
    fn test_mixed_quoted_args() {
        let cmd = ParsedCommand::parse(r#"/cmd arg1 "arg with spaces" arg3"#).unwrap();
        assert_eq!(cmd.command, "cmd");
        assert_eq!(cmd.args, vec!["arg1", "arg with spaces", "arg3"]);
    }

    #[test]
    fn test_single_quoted_args() {
        let cmd = ParsedCommand::parse("/cmd 'hello world'").unwrap();
        assert_eq!(cmd.command, "cmd");
        assert_eq!(cmd.args, vec!["hello world"]);
    }

    #[test]
    fn test_is_command() {
        let cmd = ParsedCommand::parse("/help").unwrap();
        assert!(cmd.is_command("help"));
        assert!(cmd.is_command("HELP"));
        assert!(cmd.is_command("Help"));
        assert!(!cmd.is_command("start"));
    }

    #[test]
    fn test_first_arg() {
        let cmd = ParsedCommand::parse("/echo hello world").unwrap();
        assert_eq!(cmd.first_arg(), Some("hello"));

        let cmd = ParsedCommand::parse("/help").unwrap();
        assert_eq!(cmd.first_arg(), None);
    }

    #[test]
    fn test_args_text() {
        let cmd = ParsedCommand::parse("/echo hello world").unwrap();
        assert_eq!(cmd.args_text(), "hello world");

        let cmd = ParsedCommand::parse("/help").unwrap();
        assert_eq!(cmd.args_text(), "");
    }
}
