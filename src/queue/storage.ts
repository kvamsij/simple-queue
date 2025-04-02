import { QueueItem } from './types';
import * as fs from 'fs';
import * as path from 'path';

export interface StorageAdapter<T> {
  save(items: Map<string, QueueItem<T>>, processing: Set<string>): Promise<void>;
  load(): Promise<{ items: Map<string, QueueItem<T>>, processing: Set<string> }>;
}

export class FileStorageAdapter<T> implements StorageAdapter<T> {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    // Create directory if it doesn't exist
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async save(items: Map<string, QueueItem<T>>, processing: Set<string>): Promise<void> {
    const data = {
      items: Array.from(items.entries()),
      processing: Array.from(processing.values())
    };

    return new Promise((resolve, reject) => {
      fs.writeFile(this.filePath, JSON.stringify(data), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async load(): Promise<{ items: Map<string, QueueItem<T>>, processing: Set<string> }> {
    if (!fs.existsSync(this.filePath)) {
      return {
        items: new Map<string, QueueItem<T>>(),
        processing: new Set<string>()
      };
    }

    return new Promise((resolve, reject) => {
      fs.readFile(this.filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          
          // Convert dates from string back to Date objects
          const items = new Map<string, QueueItem<T>>(
            parsed.items.map(([key, value]: [string, any]) => {
              return [key, { ...value, addedAt: new Date(value.addedAt) }];
            })
          );
          
          const processing = new Set<string>(parsed.processing);
          
          resolve({ items, processing });
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}