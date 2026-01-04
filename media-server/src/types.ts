import { Router, WebRtcTransport, Producer, Consumer } from 'mediasoup/node/lib/types';

export interface Participant {
  oderId: string;
  socketId: string;
  producerTransport?: WebRtcTransport;
  consumerTransport?: WebRtcTransport;
  producers: Map<string, Producer>; // kind -> Producer
  consumers: Map<string, Consumer>; // consumerId -> Consumer
}

export interface Room {
  id: string;
  router: Router;
  participants: Map<string, Participant>; // oderId -> Participant
  createdAt: Date;
}

// WebSocket message types
export type ClientMessage =
  | { type: 'getRouterRtpCapabilities'; roomId: string }
  | { type: 'createProducerTransport'; roomId: string }
  | { type: 'createConsumerTransport'; roomId: string }
  | { type: 'connectTransport'; roomId: string; transportId: string; dtlsParameters: any }
  | { type: 'produce'; roomId: string; transportId: string; kind: 'audio' | 'video'; rtpParameters: any; appData?: any }
  | { type: 'consume'; roomId: string; producerId: string }
  | { type: 'resumeConsumer'; roomId: string; consumerId: string }
  | { type: 'pauseProducer'; roomId: string; producerId: string }
  | { type: 'resumeProducer'; roomId: string; producerId: string }
  | { type: 'closeProducer'; roomId: string; producerId: string }
  | { type: 'joinRoom'; roomId: string; oderId: string }
  | { type: 'leaveRoom'; roomId: string };

export type ServerMessage =
  | { type: 'routerRtpCapabilities'; rtpCapabilities: any }
  | { type: 'producerTransportCreated'; id: string; iceParameters: any; iceCandidates: any; dtlsParameters: any }
  | { type: 'consumerTransportCreated'; id: string; iceParameters: any; iceCandidates: any; dtlsParameters: any }
  | { type: 'transportConnected' }
  | { type: 'produced'; id: string }
  | { type: 'consumed'; id: string; producerId: string; kind: string; rtpParameters: any }
  | { type: 'consumerResumed' }
  | { type: 'producerPaused' }
  | { type: 'producerResumed' }
  | { type: 'producerClosed' }
  | { type: 'newProducer'; oderId: string; producerId: string; kind: string }
  | { type: 'producerRemoved'; oderId: string; producerId: string; kind: string }
  | { type: 'participantJoined'; oderId: string }
  | { type: 'participantLeft'; oderId: string }
  | { type: 'roomJoined'; existingProducers: Array<{ oderId: string; producerId: string; kind: string }> }
  | { type: 'error'; message: string };
