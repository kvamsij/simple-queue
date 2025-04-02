import QueueManager from '../queue/QueueManager';
import { AppConfig } from '../config';

export class QueueService {
  private queueManager: QueueManager;
  private logger: AppConfig['logger'];
  private processors: Map<string, NodeJS.Timeout> = new Map();

  constructor(private config: AppConfig) {
    this.logger = config.logger;
    this.queueManager = new QueueManager(config.storageDir);
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
}