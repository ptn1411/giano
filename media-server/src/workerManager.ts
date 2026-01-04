import * as mediasoup from 'mediasoup';
import { Worker, Router } from 'mediasoup/node/lib/types';
import { config } from './config';

class WorkerManager {
  private workers: Worker[] = [];
  private nextWorkerIndex = 0;

  async initialize(): Promise<void> {
    const numWorkers = config.mediasoup.numWorkers;
    console.log(`Creating ${numWorkers} mediasoup workers...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await this.createWorker();
      this.workers.push(worker);
    }

    console.log(`${this.workers.length} mediasoup workers created`);
  }

  private async createWorker(): Promise<Worker> {
    const worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags as any,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    worker.on('died', (error) => {
      console.error('mediasoup worker died:', error);
      // Remove dead worker and create a new one
      const index = this.workers.indexOf(worker);
      if (index !== -1) {
        this.workers.splice(index, 1);
      }
      // Create replacement worker
      this.createWorker().then((newWorker) => {
        this.workers.push(newWorker);
        console.log('Replacement worker created');
      });
    });

    return worker;
  }

  getNextWorker(): Worker {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async createRouter(): Promise<Router> {
    const worker = this.getNextWorker();
    const router = await worker.createRouter({
      mediaCodecs: config.mediasoup.router.mediaCodecs,
    });
    return router;
  }

  async close(): Promise<void> {
    for (const worker of this.workers) {
      worker.close();
    }
    this.workers = [];
  }
}

export const workerManager = new WorkerManager();
