# API Usage Guide

The Simple Queue System can be used as a library in your TypeScript/JavaScript projects. This guide shows how to use the API for various scenarios.

## Installation

```bash
# Install as a dependency
npm install simple-queue

# or with yarn
yarn add simple-queue
```

## Basic Queue Operations

Here's how to perform basic queue operations:

```typescript
import { createQueue } from 'simple-queue';

// Create a queue
const queue = createQueue<{ task: string }>();

// Add items to the queue
const itemId = queue.enqueue({ task: 'Process something' }, 5); // with priority 5

// Get the next item from the queue
const item = queue.dequeue();
if (item) {
  console.log(`Processing task: ${item.data.task}`);
  
  // Mark as completed when done
  queue.complete(item.id);
}

// You can also peek at the next item without removing it
const nextItem = queue.peek();
console.log('Next item:', nextItem);

// Get the queue size
const size = queue.size();
console.log(`Queue has ${size} items`);
```

## Queue Manager with Persistence

For more advanced usage with persistence:

```typescript
import { createQueueManager } from 'simple-queue';

// Create a queue manager with storage directory
const manager = createQueueManager('./data');

// Create a queue
const taskQueue = manager.createQueue<{ name: string, data: any }>('tasks', {
  priorityEnabled: true,
  maxSize: 100,
  retryLimit: 3
});

// Add a processor
taskQueue.registerProcessor(async (item) => {
  console.log(`Processing task: ${item.data.name}`);
  // Do something with item.data
  return true; // true for success, false for failure
});

// Start processing the queue
setInterval(async () => {
  await taskQueue.processNext();
}, 1000);

// Add items to the queue
taskQueue.enqueue({ name: 'send-email', data: { to: 'user@example.com' } }, 10);

// List all available queues
const queues = manager.listQueues();
console.log('Available queues:', queues);

// Save all queues to disk
await manager.saveAllQueues();
```

## Full System Initialization

For a complete pre-configured system:

```typescript
import { initializeQueueSystem } from 'simple-queue';

async function main() {
  // Initialize with custom storage location
  const queueService = await initializeQueueSystem('./my-queue-data');
  
  // Get a specific queue
  const messageQueue = queueService.getQueueManager().getQueue('messages');
  
  // Add items
  messageQueue?.enqueue({ content: 'Important message' }, 10);
  
  // Graceful shutdown when done
  process.on('SIGINT', async () => {
    await queueService.shutdown();
    process.exit(0);
  });
}

main().catch(console.error);
```

## Working with Batch Operations

For processing multiple items at once:

```typescript
import { createQueue } from 'simple-queue';

const queue = createQueue<{ taskId: number, data: string }>();

// Add multiple items
for (let i = 0; i < 10; i++) {
  queue.enqueue({ taskId: i, data: `Task data ${i}` }, i);
}

// Get multiple items at once
const items = queue.dequeueMany(5);
console.log(`Retrieved ${items.length} items`);

// Process the items
const itemIds = items.map(item => item.id);

// Complete multiple items at once
const completeResult = queue.completeMany(itemIds);
console.log(`Completed: ${completeResult.succeeded}, Failed: ${completeResult.failed}`);

// Or retry multiple items at once
const retryResult = queue.retryMany(itemIds);
console.log(`Retried: ${retryResult.succeeded}, Failed: ${retryResult.failed}`);
```

## Queue Options

When creating queues, you can specify various options:

```typescript
import { createQueue } from 'simple-queue';

const queue = createQueue<any>({
  maxSize: 1000,        // Maximum number of items in the queue
  retryLimit: 3,        // Maximum number of retry attempts for failed items
  priorityEnabled: true // Enable priority-based processing
});
```

## Using Storage Adapters

You can customize storage for queues:

```typescript
import { Queue, FileStorageAdapter } from 'simple-queue';
import path from 'path';

// Create a queue
const queue = new Queue<{ data: string }>();

// Create and set a storage adapter
const storageAdapter = new FileStorageAdapter<{ data: string }>(
  path.join(__dirname, 'data', 'custom-queue.json')
);
queue.setStorageAdapter(storageAdapter);

// Load existing data (if any)
await queue.loadFromStorage();

// Use the queue
queue.enqueue({ data: 'Test' });

// Save to disk
await queue.saveToStorage();
```