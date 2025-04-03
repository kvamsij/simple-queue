import * as readline from 'readline';
import { AppConfig } from '../config';
import { QueueService } from '../services/QueueService';
import { CommandHandler } from '../commands/CommandHandler';

export class CliInterface {
  private rl: readline.Interface;
  private logger: AppConfig['logger'];
  private commandHandler: CommandHandler;
  private isRunning: boolean = false;

  constructor(
    private config: AppConfig,
    private queueService: QueueService
  ) {
    this.logger = config.logger;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.commandHandler = new CommandHandler(config, queueService);
  }

  public start(): void {
    this.isRunning = true;
    this.showHelp();
    
    // Handle command input
    this.rl.on('line', async (input) => {
      if (!this.isRunning) return;
      
      const args = input.trim().split(' ');
      const command = args[0].toLowerCase();
      
      try {
        await this.commandHandler.executeCommand(command, args.slice(1));
      } catch (error) {
        this.logger.error('Error executing command', error instanceof Error ? error.message : error);
      }
    });
  }
  
  public showHelp(): void {
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
    console.log('  complete <queue>    - Mark a queue as complete (triggers notification)');
    console.log('  listen <queue> [events] - Listen to queue events in console');
    console.log('  exit                - Save all queues and exit\n');
  }

  public async shutdown(): Promise<void> {
    this.isRunning = false;
    this.rl.close();
    this.logger.info('CLI interface shut down');
  }
}