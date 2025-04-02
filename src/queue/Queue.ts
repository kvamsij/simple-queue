import { QueueItem, QueueOptions, QueueProcessor } from './types';
import { v4 as uuidv4 } from 'uuid';
import { StorageAdapter } from './storage';

export default class Queue<T> {
  private items: Map<string, QueueItem<T>>;
  private processing: Set<string>;
  private options: Required<QueueOptions>;
  private processors: QueueProcessor<T>[] = [];
  private storageAdapter?: StorageAdapter<T>;
  
  constructor(options: QueueOptions = {}) {
    this.items = new Map();
    this.processing = new Set();
    this.options = {
      maxSize: options.maxSize || 1000,
      retryLimit: options.retryLimit || 3,
      priorityEnabled: options.priorityEnabled || false
    };
  }

  // Set a storage adapter for persistence
  public setStorageAdapter(adapter: StorageAdapter<T>): void {
    this.storageAdapter = adapter;
  }

  // Load queue state from storage
  public async loadFromStorage(): Promise<void> {
    if (!this.storageAdapter) {
      throw new Error('No storage adapter set');
    }

    const { items, processing } = await this.storageAdapter.load();
    this.items = items;
    this.processing = processing;
  }

  // Save queue state to storage
  public async saveToStorage(): Promise<void> {
    if (!this.storageAdapter) {
      throw new Error('No storage adapter set');
    }

    await this.storageAdapter.save(this.items, this.processing);
  }

  // Automatically save to storage after queue changes
  private async autoSave(): Promise<void> {
    if (this.storageAdapter) {
      await this.saveToStorage();
    }
  }

  public enqueue(data: T, priority: number = 0): string {
    if (this.items.size >= this.options.maxSize) {
      throw new Error('Queue is full');
    }

    const id = uuidv4();
    this.items.set(id, {
      id,
      data,
      addedAt: new Date(),
      priority: this.options.priorityEnabled ? priority : 0,
      processingAttempts: 0
    });

    // Auto-save if we have a storage adapter
    this.autoSave();

    return id;
  }

  public dequeue(): QueueItem<T> | null {
    if (this.items.size === 0) {
      return null;
    }

    // Get all items not currently being processed
    const availableItems = [...this.items.values()]
      .filter(item => !this.processing.has(item.id));
    
    if (availableItems.length === 0) {
      return null;
    }

    // Sort by priority if enabled, then by timestamp
    let nextItem: QueueItem<T>;
    if (this.options.priorityEnabled) {
      nextItem = availableItems
        .sort((a, b) => {
          // Higher priority first, then older items
          if (b.priority !== a.priority) {
            return b.priority! - a.priority!;
          }
          return a.addedAt.getTime() - b.addedAt.getTime();
        })[0];
    } else {
      // Just take the oldest item
      nextItem = availableItems
        .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())[0];
    }

    // Mark as processing
    this.processing.add(nextItem.id);
    
    return nextItem;
  }

  public complete(id: string): boolean {
    if (!this.processing.has(id)) {
      return false;
    }
    
    this.processing.delete(id);
    this.items.delete(id);
    
    // Auto-save if we have a storage adapter
    this.autoSave();
    
    return true;
  }

  public retry(id: string): boolean {
    if (!this.processing.has(id)) {
      return false;
    }
    
    const item = this.items.get(id);
    if (!item) {
      return false;
    }
    
    if (item.processingAttempts! >= this.options.retryLimit) {
      // Failed too many times, remove it
      this.processing.delete(id);
      this.items.delete(id);
      
      // Auto-save if we have a storage adapter
      this.autoSave();
      
      return false;
    }
    
    // Increment attempts and release for reprocessing
    item.processingAttempts = (item.processingAttempts || 0) + 1;
    this.processing.delete(id);
    
    // Auto-save if we have a storage adapter
    this.autoSave();
    
    return true;
  }

  public registerProcessor(processor: QueueProcessor<T>): void {
    this.processors.push(processor);
  }

  public async processNext(): Promise<boolean> {
    const item = this.dequeue();
    if (!item) {
      return false;
    }

    try {
      for (const processor of this.processors) {
        const success = await processor(item);
        if (success) {
          this.complete(item.id);
          return true;
        }
      }
      
      // If we get here, all processors failed
      this.retry(item.id);
      return false;
    } catch (error) {
      this.retry(item.id);
      return false;
    }
  }

  public size(): number {
    return this.items.size;
  }

  public clear(): void {
    this.items.clear();
    this.processing.clear();
    
    // Auto-save if we have a storage adapter
    this.autoSave();
  }

  /**
   * Peek at the next item in the queue without removing it or marking it as processing
   * @returns The next item that would be dequeued, or null if the queue is empty
   */
  public peek(): QueueItem<T> | null {
    if (this.items.size === 0) {
      return null;
    }

    // Get all items not currently being processed
    const availableItems = [...this.items.values()]
      .filter(item => !this.processing.has(item.id));
    
    if (availableItems.length === 0) {
      return null;
    }

    // Sort by priority if enabled, then by timestamp (same logic as dequeue)
    if (this.options.priorityEnabled) {
      return availableItems
        .sort((a, b) => {
          // Higher priority first, then older items
          if (b.priority !== a.priority) {
            return b.priority! - a.priority!;
          }
          return a.addedAt.getTime() - b.addedAt.getTime();
        })[0];
    } else {
      // Just take the oldest item
      return availableItems
        .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())[0];
    }
  }

  /**
   * Browse all items in the queue without removing them
   * @param limit Maximum number of items to return
   * @returns Array of queue items
   */
  public browse(limit: number = 10): QueueItem<T>[] {
    // Get all items and convert to array
    const allItems = [...this.items.values()];
    
    // Sort by processing status, priority, and timestamp
    return allItems
      .sort((a, b) => {
        // First non-processing items
        const aProcessing = this.processing.has(a.id) ? 1 : 0;
        const bProcessing = this.processing.has(b.id) ? 1 : 0;
        
        if (aProcessing !== bProcessing) {
          return aProcessing - bProcessing;
        }
        
        // Then by priority if enabled
        if (this.options.priorityEnabled && a.priority !== b.priority) {
          return (b.priority || 0) - (a.priority || 0);
        }
        
        // Then by timestamp (oldest first)
        return a.addedAt.getTime() - b.addedAt.getTime();
      })
      .slice(0, limit);
  }

  /**
   * Dequeue multiple items at once for batch processing
   * @param count Maximum number of items to dequeue
   * @returns Array of queue items that were dequeued
   */
  public dequeueMany(count: number): QueueItem<T>[] {
    const results: QueueItem<T>[] = [];
    
    for (let i = 0; i < count; i++) {
      const item = this.dequeue();
      if (item === null) {
        // No more items available
        break;
      }
      results.push(item);
    }
    
    return results;
  }

  /**
   * Complete multiple items at once
   * @param ids Array of item IDs to mark as completed
   * @returns Object with counts of successful and failed operations
   */
  public completeMany(ids: string[]): { succeeded: number; failed: number } {
    let succeeded = 0;
    let failed = 0;
    
    for (const id of ids) {
      if (this.complete(id)) {
        succeeded++;
      } else {
        failed++;
      }
    }
    
    return { succeeded, failed };
  }

  /**
   * Retry multiple items at once
   * @param ids Array of item IDs to mark for retry
   * @returns Object with counts of successful and failed operations
   */
  public retryMany(ids: string[]): { succeeded: number; failed: number } {
    let succeeded = 0;
    let failed = 0;
    
    for (const id of ids) {
      if (this.retry(id)) {
        succeeded++;
      } else {
        failed++;
      }
    }
    
    return { succeeded, failed };
  }
}