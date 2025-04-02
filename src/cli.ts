#!/usr/bin/env node
import { createAppConfig } from './config';
import { QueueService } from './services/QueueService';
import { CliInterface } from './cli/CliInterface';

// CLI entry point
async function startCli() {
  // Create configuration
  const config = createAppConfig();
  const logger = config.logger;
  
  try {
    logger.info('Simple Queue System CLI starting up');
    
    // Initialize services
    const queueService = new QueueService(config);
    await queueService.initialize();
    
    // Initialize CLI
    const cli = new CliInterface(config, queueService);
    cli.start();
    
    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      
      // Shutdown services
      await cli.shutdown();
      await queueService.shutdown();
      
      process.exit(0);
    });
    
    logger.info('Simple Queue System CLI ready');
  } catch (error) {
    logger.error('Error starting CLI', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Start the CLI application if this file is executed directly
if (require.main === module) {
  startCli();
}

export default startCli;