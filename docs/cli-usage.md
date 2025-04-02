# CLI Usage Guide

The Simple Queue System provides a powerful command-line interface for managing queues.

## Starting the CLI

```bash
# If installed globally
simple-queue

# If installed locally
npx simple-queue

# If running from the project directory
npm start
```

## Available Commands

| Command | Description |
|---------|-------------|
| `help` | Show available commands |
| `list` | List all available queues |
| `add <queue> <msg> [priority]` | Add a simple message to a queue |
| `addjson <queue> <json-string> [priority]` | Add a JSON message to a queue |
| `addjson <queue> @/path/to/file.json [priority]` | Add JSON from a file |
| `get <queue>` | Retrieve the next item from a queue |
| `getmany <queue> <count>` | Retrieve multiple items at once |
| `peek <queue>` | View the next item without removing it |
| `browse <queue> [limit]` | List all items in a queue |
| `complete <queue> <id>` | Mark an item as completed and remove it |
| `completemany <queue> <id1,id2,...>` | Complete multiple items at once |
| `retry <queue> <id>` | Mark an item for retry if processing failed |
| `retrymany <queue> <id1,id2,...>` | Retry multiple items at once |
| `size <queue>` | Show the number of items in a queue |
| `save` | Save all queues to disk |
| `exit` | Save all queues and exit |

## Example CLI Session

Here's a typical CLI session demonstrating key features:

```
> list
Available queues: messages, tasks, json

> add messages "Hello world" 5
Added message to queue messages with priority 5

> addjson json {"name":"John","email":"john@example.com"} 10
Added JSON message to queue json with priority 10

> get messages
Retrieved item from queue messages:
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  data: { content: "Hello world" },
  addedAt: "2025-04-02T21:00:00.000Z",
  priority: 5,
  processingAttempts: 0
}
Remember to call "complete" or "retry" with the item ID when finished processing

> complete messages 550e8400-e29b-41d4-a716-446655440000
Item 550e8400-e29b-41d4-a716-446655440000 marked as completed and removed from queue

> getmany json 3
Retrieved 3 items from queue json:
Item IDs: 123abc, 456def, 789ghi
Item 1/3 - ID: 123abc
  Data: { name: "John", email: "john@example.com" }
...

> completemany json 123abc,456def,789ghi
Batch complete operation: 3 succeeded, 0 failed

> save
All queues saved successfully

> exit
All queues saved successfully
Exiting application...
```

## Default Queue Types

The CLI comes with three pre-configured queues:

1. **messages** - For simple text messages (`{ content: string }`)
2. **tasks** - For task execution (`{ name: string, params: any }`)
3. **json** - For arbitrary JSON data (accepts any valid JSON)