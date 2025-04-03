import { Logger } from '../utils/logger';
import { QueueEvent, QueueSubscriber, QueueEventType, NotificationOptions } from '../queue/types';
import Queue from '../queue/Queue';
import QueueManager from '../queue/QueueManager';

/**
 * Service for managing queue notifications and subscriptions
 */
export class QueueNotificationService {
  private logger: Logger;
  private queueManager: QueueManager;
  private subscribers: Map<string, Set<{ 
    subscriber: QueueSubscriber<any>, 
    options?: NotificationOptions 
  }>> = new Map();

  constructor(logger: Logger, queueManager: QueueManager) {
    this.logger = logger;
    this.queueManager = queueManager;
  }

  /**
   * Subscribe to events from a specific queue
   * @param queueName Name of the queue to subscribe to
   * @param subscriber The subscriber that will receive events
   * @param options Optional filtering options
   * @returns true if subscription was successful, false otherwise
   */
  public subscribeToQueue<T>(queueName: string, subscriber: QueueSubscriber<T>, options?: NotificationOptions): boolean {
    const queue = this.queueManager.getQueue<T>(queueName);
    if (!queue) {
      this.logger.error(`Cannot subscribe: Queue ${queueName} does not exist`);
      return false;
    }

    // Create a queue-specific subscriber that will apply any filters
    const queueSubscriber: QueueSubscriber<T> = {
      onEvent: (event) => {
        // Apply event type filter if specified
        if (options?.eventTypes && !options.eventTypes.includes(event.type)) {
          return;
        }
        
        // Apply custom filter if specified
        if (options?.filterFn && !options.filterFn(event)) {
          return;
        }
        
        // Pass the event to the actual subscriber
        subscriber.onEvent(event);
      }
    };

    // Register with the queue
    queue.subscribe(queueSubscriber);
    
    // Keep track of subscribers for management
    if (!this.subscribers.has(queueName)) {
      this.subscribers.set(queueName, new Set());
    }
    
    this.subscribers.get(queueName)!.add({ 
      subscriber: queueSubscriber,
      options
    });
    
    this.logger.info(`Subscribed to events from queue: ${queueName}`);
    return true;
  }

  /**
   * Unsubscribe from a queue
   * @param queueName Name of the queue to unsubscribe from
   * @param subscriber The subscriber to remove
   * @returns true if unsubscribe was successful, false otherwise
   */
  public unsubscribeFromQueue<T>(queueName: string, subscriber: QueueSubscriber<T>): boolean {
    const queue = this.queueManager.getQueue<T>(queueName);
    if (!queue) {
      this.logger.error(`Cannot unsubscribe: Queue ${queueName} does not exist`);
      return false;
    }

    const queueSubscribers = this.subscribers.get(queueName);
    if (!queueSubscribers) {
      return false;
    }

    // Find and remove the subscriber
    let found = false;
    for (const entry of queueSubscribers) {
      if (entry.subscriber === subscriber) {
        queue.unsubscribe(entry.subscriber);
        queueSubscribers.delete(entry);
        found = true;
        this.logger.info(`Unsubscribed from events from queue: ${queueName}`);
      }
    }

    return found;
  }

  /**
   * Subscribe to events from all queues
   * @param subscriber The subscriber that will receive events
   * @param options Optional filtering options
   */
  public subscribeToAllQueues<T>(subscriber: QueueSubscriber<T>, options?: NotificationOptions): void {
    const queueNames = this.queueManager.getQueueNames();
    
    for (const queueName of queueNames) {
      this.subscribeToQueue(queueName, subscriber, options);
    }
    
    this.logger.info(`Subscribed to events from all queues (${queueNames.length} queues)`);
  }

  /**
   * Mark a queue as complete, triggering a notification for any remaining items
   * @param queueName Name of the queue to mark as complete
   * @returns true if successful, false otherwise
   */
  public markQueueAsComplete(queueName: string): boolean {
    const queue = this.queueManager.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Cannot mark queue as complete: Queue ${queueName} does not exist`);
      return false;
    }

    queue.markAsComplete();
    this.logger.info(`Marked queue ${queueName} as complete`);
    return true;
  }

  /**
   * Reset a queue's completion state
   * @param queueName Name of the queue to reset
   * @returns true if successful, false otherwise
   */
  public resetQueueComplete(queueName: string): boolean {
    const queue = this.queueManager.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Cannot reset queue completion: Queue ${queueName} does not exist`);
      return false;
    }

    queue.resetComplete();
    this.logger.info(`Reset completion state for queue ${queueName}`);
    return true;
  }

  /**
   * Create a webhook subscriber that will send HTTP notifications
   * @param webhookUrl The URL to send webhook notifications to
   * @returns A subscriber that forwards events to the webhook URL
   */
  public createWebhookSubscriber(webhookUrl: string): QueueSubscriber<any> {
    return {
      onEvent: async (event) => {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
          });
          
          if (!response.ok) {
            this.logger.error(`Failed to send webhook notification: ${response.status} ${response.statusText}`);
          } else {
            this.logger.debug(`Webhook notification sent to ${webhookUrl} for event ${event.type}`);
          }
        } catch (error) {
          this.logger.error(`Error sending webhook notification:`, error);
        }
      }
    };
  }

  /**
   * Create a console subscriber for testing/debugging
   * @returns A subscriber that logs events to the console
   */
  public createConsoleSubscriber(): QueueSubscriber<any> {
    return {
      onEvent: (event) => {
        this.logger.info(`[${event.queueName}] Event: ${event.type}`, event.data || '');
      }
    };
  }
}