import Queue from './Queue';
import { QueueOptions } from './types';
import { FileStorageAdapter, StorageAdapter } from './storage';
import path from 'path';

export default class QueueManager {
  private queues: Map<string, Queue<any>> = new Map();
  private storageDir?: string;
  
  constructor(storageDir?: string) {
    this.storageDir = storageDir;
  }
  
  public createQueue<T>(name: string, options?: QueueOptions): Queue<T> {
    if (this.queues.has(name)) {
      throw new Error(`Queue with name ${name} already exists`);
    }
    
    const queue = new Queue<T>(options);
    
    // Set up storage if we have a storage directory
    if (this.storageDir) {
      const storageAdapter = new FileStorageAdapter<T>(
        path.join(this.storageDir, `${name}.json`)
      );
      queue.setStorageAdapter(storageAdapter);
      
      // Try to load from storage
      queue.loadFromStorage().catch(() => {
        // If loading fails, it's probably a new queue, so ignore
      });
    }
    
    this.queues.set(name, queue);
    return queue;
  }
  
  public async saveAllQueues(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const queue of this.queues.values()) {
      try {
        promises.push(queue.saveToStorage());
      } catch (error) {
        // Queue might not have storage configured, ignore
      }
    }
    
    await Promise.all(promises);
  }
  
  public getQueue<T>(name: string): Queue<T> | undefined {
    return this.queues.get(name) as Queue<T> | undefined;
  }
  
  public removeQueue(name: string): boolean {
    return this.queues.delete(name);
  }
  
  public listQueues(): string[] {
    return Array.from(this.queues.keys());
  }
}