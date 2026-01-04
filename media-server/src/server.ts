import { v4 as uuidv4 } from "uuid";
import WebSocket, { WebSocketServer } from "ws";
import { config } from "./config";
import { roomManager } from "./roomManager";
import { handleDisconnect, handleMessage } from "./signaling";
import { ServerMessage } from "./types";
import { workerManager } from "./workerManager";

// Map socket ID to WebSocket
const sockets = new Map<string, WebSocket>();
// Map WebSocket to socket ID
const socketIds = new Map<WebSocket, string>();
// Map socket ID to room ID
const socketRooms = new Map<string, string>();

function broadcast(
  roomId: string,
  message: ServerMessage,
  excludeSocketId?: string
): void {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  for (const participant of room.participants.values()) {
    if (participant.socketId === excludeSocketId) continue;

    const ws = sockets.get(participant.socketId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

async function main(): Promise<void> {
  // Initialize mediasoup workers
  await workerManager.initialize();

  // Create WebSocket server
  const wss = new WebSocketServer({ port: config.port });

  console.log(`Mediasoup signaling server listening on port ${config.port}`);

  wss.on("connection", (ws: WebSocket) => {
    const socketId = uuidv4();
    sockets.set(socketId, ws);
    socketIds.set(ws, socketId);

    console.log(`Client connected: ${socketId}`);

    ws.on("message", async (data: Buffer) => {
      try {
        const message = data.toString();
        await handleMessage(ws, socketId, message, broadcast);
      } catch (error) {
        console.error("Error handling message:", error);
      }
    });

    ws.on("close", () => {
      console.log(`Client disconnected: ${socketId}`);
      handleDisconnect(ws, socketId, broadcast);
      sockets.delete(socketId);
      socketIds.delete(ws);
      socketRooms.delete(socketId);
    });

    ws.on("error", (error) => {
      console.error(`WebSocket error for ${socketId}:`, error);
    });
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    wss.close();
    await workerManager.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    wss.close();
    await workerManager.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
