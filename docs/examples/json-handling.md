# Working with JSON Messages

The Simple Queue System provides robust support for handling JSON messages. This document shows how to work with JSON messages in various scenarios.

## Adding JSON Messages

You can add JSON messages to queues using several methods:

### Using the API

```typescript
import { createQueueManager } from 'simple-queue';

// Create queue manager
const queueManager = createQueueManager('./data');

// Get or create the JSON queue
const jsonQueue = queueManager.createQueue<any>('json', {
  priorityEnabled: true,
  maxSize: 200
});

// Add a JSON object to the queue
const complexData = {
  user: {
    id: 123,
    name: 'John Doe',
    email: 'john@example.com',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  },
  metadata: {
    source: 'user-api',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  },
  permissions: ['read', 'write', 'admin']
};

// Add to queue with priority 10
const itemId = jsonQueue.enqueue(complexData, 10);
console.log(`Added JSON message with ID: ${itemId}`);

// Process the JSON message
const item = jsonQueue.dequeue();
if (item) {
  console.log('Dequeued JSON item:', item.data);
  console.log(`User name: ${item.data.user.name}`);
  console.log(`Permissions: ${item.data.permissions.join(', ')}`);
  
  // Mark as completed
  jsonQueue.complete(item.id);
}
```

### Using the CLI

When using the CLI, you can add JSON messages in two ways:

1. Direct JSON string:
   ```
   addjson json {"name":"John","age":30,"roles":["admin","editor"]} 5
   ```

2. From a JSON file:
   ```
   addjson json @/path/to/data.json 5
   ```

## Batch Processing JSON Messages

You can process multiple JSON messages at once:

```typescript
import { createQueueManager } from 'simple-queue';

// Create queue manager
const queueManager = createQueueManager('./data');

// Get or create the JSON queue
const jsonQueue = queueManager.createQueue<any>('json', {
  priorityEnabled: true
});

// Add several JSON messages
const messages = [
  { id: 1, type: 'notification', content: 'New message received' },
  { id: 2, type: 'alert', content: 'System update required', urgent: true },
  { id: 3, type: 'data', content: { values: [1, 2, 3, 4, 5], sum: 15 } },
  { id: 4, type: 'config', content: { settings: { debug: true, timeout: 30 } } },
  { id: 5, type: 'notification', content: 'Friend request received' }
];

// Add all messages to the queue
messages.forEach((msg, index) => {
  // Set priority based on type
  let priority = 0;
  if (msg.type === 'alert' || (msg as any).urgent) {
    priority = 10;
  } else if (msg.type === 'config') {
    priority = 5;
  }
  
  jsonQueue.enqueue(msg, priority);
});

// Dequeue multiple items at once
const batchSize = 3;
const items = jsonQueue.dequeueMany(batchSize);

console.log(`Dequeued ${items.length} items`);

// Process each item
items.forEach(item => {
  console.log(`Processing item ID: ${item.id}`);
  console.log(`Message type: ${item.data.type}`);
  console.log(`Content:`, item.data.content);
  console.log('---');
});

// Complete all items at once
const itemIds = items.map(item => item.id);
const result = jsonQueue.completeMany(itemIds);
console.log(`Completed: ${result.succeeded}, Failed: ${result.failed}`);
```

## Implementing a Configuration System

Here's an example of using JSON messages to implement a configuration system:

```typescript
import { createQueueManager } from 'simple-queue';
import * as fs from 'fs/promises';
import * as path from 'path';

// Define configuration types
interface ConfigItem {
  key: string;
  value: any;
  environment: string;
  lastUpdated: string;
  updatedBy: string;
}

// Create configuration service
class ConfigService {
  private queueManager;
  private configQueue;
  private configCache: Map<string, any> = new Map();
  
  constructor(private storageDir: string) {
    this.queueManager = createQueueManager(storageDir);
    this.configQueue = this.queueManager.createQueue<ConfigItem>('configuration', {
      priorityEnabled: false,
      maxSize: 1000
    });
    
    // Register processor for config changes
    this.configQueue.registerProcessor(async (item) => {
      try {
        const config = item.data;
        console.log(`Processing config update: ${config.key}`);
        
        // Update cache
        this.configCache.set(config.key, config.value);
        
        // Write to config file for persistence
        await this.writeConfigToFile(config);
        
        return true;
      } catch (error) {
        console.error('Error processing config update:', error);
        return false;
      }
    });
  }
  
  private async writeConfigToFile(config: ConfigItem): Promise<void> {
    const configDir = path.join(this.storageDir, 'configs');
    
    // Ensure directory exists
    try {
      await fs.mkdir(configDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }
    
    const filePath = path.join(configDir, `${config.key}.json`);
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`Config ${config.key} written to ${filePath}`);
  }
  
  public async loadConfigFromFile(key: string): Promise<ConfigItem | null> {
    try {
      const filePath = path.join(this.storageDir, 'configs', `${key}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const config = JSON.parse(data) as ConfigItem;
      
      // Update cache
      this.configCache.set(key, config.value);
      
      return config;
    } catch (error) {
      console.warn(`Config ${key} not found in storage`);
      return null;
    }
  }
  
  // Get configuration value
  public async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    // Check cache first
    if (this.configCache.has(key)) {
      return this.configCache.get(key) as T;
    }
    
    // Try to load from file
    const config = await this.loadConfigFromFile(key);
    if (config) {
      return config.value as T;
    }
    
    return defaultValue;
  }
  
  // Set configuration value
  public set(key: string, value: any, environment: string = 'default', user: string = 'system'): void {
    const configItem: ConfigItem = {
      key,
      value,
      environment,
      lastUpdated: new Date().toISOString(),
      updatedBy: user
    };
    
    // Add to queue for processing
    this.configQueue.enqueue(configItem);
    
    // Update cache immediately
    this.configCache.set(key, value);
  }
  
  // Start processing configuration updates
  public start(): void {
    setInterval(async () => {
      await this.configQueue.processNext();
    }, 100);
  }
  
  // Shutdown and save state
  public async shutdown(): Promise<void> {
    await this.queueManager.saveAllQueues();
  }
}

// Usage example
async function main() {
  const configService = new ConfigService('./config-data');
  configService.start();
  
  // Set some configuration values
  configService.set('app.name', 'My Awesome App');
  configService.set('app.version', '1.0.0');
  configService.set('logging.level', 'info');
  configService.set('database', {
    host: 'localhost',
    port: 5432,
    username: 'admin',
    password: 'secret',
    database: 'myapp'
  }, 'development', 'developer');
  
  // Get configuration values
  setTimeout(async () => {
    const appName = await configService.get<string>('app.name');
    console.log('App name:', appName);
    
    const dbConfig = await configService.get<any>('database');
    console.log('Database config:', dbConfig);
    
    // Update a configuration
    configService.set('logging.level', 'debug', 'development', 'admin');
    
    // Shutdown
    setTimeout(async () => {
      await configService.shutdown();
      console.log('Configuration service shut down');
      process.exit(0);
    }, 1000);
  }, 1000);
}

main().catch(console.error);
```