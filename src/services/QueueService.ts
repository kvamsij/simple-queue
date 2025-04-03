import QueueManager from '../queue/QueueManager';
import { AppConfig } from '../config';
import { QueueNotificationService } from './QueueNotificationService';
import { QueueSubscriber, QueueEventType } from '../queue/types';

export class QueueService {
  private queueManager: QueueManager;
  private logger: AppConfig['logger'];
  private processors: Map<string, NodeJS.Timeout> = new Map();
  private notificationService: QueueNotificationService;

  constructor(private config: AppConfig) {
    this.logger = config.logger;
    this.queueManager = new QueueManager(config.storageDir);
    this.notificationService = new QueueNotificationService(this.logger, this.queueManager);
  }

  public getQueueManager(): QueueManager {
    return this.queueManager;
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing queue service');
    
    // Create a queue for handling messages
    const messageQueue = this.queueManager.createQueue<{ content: string }>('messages', {
      priorityEnabled: true,
      maxSize: 100,
      retryLimit: 3
    });
    
    // Register a processor
    messageQueue.registerProcessor(async (item) => {
      this.logger.info(`Processing message: ${item.data.content}`);
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));
      return true; // success
    });
    
    // Create a task queue for handling tasks
    const taskQueue = this.queueManager.createQueue<{ name: string, params: any }>('tasks', {
      priorityEnabled: true,
      maxSize: 50,
      retryLimit: 5
    });
    
    // Register a processor for tasks
    taskQueue.registerProcessor(async (item) => {
      this.logger.info(`Executing task: ${item.data.name} with params:`, item.data.params);
      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 200));
      return Math.random() > 0.2; // 80% success rate
    });
    
    // Create a generic JSON queue for arbitrary data
    const jsonQueue = this.queueManager.createQueue<any>('json', {
      priorityEnabled: true,
      maxSize: 200,
      retryLimit: 3
    });
    
    // Register a processor for JSON data
    jsonQueue.registerProcessor(async (item) => {
      this.logger.info(`Processing JSON data:`, item.data);
      // Simulate JSON data processing
      await new Promise(resolve => setTimeout(resolve, 150));
      return true; // success
    });
    
    // Start processing queues
    this.startProcessing('messages');
    this.startProcessing('tasks');
    this.startProcessing('json');
  }

  public startProcessing(queueName: string): void {
    const queue = this.queueManager.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Queue ${queueName} does not exist`);
      return;
    }

    const timer = setInterval(async () => {
      if (queue.size() > 0) {
        const processed = await queue.processNext();
        if (processed) {
          this.logger.info(`Successfully processed a message from queue ${queueName}`);
        } else {
          this.logger.warn(`Failed to process a message from queue ${queueName}`);
        }
      }
    }, 500);

    this.processors.set(queueName, timer);
    this.logger.info(`Started processing queue: ${queueName}`);
  }

  public stopProcessing(queueName: string): void {
    const timer = this.processors.get(queueName);
    if (timer) {
      clearInterval(timer);
      this.processors.delete(queueName);
      this.logger.info(`Stopped processing queue: ${queueName}`);
    }
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down queue service');
    
    // Stop all processors
    for (const [queueName, timer] of this.processors.entries()) {
      clearInterval(timer);
      this.logger.info(`Stopped processing queue: ${queueName}`);
    }
    this.processors.clear();
    
    // Save all queues
    try {
      await this.queueManager.saveAllQueues();
      this.logger.info('All queues saved successfully');
    } catch (error) {
      this.logger.error('Error saving queues', error);
    }
  }

  /**
   * Get the notification service
   */
  public getNotificationService(): QueueNotificationService {
    return this.notificationService;
  }

  /**
   * Subscribe to events from a specific queue
   * @param queueName The queue to subscribe to
   * @param subscriber The subscriber that will receive events
   * @param eventTypes Optional array of event types to filter
   * @returns true if subscription was successful
   */
  public subscribeToQueue<T>(
    queueName: string, 
    subscriber: QueueSubscriber<T>, 
    eventTypes?: QueueEventType[]
  ): boolean {
    return this.notificationService.subscribeToQueue(queueName, subscriber, { eventTypes });
  }

  /**
   * Create a webhook subscription to a queue
   * @param queueName The queue to subscribe to
   * @param webhookUrl The URL to send notifications to
   * @param eventTypes Optional array of event types to filter
   * @returns true if subscription was successful
   */
  public createWebhookSubscription(
    queueName: string,
    webhookUrl: string,
    eventTypes?: QueueEventType[]
  ): boolean {
    const subscriber = this.notificationService.createWebhookSubscriber(webhookUrl);
    return this.subscribeToQueue(queueName, subscriber, eventTypes);
  }

  /**
   * Mark a queue as complete, triggering notification for any remaining items
   * @param queueName The queue to mark as complete
   * @returns true if successful
   */
  public markQueueAsComplete(queueName: string): boolean {
    return this.notificationService.markQueueAsComplete(queueName);
  }
}