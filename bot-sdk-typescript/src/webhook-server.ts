// Webhook Server for Bot SDK
// HTTP server for webhook mode deployment

import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { Update, Logger } from './types';
import { UpdateRouter } from './update-router';

/**
 * WebhookServer class
 * Manages HTTP server for webhook mode
 * Validates and routes incoming webhook requests
 */
export class WebhookServer {
  private app: Express;
  private server?: Server;
  private port: number;
  private path: string;
  private updateRouter: UpdateRouter;
  private logger: Logger;

  /**
   * Initialize Express app with JSON middleware
   * Store port, path, updateRouter, logger
   * Requirement 3.1
   */
  constructor(
    port: number,
    path: string,
    updateRouter: UpdateRouter,
    logger: Logger
  ) {
    this.port = port;
    this.path = path;
    this.updateRouter = updateRouter;
    this.logger = logger;
    
    // Initialize Express app with JSON middleware
    this.app = express();
    this.app.use(express.json());
  }

  /**
   * Start HTTP server on specified port
   * Register POST handler for webhook path
   * Return promise that resolves when server is listening
   * Requirement 3.1
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      // Register POST handler for webhook path
      this.app.post(this.path, (req: Request, res: Response) => {
        this.handleWebhook(req, res);
      });

      // Start HTTP server on specified port
      this.server = this.app.listen(this.port, () => {
        this.logger.info(`Webhook server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Handle incoming webhook requests
   * Validate update payload has updateId and message
   * Route valid updates to UpdateRouter
   * Return HTTP 400 for invalid payloads
   * Return HTTP 200 for successful processing
   * Requirements 3.2, 3.3, 3.4, 3.5
   */
  private handleWebhook(req: Request, res: Response): void {
    try {
      const update: Update = req.body;

      // Validate update payload has updateId and message (Requirement 3.2)
      if (!update.updateId || !update.message) {
        // Return HTTP 400 for invalid payloads (Requirement 3.4)
        res.status(400).json({ error: 'Invalid update payload' });
        return;
      }

      // Route valid updates to UpdateRouter (Requirement 3.3)
      this.updateRouter.route(update);
      
      // Return HTTP 200 for successful processing (Requirement 3.5)
      res.status(200).json({ ok: true });
    } catch (error) {
      this.logger.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Close HTTP server gracefully
   * Wait for pending requests to complete
   * Return promise that resolves when server is closed
   * Requirement 14.3
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        // Close HTTP server gracefully and wait for pending requests
        this.server.close(() => {
          this.logger.info('Webhook server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
