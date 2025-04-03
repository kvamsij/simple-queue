import { AppConfig } from '../config';
import { QueueService } from '../services/QueueService';
import * as fs from 'fs';

// Interface for all commands
export interface Command {
  execute(args: string[]): Promise<void>;
}

// Command handler that routes commands to their implementations
export class CommandHandler {
  private commands: Map<string, Command> = new Map();
  private queueManager;
  private logger;

  constructor(
    private config: AppConfig,
    private queueService: QueueService
  ) {
    this.logger = config.logger;
    this.queueManager = queueService.getQueueManager();
    this.registerCommands();
  }

  private registerCommands(): void {
    // Register all available commands
    this.commands.set('help', this.createHelpCommand());
    this.commands.set('list', this.createListCommand());
    this.commands.set('add', this.createAddCommand());
    this.commands.set('addjson', this.createAddJsonCommand());
    this.commands.set('get', this.createGetCommand());
    this.commands.set('getmany', this.createGetManyCommand());
    this.commands.set('peek', this.createPeekCommand());
    this.commands.set('browse', this.createBrowseCommand());
    this.commands.set('complete', this.createCompleteCommand());
    this.commands.set('completemany', this.createCompleteManyCommand());
    this.commands.set('retry', this.createRetryCommand());
    this.commands.set('retrymany', this.createRetryManyCommand());
    this.commands.set('size', this.createSizeCommand());
    this.commands.set('save', this.createSaveCommand());
    this.commands.set('exit', this.createExitCommand());
    
    // Add notification system commands
    this.commands.set('subscribe', this.createSubscribeCommand());
    this.commands.set('webhook', this.createWebhookCommand());
    this.commands.set('complete', this.createCompleteQueueCommand());
    this.commands.set('listen', this.createListenCommand());
  }

  public async executeCommand(commandName: string, args: string[]): Promise<void> {
    const command = this.commands.get(commandName);
    
    if (!command) {
      this.logger.error(`Unknown command: ${commandName}. Type "help" for available commands.`);
      return;
    }
    
    await command.execute(args);
  }

  // Helper function to parse JSON input (either direct string or from file)
  private parseJsonInput(input: string): any {
    // Check if input is a file path
    if (input.startsWith('@') && fs.existsSync(input.substring(1))) {
      const filePath = input.substring(1);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent);
    }
    
    // Otherwise parse as direct JSON string
    return JSON.parse(input);
  }

  // Command factory methods
  private createHelpCommand(): Command {
    return {
      execute: async () => {
        console.log('\nAvailable commands:');
        console.log('  help                - Show this help message');
        console.log('  list                - List all available queues');
        console.log('  add <queue> <msg> [priority] - Add a simple message to a queue');
        console.log('  addjson <queue> <json-string> [priority] - Add a JSON message to a queue');
        console.log('  addjson <queue> @/path/to/file.json [priority] - Add JSON from a file');
        console.log('  get <queue>         - Retrieve the next item from a queue');
        console.log('  getmany <queue> <count> - Retrieve multiple items at once');
        console.log('  peek <queue>        - View the next item without removing it');
        console.log('  browse <queue> [limit] - List all items in a queue');
        console.log('  complete <queue> <id> - Mark an item as completed and remove it');
        console.log('  completemany <queue> <id1,id2,...> - Complete multiple items at once');
        console.log('  retry <queue> <id>  - Mark an item for retry if processing failed');
        console.log('  retrymany <queue> <id1,id2,...> - Retry multiple items at once');
        console.log('  size <queue>        - Show the number of items in a queue');
        console.log('  save                - Save all queues to disk');
        console.log('  subscribe <queue> [events] - Subscribe to queue events in console');
        console.log('  webhook <queue> <url> [events] - Create webhook subscription');
        console.log('  complete <queue>            - Mark a queue as complete (triggers notification)');
        console.log('  listen <queue> [events]     - Listen to queue events in console');
        console.log('  exit                - Save all queues and exit\n');
      }
    };
  }

  private createListCommand(): Command {
    return {
      execute: async () => {
        const queues = this.queueManager.listQueues();
        this.logger.info('Available queues:', queues);
      }
    };
  }

  private createAddCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 2) {
          this.logger.error('Usage: add <queue> <message> [priority]');
          return;
        }
        
        const queueName = args[0];
        const message = args[1];
        const priority = args[2] ? parseInt(args[2], 10) : 0;
        
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        if (queueName === 'messages') {
          queue.enqueue({ content: message }, priority);
          this.logger.info(`Added message to queue ${queueName} with priority ${priority}`);
        } else if (queueName === 'tasks') {
          queue.enqueue({ name: message, params: { createdAt: new Date() } }, priority);
          this.logger.info(`Added task to queue ${queueName} with priority ${priority}`);
        } else {
          this.logger.error(`Queue ${queueName} does not support simple messages`);
        }
      }
    };
  }

  private createAddJsonCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 2) {
          this.logger.error('Usage: addjson <queue> <json-string> [priority]');
          this.logger.error('       addjson <queue> @/path/to/file.json [priority]');
          return;
        }
        
        const queueName = args[0];
        const jsonInput = args[1];
        const priority = args[2] ? parseInt(args[2], 10) : 0;
        
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        try {
          // Parse the JSON input (either direct string or from file if starts with @)
          const jsonData = this.parseJsonInput(jsonInput);
          queue.enqueue(jsonData, priority);
          this.logger.info(`Added JSON message to queue ${queueName} with priority ${priority}`);
        } catch (error) {
          this.logger.error('Invalid JSON format or file not found', error instanceof Error ? error.message : error);
        }
      }
    };
  }

  private createGetCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 1) {
          this.logger.error('Usage: get <queue>');
          return;
        }
        
        const queueName = args[0];
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        const item = queue.dequeue();
        if (item) {
          this.logger.info(`Retrieved item from queue ${queueName}:`, item);
          this.logger.info('Remember to call "complete" or "retry" with the item ID when finished processing');
        } else {
          this.logger.info(`No items available in queue ${queueName}`);
        }
      }
    };
  }

  private createGetManyCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 2) {
          this.logger.error('Usage: getmany <queue> <count>');
          return;
        }
        
        const queueName = args[0];
        const count = parseInt(args[1], 10);
        
        if (isNaN(count) || count <= 0) {
          this.logger.error('Count must be a positive number');
          return;
        }
        
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        const items = queue.dequeueMany(count);
        if (items.length > 0) {
          this.logger.info(`Retrieved ${items.length} items from queue ${queueName}:`);
          const itemIds = items.map(item => item.id);
          this.logger.info(`Item IDs: ${itemIds.join(', ')}`);
          items.forEach((item, index) => {
            this.logger.info(`Item ${index + 1}/${items.length} - ID: ${item.id}`);
            this.logger.info(`  Data:`, item.data);
          });
          this.logger.info('Use "completemany" or "retrymany" with comma-separated IDs when finished processing');
        } else {
          this.logger.info(`No items available in queue ${queueName}`);
        }
      }
    };
  }

  private createPeekCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 1) {
          this.logger.error('Usage: peek <queue>');
          return;
        }
        
        const queueName = args[0];
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        const item = queue.peek();
        if (item) {
          this.logger.info(`Next item in queue ${queueName} (without removing):`, item);
        } else {
          this.logger.info(`No items available in queue ${queueName}`);
        }
      }
    };
  }

  private createBrowseCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 1) {
          this.logger.error('Usage: browse <queue> [limit]');
          return;
        }
        
        const queueName = args[0];
        const limit = args[1] ? parseInt(args[1], 10) : 10;
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        const items = queue.browse(limit);
        if (items.length > 0) {
          this.logger.info(`Items in queue ${queueName} (${items.length} items):`);
          items.forEach((item, index) => {
            const status = queue['processing'].has(item.id) ? 'PROCESSING' : 'PENDING';
            this.logger.info(`${index + 1}. [${status}] ID: ${item.id}, Priority: ${item.priority}, Added: ${item.addedAt.toISOString()}`);
            this.logger.info(`   Data:`, item.data);
          });
        } else {
          this.logger.info(`No items in queue ${queueName}`);
        }
      }
    };
  }

  private createCompleteCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 2) {
          this.logger.error('Usage: complete <queue> <itemId>');
          return;
        }
        
        const queueName = args[0];
        const itemId = args[1];
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        const completed = queue.complete(itemId);
        if (completed) {
          this.logger.info(`Item ${itemId} marked as completed and removed from queue`);
        } else {
          this.logger.error(`Failed to complete item ${itemId}. It might not be in processing state`);
        }
      }
    };
  }

  private createCompleteManyCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 2) {
          this.logger.error('Usage: completemany <queue> <itemId1,itemId2,...>');
          return;
        }
        
        const queueName = args[0];
        const itemIds = args[1].split(',').map(id => id.trim());
        
        if (itemIds.length === 0) {
          this.logger.error('No item IDs provided');
          return;
        }
        
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        const result = queue.completeMany(itemIds);
        this.logger.info(`Batch complete operation: ${result.succeeded} succeeded, ${result.failed} failed`);
      }
    };
  }

  private createRetryCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 2) {
          this.logger.error('Usage: retry <queue> <itemId>');
          return;
        }
        
        const queueName = args[0];
        const itemId = args[1];
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        const retried = queue.retry(itemId);
        if (retried) {
          this.logger.info(`Item ${itemId} marked for retry`);
        } else {
          this.logger.error(`Failed to retry item ${itemId}. It might have exceeded retry limit or is not in processing state`);
        }
      }
    };
  }

  private createRetryManyCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 2) {
          this.logger.error('Usage: retrymany <queue> <itemId1,itemId2,...>');
          return;
        }
        
        const queueName = args[0];
        const itemIds = args[1].split(',').map(id => id.trim());
        
        if (itemIds.length === 0) {
          this.logger.error('No item IDs provided');
          return;
        }
        
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        const result = queue.retryMany(itemIds);
        this.logger.info(`Batch retry operation: ${result.succeeded} succeeded, ${result.failed} failed`);
      }
    };
  }

  private createSizeCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 1) {
          this.logger.error('Usage: size <queue>');
          return;
        }
        
        const queueName = args[0];
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        this.logger.info(`Queue ${queueName} has ${queue.size()} items`);
      }
    };
  }

  private createSaveCommand(): Command {
    return {
      execute: async () => {
        try {
          await this.queueManager.saveAllQueues();
          this.logger.info('All queues saved successfully');
        } catch (error) {
          this.logger.error('Error saving queues', error);
        }
      }
    };
  }

  private createExitCommand(): Command {
    return {
      execute: async () => {
        try {
          await this.queueManager.saveAllQueues();
          this.logger.info('All queues saved successfully');
        } catch (error) {
          this.logger.error('Error saving queues', error);
        }
        
        // Exit process
        this.logger.info('Exiting application...');
        process.exit(0);
      }
    };
  }

  private createSubscribeCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 1) {
          this.logger.error('Usage: subscribe <queueName> [eventType1,eventType2,...]');
          return;
        }
        
        const queueName = args[0];
        const eventTypes = args.length > 1 ? args[1].split(',') : undefined;
        
        try {
          // Create a console subscriber for demonstration
          const consoleSubscriber = {
            onEvent: (event: any) => {
              this.logger.info(`[${event.queueName}] Event: ${event.type}`, event.data || '');
            }
          };
          
          const success = this.queueService.subscribeToQueue(queueName, consoleSubscriber, eventTypes as any);
          
          if (success) {
            this.logger.info(`Subscribed to events from queue ${queueName}`);
            if (eventTypes) {
              this.logger.info(`Filtering events: ${eventTypes.join(', ')}`);
            }
            this.logger.info(`(Events will appear in this console. Use Ctrl+C to stop listening)`);
          } else {
            this.logger.error(`Failed to subscribe to queue ${queueName}`);
          }
        } catch (error) {
          this.logger.error('Failed to subscribe to queue events', error);
        }
      }
    };
  }

  private createWebhookCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 2) {
          this.logger.error('Usage: webhook <queueName> <webhookUrl> [eventType1,eventType2,...]');
          return;
        }
        
        const queueName = args[0];
        const webhookUrl = args[1];
        const eventTypes = args.length > 2 ? args[2].split(',') : undefined;
        
        try {
          const success = this.queueService.createWebhookSubscription(queueName, webhookUrl, eventTypes as any);
          
          if (success) {
            this.logger.info(`Created webhook subscription for queue ${queueName} to ${webhookUrl}`);
            if (eventTypes) {
              this.logger.info(`Filtering events: ${eventTypes.join(', ')}`);
            }
          } else {
            this.logger.error(`Failed to create webhook subscription`);
          }
        } catch (error) {
          this.logger.error('Failed to create webhook subscription', error);
        }
      }
    };
  }

  private createCompleteQueueCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 1) {
          this.logger.error('Usage: complete <queueName>');
          return;
        }
        
        const queueName = args[0];
        
        try {
          const success = this.queueService.markQueueAsComplete(queueName);
          
          if (success) {
            this.logger.info(`Marked queue ${queueName} as complete`);
            this.logger.info(`Any remaining items will trigger a queueComplete notification`);
          } else {
            this.logger.error(`Failed to mark queue ${queueName} as complete`);
          }
        } catch (error) {
          this.logger.error('Failed to mark queue as complete', error);
        }
      }
    };
  }

  private createListenCommand(): Command {
    return {
      execute: async (args: string[]) => {
        if (args.length < 1) {
          this.logger.error('Usage: listen <queueName> [eventType1,eventType2,...]');
          return;
        }
        
        const queueName = args[0];
        const eventTypes = args.length > 1 ? args[1].split(',') : undefined;
        
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          this.logger.error(`Queue ${queueName} does not exist`);
          return;
        }
        
        // Create a console subscriber for demonstration
        const notificationService = this.queueService.getNotificationService();
        const consoleSubscriber = notificationService.createConsoleSubscriber();
        
        const success = notificationService.subscribeToQueue(queueName, consoleSubscriber, {
          eventTypes: eventTypes as any
        });
        
        if (success) {
          this.logger.info(`Listening for events from queue ${queueName}`);
          if (eventTypes) {
            this.logger.info(`Filtering events: ${eventTypes.join(', ')}`);
          }
          this.logger.info(`(Events will appear in this console. Type "stoplisten" or use Ctrl+C to stop listening)`);
        } else {
          this.logger.error(`Failed to listen to queue ${queueName}`);
        }
      }
    };
  }
}