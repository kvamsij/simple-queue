# Simple Queue System

A lightweight, TypeScript-based queue system with persistence, priority support, and batch processing capabilities.

## Features

- **In-memory Queue**: Fast, Map-based queue implementation
- **Priority Support**: Process important messages first
- **Persistence**: Save queue state to disk and recover on restart
- **Batch Processing**: Process multiple items at once
- **Notification System**: Event-driven architecture for queue notifications
- **JSON Support**: Handle complex data structures
- **CLI Interface**: Simple command line interface for queue management
- **Retry Mechanism**: Automatic retry for failed processing
- **SOLID Design**: Maintainable architecture following software engineering best practices
- **Dual Usage**: Can be used as both a CLI tool and a programmatic library

## Installation

### As a Global CLI Tool

```bash
# Install globally
npm install -g simple-queue

# Run the CLI
simple-queue
```

### As a Library in Your Project

```bash
# Install as a dependency
npm install simple-queue
```

## Quick Start

### CLI Usage

```bash
# Add a message to the queue
add messages "Hello world" 5

# Add JSON data
addjson json {"name":"John","email":"john@example.com"} 10

# Process items
get messages
```

[Full CLI Documentation](./docs/cli-usage.md)

### Programmatic Usage

```typescript
import { createQueue, createQueueManager } from 'simple-queue';

// Basic queue operations
const queue = createQueue<{ task: string }>();
queue.enqueue({ task: 'Process something' }, 5);

// With persistence
const manager = createQueueManager('./data');
const taskQueue = manager.createQueue<any>('tasks');
```

[API Documentation](./docs/api-usage.md)

## Examples

- [Practical Examples](./docs/examples/practical-examples.md) - Email queue, job processing, distributed workers
- [JSON Handling](./docs/examples/json-handling.md) - Working with JSON messages and batch processing

### Notification System Example

```typescript
import { createQueueManager, QueueService } from 'simple-queue';

// Create a queue manager
const queueManager = createQueueManager('./data');

// Create a queue with batch notification (default batch size is 50)
const batchQueue = queueManager.createQueue<any>('batch-queue', {
  batchSize: 50 // Trigger notifications every 50 items
});

// Subscribe to batch notifications
const batchSubscriber = {
  onEvent: (event) => {
    if (event.type === 'batchReady') {
      console.log(`Batch ready in queue ${event.queueName}! Processing ${event.data?.batchSize} items...`);
      // Fetch and process batch of items
      const items = batchQueue.dequeueMany(event.data?.batchSize || 50);
      processItems(items);
    } else if (event.type === 'queueComplete') {
      console.log(`Queue ${event.queueName} is complete! Processing remaining ${event.data?.remainingItems} items...`);
      // Process final batch (might be smaller than batch size)
      const items = batchQueue.dequeueMany(event.data?.remainingItems || 0);
      processItems(items);
    }
  }
};

// Subscribe to the queue
batchQueue.subscribe(batchSubscriber);

// When done adding items, mark the queue as complete
batchQueue.markAsComplete();

function processItems(items) {
  // Process batch of items...
}
```

## Architecture

View the [System Architecture](./docs/architecture.md) diagrams to understand how the components interact.

## Project Structure

The project follows a clean, SOLID-based architecture:

```
src/
  ├── api.ts               - API exports for programmatic usage
  ├── cli.ts               - CLI entry point
  ├── index.ts             - Main library entry point
  ├── config/              - Configuration management
  ├── cli/                 - Command line interface
  ├── commands/            - Command implementations
  ├── services/            - Business logic services
  ├── queue/               - Core queue implementation
  └── utils/               - Utilities
```

## Development

### Running Tests

```bash
npm test
```

### Available NPM Scripts

- `npm run build` - Build the TypeScript code
- `npm start` - Run the CLI application
- `npm run dev` - Run in development mode with auto-restart
- `npm run watch` - Watch for file changes and restart
- `npm test` - Run tests

## CI/CD

This project uses GitHub Actions for continuous integration and continuous deployment:

### Continuous Integration

The CI workflow automatically runs on push to main/master branches and on pull requests:

- Runs tests across multiple Node.js versions (16.x, 18.x, 20.x)
- Verifies the build process
- Checks TypeScript types

### Continuous Deployment

The CD workflow automatically publishes to npm when a new GitHub release is created:

- Runs on new GitHub releases
- Executes tests and build
- Publishes the package to npm

### Setting Up NPM_TOKEN

To enable automated publishing to npm, you need to add your npm token as a GitHub secret:

1. Generate an npm access token:
   - Log in to npmjs.com
   - Go to your profile → Access Tokens
   - Create a new token with "Automation" type

2. Add the token to GitHub secrets:
   - Go to your GitHub repository
   - Navigate to Settings → Secrets and variables → Actions
   - Create a new repository secret named `NPM_TOKEN`
   - Paste your npm token as the value

## License

[MIT](./LICENSE)