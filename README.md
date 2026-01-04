# Smooth Messenger

A modern, real-time chat application built with React, TypeScript, and a Rust backend.

## Features

- Real-time messaging with WebSocket support
- User authentication (login, register, session management)
- Private and group chats
- Message reactions, editing, and deletion
- File and image uploads
- Typing indicators
- Read receipts
- Bot integration with inline keyboards
- Dark/Light theme support
- Responsive design

## Project Structure

```
├── backend/           # Rust/Axum backend API
├── src/
│   ├── components/    # React components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility functions and config
│   ├── pages/         # Page components
│   ├── services/      # API services and mock data
│   │   ├── api/       # Real API integration
│   │   └── *.ts       # Mock data for demo mode
│   └── stores/        # Zustand state management
└── .kiro/             # Kiro specs and documentation
```

## Environment Setup

### Quick Setup

```sh
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend REST API base URL | `http://localhost:3000/api/v1` |
| `VITE_WS_URL` | WebSocket URL for real-time features | `ws://localhost:3000/ws` |
| `VITE_DEMO_MODE` | Enable demo mode with mock data | `false` |
| `VITE_DEBUG` | Enable debug logging | `false` |
| `VITE_API_TIMEOUT` | API request timeout (ms) | `30000` |
| `VITE_MAX_UPLOAD_SIZE` | Max file upload size (bytes) | `10485760` |

### Demo Mode

Demo mode allows you to run the application without a backend server. It uses mock data for all API calls.

```env
# Enable demo mode
VITE_DEMO_MODE=true
```

Demo mode is useful for:
- Testing the UI without backend setup
- Showcasing the application
- Development when backend is unavailable

Demo credentials:
- Email: `demo@example.com`, Password: `demo123`
- Email: `alice@example.com`, Password: `alice123`
- Email: `test@test.com`, Password: `test123`

## Development

### Prerequisites

- Node.js 18+ (install with [nvm](https://github.com/nvm-sh/nvm))
- Rust (for backend, install with [rustup](https://rustup.rs/))

### Running the Application

```sh
# Install dependencies
npm install

# Start in demo mode (no backend required)
VITE_DEMO_MODE=true npm run dev

# Or start with real backend
# First, start the backend (in backend/ directory)
cd backend
cargo run

# Then start the frontend (in root directory)
npm run dev
```

## API Integration

### REST API Endpoints

The frontend integrates with the following backend API endpoints:

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/logout` | Logout current session |
| GET | `/auth/session` | Get current session |

#### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | Get all users |
| GET | `/users/:userId` | Get user by ID |

#### Chats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chats` | Get all chats |
| GET | `/chats?search=query` | Search chats |
| GET | `/chats/:chatId` | Get chat by ID |
| POST | `/chats/group` | Create group chat |
| POST | `/chats/:chatId/read` | Mark chat as read |

#### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chats/:chatId/messages` | Get messages (paginated) |
| POST | `/chats/:chatId/messages` | Send message |
| PUT | `/chats/:chatId/messages/:messageId` | Edit message |
| DELETE | `/chats/:chatId/messages/:messageId` | Delete message |
| POST | `/chats/:chatId/messages/:messageId/reactions` | Add reaction |
| POST | `/chats/:chatId/messages/:messageId/pin` | Pin message |
| DELETE | `/chats/:chatId/messages/:messageId/pin` | Unpin message |

#### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/settings/profile` | User profile |
| GET/PUT | `/settings/privacy` | Privacy settings |
| GET/PUT | `/settings/notifications` | Notification settings |
| GET/PUT | `/settings/appearance` | Appearance settings |
| GET/PUT | `/settings/chat` | Chat settings |
| GET/PUT | `/settings/data-storage` | Data storage settings |
| POST | `/settings/clear-cache` | Clear cache |
| GET | `/settings/devices` | Get devices |
| DELETE | `/settings/devices/:deviceId` | Terminate device |

#### File Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload file (multipart/form-data) |

#### Bots
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/bots/:botId/callback` | Handle inline button callback |

### WebSocket Events

The application uses WebSocket for real-time communication.

#### Connection
```
ws://localhost:3000/ws?token=<jwt_token>
```

#### Events (Server → Client)

| Event | Description | Payload |
|-------|-------------|---------|
| `new_message` | New message received | `{ message: Message }` |
| `typing` | User typing indicator | `{ chatId, userId, userName, isTyping }` |
| `user_status` | User online/offline status | `{ userId, status, lastSeen? }` |
| `message_status` | Message delivery status | `{ chatId, messageId, status }` |
| `message_read` | Message read receipt | `{ chatId, messageId, readBy }` |

#### Events (Client → Server)

| Event | Description | Payload |
|-------|-------------|---------|
| `start_typing` | Start typing indicator | `{ chatId }` |
| `stop_typing` | Stop typing indicator | `{ chatId }` |

### API Client Configuration

The API client is configured in `src/services/api/client.ts`:

- Automatic JWT token injection in Authorization header
- 401 response handling (redirect to login)
- Request/response logging in debug mode
- Configurable timeout

## State Management

The application uses Zustand for state management with the following stores:

| Store | Purpose |
|-------|---------|
| `authStore` | Authentication state and user session |
| `chatsStore` | Chat list and chat operations |
| `messagesStore` | Messages with pagination and optimistic updates |
| `usersStore` | User data with caching |
| `settingsStore` | User settings |
| `themeStore` | Theme preferences |

## Technologies

- **Frontend**: React, TypeScript, Vite
- **UI**: shadcn/ui, Tailwind CSS
- **State**: Zustand
- **HTTP**: Axios
- **Real-time**: Native WebSocket API
- **Backend**: Rust, Axum, SQLx, PostgreSQL

## Production Deployment

```env
VITE_API_URL=https://api.yourdomain.com/v1
VITE_WS_URL=wss://api.yourdomain.com/ws
VITE_DEMO_MODE=false
```

## License

MIT
