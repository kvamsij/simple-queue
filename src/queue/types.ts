export interface QueueItem<T> {
  id: string;
  data: T;
  addedAt: Date;
  priority?: number;
  processingAttempts?: number;
}

export interface QueueOptions {
  maxSize?: number;
  retryLimit?: number;
  priorityEnabled?: boolean;
  batchSize?: number; // Size of batch for batch notifications
}

export type QueueProcessor<T> = (item: QueueItem<T>) => Promise<boolean>;

// Queue event types for notification system
export type QueueEventType = 
  | 'batchReady'     // Triggered when queue reaches the batch size
  | 'queueComplete'  // Triggered when queue is explicitly marked as complete
  | 'itemAdded'      // New item was added to the queue
  | 'itemProcessed'  // Item was processed and completed
  | 'queueEmpty';    // Queue became empty

export interface QueueEvent<T> {
  type: QueueEventType;
  queueName: string;
  timestamp: Date;
  data?: {
    item?: QueueItem<T>;
    batchSize?: number;
    remainingItems?: number;
    itemsSinceLastNotification?: number;
  };
}

export interface QueueSubscriber<T> {
  onEvent(event: QueueEvent<T>): void;
}

export interface NotificationOptions {
  eventTypes?: QueueEventType[];
  filterFn?: <T>(event: QueueEvent<T>) => boolean;
}