# Simple Queue System

A lightweight, TypeScript-based queue system with persistence, priority support, and batch processing capabilities.

## Features

- **In-memory Queue**: Fast, Map-based queue implementation
- **Priority Support**: Process important messages first
- **Persistence**: Save queue state to disk and recover on restart
- **Batch Processing**: Process multiple items at once
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

## License

[MIT](./LICENSE)