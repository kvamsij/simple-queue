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
}

export type QueueProcessor<T> = (item: QueueItem<T>) => Promise<boolean>;