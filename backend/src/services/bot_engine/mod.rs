/// Bot Engine module - handles bot command parsing, dispatching, and management.

pub mod bot_service;
pub mod botfather;
pub mod command_parser;
pub mod dispatcher;
pub mod message_processor;
pub mod permission;
pub mod rate_limiter;

pub use bot_service::BotEngineService;
pub use botfather::{BotFather, BotFatherResponse, BOTFATHER_ID};
pub use command_parser::ParsedCommand;
pub use dispatcher::{BotDispatcher, CommandContext, WebhookPayload};
pub use message_processor::{MessageProcessor, ProcessResult};
pub use permission::{PermissionChecker, SCOPE_SEND_MESSAGE, SCOPE_READ_MESSAGE, SCOPE_BAN_USER};
pub use rate_limiter::{RateLimiter, RateLimitResult, DEFAULT_REQUESTS_PER_MINUTE};
