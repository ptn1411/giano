import { WebRtcTransport } from "mediasoup/node/lib/types";
import { config } from "./config";
import { Participant, Room } from "./types";
import { workerManager } from "./workerManager";

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  async createRoom(roomId: string): Promise<Room> {
    // Check if room already exists
    const existingRoom = this.rooms.get(roomId);
    if (existingRoom) {
      return existingRoom;
    }

    // Create new router for the room
    const router = await workerManager.createRouter();

    const room: Room = {
      id: roomId,
      router,
      participants: new Map(),
      createdAt: new Date(),
    };

    this.rooms.set(roomId, room);
    console.log(`Room ${roomId} created`);

    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  async deleteRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Close all transports and producers/consumers
    for (const participant of room.participants.values()) {
      this.cleanupParticipant(participant);
    }

    // Close the router
    room.router.close();
    this.rooms.delete(roomId);
    console.log(`Room ${roomId} deleted`);
  }

  async addParticipant(
    roomId: string,
    oderId: string,
    socketId: string
  ): Promise<Participant> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    // Check if participant already exists
    const existingParticipant = room.participants.get(oderId);
    if (existingParticipant) {
      // Update socket ID for reconnection
      existingParticipant.socketId = socketId;
      return existingParticipant;
    }

    const participant: Participant = {
      oderId,
      socketId,
      producers: new Map(),
      consumers: new Map(),
    };

    room.participants.set(oderId, participant);
    console.log(
      `[RoomManager] Participant ${oderId} joined room ${roomId} (socketId: ${socketId}, total participants: ${room.participants.size})`
    );

    return participant;
  }

  async removeParticipant(
    roomId: string,
    oderId: string,
    socketId: string
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(oderId);
    if (!participant) return;

    // Only remove if socket ID matches (prevents race condition during reconnection)
    if (participant.socketId !== socketId) {
      console.log(
        `[RoomManager] Ignoring removeParticipant for ${oderId}: socketId mismatch`
      );
      return;
    }

    this.cleanupParticipant(participant);
    room.participants.delete(oderId);
    console.log(
      `[RoomManager] Participant ${oderId} left room ${roomId} (socketId: ${socketId}, remaining: ${room.participants.size})`
    );

    // Delete room if empty
    if (room.participants.size === 0) {
      await this.deleteRoom(roomId);
    }
  }

  private cleanupParticipant(participant: Participant): void {
    // Close all producers
    for (const producer of participant.producers.values()) {
      producer.close();
    }
    participant.producers.clear();

    // Close all consumers
    for (const consumer of participant.consumers.values()) {
      consumer.close();
    }
    participant.consumers.clear();

    // Close transports
    if (participant.producerTransport) {
      participant.producerTransport.close();
    }
    if (participant.consumerTransport) {
      participant.consumerTransport.close();
    }
  }

  async createProducerTransport(
    roomId: string,
    oderId: string
  ): Promise<WebRtcTransport> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    console.log(
      `[RoomManager] createProducerTransport - Looking for participant ${oderId} in room ${roomId}`
    );
    console.log(
      `[RoomManager] Room has ${room.participants.size} participants:`,
      Array.from(room.participants.keys())
    );

    const participant = room.participants.get(oderId);
    if (!participant) {
      this.debugRoomState(roomId);
      throw new Error(`Participant ${oderId} not found in room ${roomId}`);
    }

    const transport = await room.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate:
        config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        transport.close();
      }
    });

    participant.producerTransport = transport;
    return transport;
  }

  async createConsumerTransport(
    roomId: string,
    oderId: string
  ): Promise<WebRtcTransport> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const participant = room.participants.get(oderId);
    if (!participant) {
      throw new Error(`Participant ${oderId} not found in room ${roomId}`);
    }

    const transport = await room.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate:
        config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        transport.close();
      }
    });

    participant.consumerTransport = transport;
    return transport;
  }

  getRouterRtpCapabilities(roomId: string): any {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }
    return room.router.rtpCapabilities;
  }

  getExistingProducers(
    roomId: string,
    excludeOderId?: string
  ): Array<{ oderId: string; producerId: string; kind: string }> {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const producers: Array<{
      oderId: string;
      producerId: string;
      kind: string;
    }> = [];

    for (const [oderId, participant] of room.participants) {
      if (oderId === excludeOderId) continue;

      for (const [kind, producer] of participant.producers) {
        producers.push({
          oderId,
          producerId: producer.id,
          kind,
        });
      }
    }

    return producers;
  }

  getParticipantBySocketId(
    roomId: string,
    socketId: string
  ): Participant | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    for (const participant of room.participants.values()) {
      if (participant.socketId === socketId) {
        return participant;
      }
    }
    return undefined;
  }

  getOtherParticipants(roomId: string, excludeOderId: string): Participant[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const others: Participant[] = [];
    for (const [oderId, participant] of room.participants) {
      if (oderId !== excludeOderId) {
        others.push(participant);
      }
    }
    return others;
  }

  // Debug helper
  debugRoomState(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.log(`[RoomManager DEBUG] Room ${roomId} does not exist`);
      console.log(
        `[RoomManager DEBUG] Available rooms:`,
        Array.from(this.rooms.keys())
      );
      return;
    }
    console.log(
      `[RoomManager DEBUG] Room ${roomId} has ${room.participants.size} participants:`
    );
    for (const [oderId, participant] of room.participants) {
      console.log(`  - ${oderId} (socketId: ${participant.socketId})`);
    }
  }
}

export const roomManager = new RoomManager();
