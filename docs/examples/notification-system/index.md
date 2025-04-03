# Notification System Example

This example demonstrates how to use Simple Queue's notification system to monitor queue events and receive updates through different channels.

## Understanding Queue Events

Simple Queue emits the following event types for notifications:

- `itemAdded` - Triggered when a new item is added to the queue
- `itemProcessed` - Triggered when an item is processed and completed
- `queueEmpty` - Triggered when a queue becomes empty
- `batchReady` - Triggered when queue reaches the batch size
- `queueComplete` - Triggered when queue is explicitly marked as complete

## In-Memory Publish/Subscribe Pattern

The notification system can be used to implement an in-memory publish/subscribe pattern for communication between different parts of your application:

### Basic In-Memory Subscriber

```typescript
import { Logger } from 'simple-queue/utils/logger';
import { QueueManager } from 'simple-queue/queue/QueueManager';
import { QueueNotificationService } from 'simple-queue/services/QueueNotificationService';
import { QueueEvent, QueueSubscriber } from 'simple-queue/queue/types';

// Initialize services
const logger = new Logger();
const queueManager = new QueueManager(logger);
const notificationService = new QueueNotificationService(logger, queueManager);

// Create a queue for the messaging channel
queueManager.createQueue('messaging-channel');

// Create an in-memory subscriber
class MessageProcessor implements QueueSubscriber<any> {
  onEvent(event: QueueEvent<any>): void {
    if (event.type === 'itemAdded' && event.data?.item) {
      const message = event.data.item.data;
      console.log(`Processing message: ${JSON.stringify(message)}`);
      
      // Handle the message based on its type
      if (message.type === 'USER_CREATED') {
        this.handleUserCreated(message.payload);
      } else if (message.type === 'ORDER_PLACED') {
        this.handleOrderPlaced(message.payload);
      }
    }
  }
  
  private handleUserCreated(userData: any): void {
    console.log(`New user created: ${userData.username}`);
    // Perform user-related operations
  }
  
  private handleOrderPlaced(orderData: any): void {
    console.log(`New order placed: ${orderData.orderId}`);
    // Process the order
  }
}

// Subscribe the message processor to the messaging channel
const messageProcessor = new MessageProcessor();
notificationService.subscribeToQueue('messaging-channel', messageProcessor, {
  eventTypes: ['itemAdded']
});
```

### Publishing Messages

Use the queue service to publish messages to subscribers:

```typescript
import { QueueService } from 'simple-queue/services/QueueService';

// Initialize the queue service
const queueService = new QueueService(logger, queueManager);

// Publish a message when a user is created
function publishUserCreated(userData: any): void {
  queueService.addToQueue('messaging-channel', {
    type: 'USER_CREATED',
    payload: userData,
    timestamp: new Date()
  });
}

// Publish a message when an order is placed
function publishOrderPlaced(orderData: any): void {
  queueService.addToQueue('messaging-channel', {
    type: 'ORDER_PLACED',
    payload: orderData,
    timestamp: new Date()
  });
}

// Usage examples
publishUserCreated({
  userId: '12345',
  username: 'johndoe',
  email: 'john@example.com'
});

publishOrderPlaced({
  orderId: 'ORD-9876',
  items: ['item1', 'item2'],
  total: 99.99
});
```

### Topic-Based Messaging

You can implement topic-based publish/subscribe by using multiple queues:

```typescript
// Create topic-specific queues
queueManager.createQueue('user-events');
queueManager.createQueue('order-events');
queueManager.createQueue('payment-events');

// Subscribe to specific topics
class UserEventHandler implements QueueSubscriber<any> {
  onEvent(event: QueueEvent<any>): void {
    if (event.type === 'itemAdded' && event.data?.item) {
      console.log(`Processing user event: ${JSON.stringify(event.data.item.data)}`);
      // Process user-related event
    }
  }
}

class OrderEventHandler implements QueueSubscriber<any> {
  onEvent(event: QueueEvent<any>): void {
    if (event.type === 'itemAdded' && event.data?.item) {
      console.log(`Processing order event: ${JSON.stringify(event.data.item.data)}`);
      // Process order-related event
    }
  }
}

// Subscribe handlers to their respective topics
const userHandler = new UserEventHandler();
const orderHandler = new OrderEventHandler();

notificationService.subscribeToQueue('user-events', userHandler);
notificationService.subscribeToQueue('order-events', orderHandler);

// Publish to specific topics
function publishToTopic(topic: string, eventData: any): void {
  queueService.addToQueue(topic, eventData);
}

// Usage
publishToTopic('user-events', { action: 'USER_LOGGED_IN', userId: '12345' });
publishToTopic('order-events', { action: 'ORDER_SHIPPED', orderId: 'ORD-9876' });
```

### Application Integration Example

This pattern can be used to integrate different components of your application:

```typescript
// Application with multiple modules communicating via the notification system
class AuthModule {
  constructor(private queueService: QueueService) {}
  
  login(username: string, password: string): void {
    // Authentication logic...
    
    // Publish login event
    this.queueService.addToQueue('auth-events', {
      type: 'USER_LOGGED_IN',
      user: { username, id: '12345' }
    });
  }
}

class CartModule {
  constructor(private notificationService: QueueNotificationService) {
    // Subscribe to auth events to update shopping cart
    this.notificationService.subscribeToQueue('auth-events', {
      onEvent: (event) => {
        if (event.type === 'itemAdded' && 
            event.data?.item?.data?.type === 'USER_LOGGED_IN') {
          this.loadUserCart(event.data.item.data.user.id);
        }
      }
    });
  }
  
  loadUserCart(userId: string): void {
    console.log(`Loading cart for user ${userId}`);
    // Cart loading logic...
  }
}

// Initialize modules
const authModule = new AuthModule(queueService);
const cartModule = new CartModule(notificationService);

// When a user logs in, the cart module will automatically load their cart
authModule.login('johndoe', 'password123');
```

## Console Monitoring

### Subscribe Command

The simplest way to monitor queue events is using the `subscribe` command which displays events in the console:

```bash
# Subscribe to all events for 'tasks' queue
subscribe tasks

# Subscribe to specific event types (comma-separated)
subscribe tasks itemAdded,itemProcessed
```

### Listen Command

The `listen` command is an alternative way to monitor queue events in the console:

```bash
# Listen to all events for 'orders' queue
listen orders

# Listen to specific event types
listen orders queueEmpty,queueComplete
```

## Webhook Notifications

For integrating with external systems, you can set up webhook notifications:

```bash
# Set up a webhook for all events on 'orders' queue
webhook orders http://localhost:3000/webhook

# Set up a webhook for specific event types
webhook orders http://localhost:3000/webhook itemAdded,itemProcessed
```

### Webhook Receiver Example

Here's a simple Express server example that can receive webhook notifications:

```javascript
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  const event = req.body;
  console.log(`Received event: ${event.type} from queue ${event.queueName}`);
  console.log('Event timestamp:', event.timestamp);
  console.log('Event data:', event.data);
  res.status(200).send('OK');
});

app.listen(3000, () => {
  console.log('Webhook receiver listening on port 3000');
});
```

## Queue Completion Notifications

You can mark a queue as complete to trigger notifications for any subscribers:

```bash
# Mark a queue as complete
complete tasks
```

This will emit a `queueComplete` event which can be useful for signaling that no more items will be added to a queue.

## Programmatic Usage

You can also use the notification system programmatically in your applications:

```typescript
import { Logger } from 'simple-queue/utils/logger';
import { QueueManager } from 'simple-queue/queue/QueueManager';
import { QueueNotificationService } from 'simple-queue/services/QueueNotificationService';

// Initialize services
const logger = new Logger();
const queueManager = new QueueManager(logger);
const notificationService = new QueueNotificationService(logger, queueManager);

// Create a simple console subscriber
const consoleSubscriber = notificationService.createConsoleSubscriber();

// Subscribe to all events from the 'tasks' queue
notificationService.subscribeToQueue('tasks', consoleSubscriber);

// Or subscribe with filtering options
notificationService.subscribeToQueue('tasks', consoleSubscriber, {
  eventTypes: ['itemAdded', 'queueComplete']
});

// Create a webhook subscriber
const webhookSubscriber = notificationService.createWebhookSubscriber('http://localhost:3000/webhook');

// Subscribe the webhook to the 'orders' queue
notificationService.subscribeToQueue('orders', webhookSubscriber);

// Subscribe to all queues at once
notificationService.subscribeToAllQueues(consoleSubscriber);

// Unsubscribe when done
notificationService.unsubscribeFromQueue('tasks', consoleSubscriber);
```

## Advanced Event Filtering

When using the programmatic API, you can apply custom filters to events:

```typescript
// Subscribe with a custom filter function
notificationService.subscribeToQueue('tasks', consoleSubscriber, {
  eventTypes: ['itemAdded'],
  filterFn: (event) => {
    // Only receive notifications for high-priority items
    return event.data?.item?.priority && event.data.item.priority > 5;
  }
});
```

## Practical Use Cases

### Real-time Monitoring Dashboard

Use webhooks to send queue events to a web application that displays real-time queue stats.

### Email Notifications for Critical Events

Set up a webhook subscriber that sends email notifications when specific conditions occur:

```typescript
notificationService.subscribeToQueue('orders', {
  onEvent: (event) => {
    if (event.type === 'queueEmpty' && isBusinessHours()) {
      sendEmail('orders@example.com', 'Order queue is empty', 
        'All orders have been processed.');
    }
  }
}, { eventTypes: ['queueEmpty'] });
```

### Processing Status Reporting

Create a subscriber that tracks and reports on queue processing status:

```typescript
let processedCount = 0;
const startTime = Date.now();

notificationService.subscribeToQueue('tasks', {
  onEvent: (event) => {
    if (event.type === 'itemProcessed') {
      processedCount++;
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const rate = processedCount / elapsedSeconds;
      console.log(`Processed ${processedCount} items at ${rate.toFixed(2)} items/second`);
    }
  }
}, { eventTypes: ['itemProcessed'] });
```

This example demonstrates the flexibility of the Simple Queue notification system for monitoring and integrating with other systems.