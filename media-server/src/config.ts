import dotenv from 'dotenv';
import os from 'os';
import { RtpCodecCapability, TransportListenInfo, WebRtcServerOptions } from 'mediasoup/node/lib/types';

dotenv.config();

export const config = {
  // Server port
  port: parseInt(process.env.PORT || '3001', 10),

  // Mediasoup worker settings
  mediasoup: {
    numWorkers: parseInt(process.env.NUM_WORKERS || '', 10) || os.cpus().length,
    
    worker: {
      rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || '40000', 10),
      rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || '49999', 10),
      logLevel: 'warn' as const,
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
      ] as const,
    },

    // Router media codecs
    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
      ] as RtpCodecCapability[],
    },

    // WebRTC transport settings
    webRtcTransport: {
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined,
        },
      ] as TransportListenInfo[],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
      maxIncomingBitrate: 1500000,
    },
  },

  // TURN server configuration for ICE
  turnServers: process.env.TURN_SERVER_URL ? [
    {
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || '',
    },
  ] : [],
};
