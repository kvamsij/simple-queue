import Queue from './queue/Queue';
import QueueManager from './queue/QueueManager';
import { QueueItem, QueueOptions, QueueProcessor } from './queue/types';
import { FileStorageAdapter, StorageAdapter } from './queue/storage';
import { QueueService } from './services/QueueService';
import { createAppConfig } from './config';

// Export all classes and types for programmatic usage
export {
  Queue,
  QueueManager,
  QueueService,
  FileStorageAdapter,
  
  // Types
  QueueItem,
  QueueOptions,
  QueueProcessor,
  StorageAdapter
};

// Create and export factory functions for easy instantiation
export function createQueue<T>(options?: QueueOptions): Queue<T> {
  return new Queue<T>(options);
}

export function createQueueManager(storageDir?: string): QueueManager {
  return new QueueManager(storageDir);
}

export function createQueueService(): QueueService {
  const config = createAppConfig();
  return new QueueService(config);
}

// Initialize and return a fully configured queue service
export async function initializeQueueSystem(storageDir?: string): Promise<QueueService> {
  const config = createAppConfig();
  
  // Override storage directory if provided
  if (storageDir) {
    config.storageDir = storageDir;
  }
  
  const queueService = new QueueService(config);
  await queueService.initialize();
  
  return queueService;
}