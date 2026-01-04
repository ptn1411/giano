import WebSocket from "ws";
import { roomManager } from "./roomManager";
import { ClientMessage, ServerMessage } from "./types";

interface SocketContext {
  oderId?: string;
  roomId?: string;
}

const socketContexts = new Map<WebSocket, SocketContext>();
// Track scheduled participant removals to cancel them if participant reconnects
const scheduledRemovals = new Map<string, NodeJS.Timeout>();

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(
  roomId: string,
  message: ServerMessage,
  excludeSocketId?: string
): void {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  for (const participant of room.participants.values()) {
    if (participant.socketId === excludeSocketId) continue;
    // Find the socket by socketId - this requires tracking sockets
    // For now, we'll handle this in the server.ts
  }
}

export async function handleMessage(
  ws: WebSocket,
  socketId: string,
  data: string,
  broadcastFn: (roomId: string, msg: ServerMessage, exclude?: string) => void
): Promise<void> {
  let message: ClientMessage;

  try {
    message = JSON.parse(data);
  } catch (e) {
    send(ws, { type: "error", message: "Invalid JSON" });
    return;
  }

  const context = socketContexts.get(ws) || {};

  try {
    switch (message.type) {
      case "joinRoom": {
        const { roomId, oderId } = message;

        console.log(
          `[Signaling] joinRoom - socketId: ${socketId}, oderId: ${oderId}, roomId: ${roomId}`
        );

        // Cancel any scheduled removal for this participant
        const removalKey = `${roomId}:${oderId}`;
        if (scheduledRemovals.has(removalKey)) {
          clearTimeout(scheduledRemovals.get(removalKey)!);
          scheduledRemovals.delete(removalKey);
          console.log(
            `[Signaling] Cancelled scheduled removal for ${oderId} - participant is reconnecting`
          );
        }

        // Check if this participant is already in the room with a different socket
        let room = roomManager.getRoom(roomId);
        if (room) {
          const existingParticipant = room.participants.get(oderId);
          if (
            existingParticipant &&
            existingParticipant.socketId !== socketId
          ) {
            console.log(
              `[Signaling] Participant ${oderId} already in room with different socketId. Old: ${existingParticipant.socketId}, New: ${socketId}`
            );
          }
        }

        // Create room if it doesn't exist
        await roomManager.createRoom(roomId);

        // Add participant
        await roomManager.addParticipant(roomId, oderId, socketId);

        // Store context
        context.oderId = oderId;
        context.roomId = roomId;
        socketContexts.set(ws, context);

        // Verify participant was added before proceeding
        room = roomManager.getRoom(roomId);
        if (!room?.participants.has(oderId)) {
          console.error(
            `[Signaling] CRITICAL: Participant ${oderId} not in room after addParticipant!`
          );
          send(ws, { type: "error", message: "Failed to join room" });
          return;
        }

        console.log(
          `[Signaling] Participant ${oderId} confirmed in room ${roomId}`
        );

        // Get existing producers to consume
        const existingProducers = roomManager.getExistingProducers(
          roomId,
          oderId
        );

        // Notify the joining participant
        send(ws, {
          type: "roomJoined",
          existingProducers,
        });

        console.log(`[Signaling] Sent roomJoined to ${oderId}`);

        // Notify other participants
        broadcastFn(
          roomId,
          {
            type: "participantJoined",
            oderId,
          },
          socketId
        );

        break;
      }

      case "leaveRoom": {
        const { roomId } = message;
        const oderId = context.oderId;

        console.log(
          `[Signaling] leaveRoom - socketId: ${socketId}, oderId: ${oderId}, roomId: ${roomId}`
        );

        if (oderId) {
          await roomManager.removeParticipant(roomId, oderId, socketId);

          // Notify other participants
          broadcastFn(
            roomId,
            {
              type: "participantLeft",
              oderId,
            },
            socketId
          );
        }

        socketContexts.delete(ws);
        console.log(`[Signaling] Socket context deleted for ${socketId}`);
        break;
      }

      case "getRouterRtpCapabilities": {
        const { roomId } = message;
        const rtpCapabilities = roomManager.getRouterRtpCapabilities(roomId);
        send(ws, { type: "routerRtpCapabilities", rtpCapabilities });
        break;
      }

      case "createProducerTransport": {
        const { roomId } = message;
        const oderId = context.oderId;

        console.log(
          `[Signaling] createProducerTransport - socketId: ${socketId}, oderId: ${oderId}, roomId: ${roomId}, context:`,
          context
        );

        if (!oderId) {
          send(ws, { type: "error", message: "Not joined to room" });
          return;
        }

        if (!context.roomId || context.roomId !== roomId) {
          send(ws, {
            type: "error",
            message: `Room mismatch: expected ${context.roomId}, got ${roomId}`,
          });
          return;
        }

        const transport = await roomManager.createProducerTransport(
          roomId,
          oderId
        );

        send(ws, {
          type: "producerTransportCreated",
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
        break;
      }

      case "createConsumerTransport": {
        const { roomId } = message;
        const oderId = context.oderId;

        console.log(
          `[Signaling] createConsumerTransport - socketId: ${socketId}, oderId: ${oderId}, roomId: ${roomId}`
        );

        if (!oderId) {
          send(ws, { type: "error", message: "Not joined to room" });
          return;
        }

        if (!context.roomId || context.roomId !== roomId) {
          send(ws, {
            type: "error",
            message: `Room mismatch: expected ${context.roomId}, got ${roomId}`,
          });
          return;
        }

        const transport = await roomManager.createConsumerTransport(
          roomId,
          oderId
        );

        send(ws, {
          type: "consumerTransportCreated",
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
        break;
      }

      case "connectTransport": {
        const { roomId, transportId, dtlsParameters } = message;
        const oderId = context.oderId;

        if (!oderId) {
          send(ws, { type: "error", message: "Not joined to room" });
          return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
          send(ws, { type: "error", message: "Room not found" });
          return;
        }

        const participant = room.participants.get(oderId);
        if (!participant) {
          send(ws, { type: "error", message: "Participant not found" });
          return;
        }

        // Find the transport
        const transport =
          participant.producerTransport?.id === transportId
            ? participant.producerTransport
            : participant.consumerTransport?.id === transportId
            ? participant.consumerTransport
            : null;

        if (!transport) {
          send(ws, { type: "error", message: "Transport not found" });
          return;
        }

        await transport.connect({ dtlsParameters });
        send(ws, { type: "transportConnected" });
        break;
      }

      case "produce": {
        const { roomId, transportId, kind, rtpParameters, appData } = message;
        const oderId = context.oderId;

        if (!oderId) {
          send(ws, { type: "error", message: "Not joined to room" });
          return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
          send(ws, { type: "error", message: "Room not found" });
          return;
        }

        const participant = room.participants.get(oderId);
        if (!participant || !participant.producerTransport) {
          send(ws, { type: "error", message: "Producer transport not found" });
          return;
        }

        const producer = await participant.producerTransport.produce({
          kind,
          rtpParameters,
          appData: { ...appData, oderId },
        });

        // Store producer by kind
        participant.producers.set(kind, producer);

        producer.on("transportclose", () => {
          participant.producers.delete(kind);
        });

        send(ws, { type: "produced", id: producer.id });

        // Notify other participants about new producer
        broadcastFn(
          roomId,
          {
            type: "newProducer",
            oderId,
            producerId: producer.id,
            kind,
          },
          socketId
        );

        break;
      }

      case "consume": {
        const { roomId, producerId } = message;
        const oderId = context.oderId;

        if (!oderId) {
          send(ws, { type: "error", message: "Not joined to room" });
          return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
          send(ws, { type: "error", message: "Room not found" });
          return;
        }

        const participant = room.participants.get(oderId);
        if (!participant || !participant.consumerTransport) {
          send(ws, { type: "error", message: "Consumer transport not found" });
          return;
        }

        // Find the producer
        let producer = null;
        let producerOderId = "";
        for (const [pOderId, p] of room.participants) {
          for (const prod of p.producers.values()) {
            if (prod.id === producerId) {
              producer = prod;
              producerOderId = pOderId;
              break;
            }
          }
          if (producer) break;
        }

        if (!producer) {
          send(ws, { type: "error", message: "Producer not found" });
          return;
        }

        // Check if router can consume
        if (
          !room.router.canConsume({
            producerId: producer.id,
            rtpCapabilities: room.router.rtpCapabilities,
          })
        ) {
          send(ws, { type: "error", message: "Cannot consume" });
          return;
        }

        const consumer = await participant.consumerTransport.consume({
          producerId: producer.id,
          rtpCapabilities: room.router.rtpCapabilities,
          paused: true, // Start paused, client will resume
        });

        participant.consumers.set(consumer.id, consumer);

        consumer.on("transportclose", () => {
          participant.consumers.delete(consumer.id);
        });

        consumer.on("producerclose", () => {
          participant.consumers.delete(consumer.id);
          send(ws, {
            type: "producerRemoved",
            oderId: producerOderId,
            producerId: producer!.id,
            kind: producer!.kind,
          });
        });

        send(ws, {
          type: "consumed",
          id: consumer.id,
          producerId: producer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });

        break;
      }

      case "resumeConsumer": {
        const { roomId, consumerId } = message;
        const oderId = context.oderId;

        if (!oderId) {
          send(ws, { type: "error", message: "Not joined to room" });
          return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
          send(ws, { type: "error", message: "Room not found" });
          return;
        }

        const participant = room.participants.get(oderId);
        if (!participant) {
          send(ws, { type: "error", message: "Participant not found" });
          return;
        }

        const consumer = participant.consumers.get(consumerId);
        if (!consumer) {
          send(ws, { type: "error", message: "Consumer not found" });
          return;
        }

        await consumer.resume();
        send(ws, { type: "consumerResumed" });
        break;
      }

      case "pauseProducer": {
        const { roomId, producerId } = message;
        const oderId = context.oderId;

        if (!oderId) {
          send(ws, { type: "error", message: "Not joined to room" });
          return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
          send(ws, { type: "error", message: "Room not found" });
          return;
        }

        const participant = room.participants.get(oderId);
        if (!participant) {
          send(ws, { type: "error", message: "Participant not found" });
          return;
        }

        // Find producer by ID
        for (const producer of participant.producers.values()) {
          if (producer.id === producerId) {
            await producer.pause();
            send(ws, { type: "producerPaused" });
            return;
          }
        }

        send(ws, { type: "error", message: "Producer not found" });
        break;
      }

      case "resumeProducer": {
        const { roomId, producerId } = message;
        const oderId = context.oderId;

        if (!oderId) {
          send(ws, { type: "error", message: "Not joined to room" });
          return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
          send(ws, { type: "error", message: "Room not found" });
          return;
        }

        const participant = room.participants.get(oderId);
        if (!participant) {
          send(ws, { type: "error", message: "Participant not found" });
          return;
        }

        // Find producer by ID
        for (const producer of participant.producers.values()) {
          if (producer.id === producerId) {
            await producer.resume();
            send(ws, { type: "producerResumed" });
            return;
          }
        }

        send(ws, { type: "error", message: "Producer not found" });
        break;
      }

      case "closeProducer": {
        const { roomId, producerId } = message;
        const oderId = context.oderId;

        if (!oderId) {
          send(ws, { type: "error", message: "Not joined to room" });
          return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
          send(ws, { type: "error", message: "Room not found" });
          return;
        }

        const participant = room.participants.get(oderId);
        if (!participant) {
          send(ws, { type: "error", message: "Participant not found" });
          return;
        }

        // Find and close producer
        for (const [kind, producer] of participant.producers) {
          if (producer.id === producerId) {
            producer.close();
            participant.producers.delete(kind);
            send(ws, { type: "producerClosed" });

            // Notify other participants
            broadcastFn(
              roomId,
              {
                type: "producerRemoved",
                oderId,
                producerId,
                kind,
              },
              socketId
            );
            return;
          }
        }

        send(ws, { type: "error", message: "Producer not found" });
        break;
      }

      default:
        send(ws, { type: "error", message: "Unknown message type" });
    }
  } catch (error) {
    console.error("Error handling message:", error);
    send(ws, { type: "error", message: (error as Error).message });
  }
}

export function handleDisconnect(
  ws: WebSocket,
  socketId: string,
  broadcastFn: (roomId: string, msg: ServerMessage, exclude?: string) => void
): void {
  const context = socketContexts.get(ws);
  console.log(
    `[Signaling] handleDisconnect - socketId: ${socketId}, context:`,
    context
  );

  if (context?.oderId && context?.roomId) {
    // Delay participant removal to allow for reconnection
    // This prevents issues when client refreshes or temporarily disconnects
    console.log(
      `[Signaling] Scheduling participant removal for ${context.oderId} in 3 seconds...`
    );

    const removalKey = `${context.roomId}:${context.oderId}`;
    const timeoutId = setTimeout(() => {
      scheduledRemovals.delete(removalKey);
      roomManager
        .removeParticipant(context.roomId!, context.oderId!, socketId)
        .then(() => {
          console.log(
            `[Signaling] Participant ${context.oderId} removed and broadcasted after delay`
          );
          broadcastFn(
            context.roomId!,
            {
              type: "participantLeft",
              oderId: context.oderId!,
            },
            socketId
          );
        })
        .catch((error) => {
          console.error(`[Signaling] Error removing participant:`, error);
        });
    }, 3000); // 3 second delay to allow reconnection

    // Store the timeout so it can be cancelled if participant reconnects
    scheduledRemovals.set(removalKey, timeoutId);
  }
  socketContexts.delete(ws);
}
