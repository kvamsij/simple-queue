# Usage Examples

This document provides specific examples for common use cases with the Simple Queue System.

## Email Queue Example

Creating a queue for sending emails:

```typescript
import { createQueueManager } from 'simple-queue';

interface EmailTask {
  to: string;
  subject: string;
  body: string;
  attachments?: string[];
  attempts?: number;
}

// Setup queue manager with persistence
const queueManager = createQueueManager('./email-queue-data');

// Create email queue
const emailQueue = queueManager.createQueue<EmailTask>('emails', {
  priorityEnabled: true,
  maxSize: 1000,
  retryLimit: 5
});

// Add email processor
emailQueue.registerProcessor(async (item) => {
  try {
    console.log(`Sending email to ${item.data.to}`);
    // Here you would integrate with your email sending library
    // e.g., nodemailer, sendgrid, etc.
    
    // For demo, just log the email
    console.log(`Subject: ${item.data.subject}`);
    console.log(`Body: ${item.data.body}`);
    
    // Simulate successful sending
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log(`Email to ${item.data.to} sent successfully`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${item.data.to}:`, error);
    return false; // Will trigger retry mechanism
  }
});

// Function to add emails to queue
function scheduleEmail(email: EmailTask, priority: number = 0) {
  const id = emailQueue.enqueue(email, priority);
  console.log(`Email to ${email.to} scheduled with ID: ${id}`);
  return id;
}

// Start processing emails
setInterval(async () => {
  await emailQueue.processNext();
}, 500);

// Add some test emails
scheduleEmail({
  to: 'user@example.com',
  subject: 'Welcome to our service',
  body: 'Thank you for signing up!'
}, 10); // High priority

scheduleEmail({
  to: 'newsletter@example.com',
  subject: 'Weekly Newsletter',
  body: 'Here are the latest updates...',
  attachments: ['report.pdf']
}, 5); // Medium priority

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Saving email queue state...');
  await queueManager.saveAllQueues();
  process.exit(0);
});
```

## Job Processing System Example

Building a background job processing system:

```typescript
import { createQueueManager, QueueService } from 'simple-queue';
import * as fs from 'fs';

// Define job types
type JobType = 'image-resize' | 'data-export' | 'report-generation';

interface Job {
  id: string;
  type: JobType;
  data: any;
  createdAt: Date;
}

// Create job processing service
class JobProcessor {
  private queueManager;
  private isRunning = false;
  
  constructor(private storageDir: string) {
    this.queueManager = createQueueManager(storageDir);
    
    // Create job queues
    this.setupJobQueues();
  }
  
  private setupJobQueues() {
    // Create job queue
    const jobQueue = this.queueManager.createQueue<Job>('jobs', {
      priorityEnabled: true,
      maxSize: 10000,
      retryLimit: 3
    });
    
    // Register job processor
    jobQueue.registerProcessor(async (item) => {
      const job = item.data;
      console.log(`Processing job ${job.id} of type ${job.type}`);
      
      try {
        switch (job.type) {
          case 'image-resize':
            await this.processImageResizeJob(job);
            break;
          case 'data-export':
            await this.processDataExportJob(job);
            break;
          case 'report-generation':
            await this.processReportGenerationJob(job);
            break;
          default:
            console.warn(`Unknown job type: ${job.type}`);
            return false;
        }
        
        console.log(`Job ${job.id} completed successfully`);
        return true;
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        return false; // Will trigger retry
      }
    });
  }
  
  // Job-specific processing methods
  private async processImageResizeJob(job: Job): Promise<void> {
    console.log(`Resizing image: ${job.data.filename}`);
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  private async processDataExportJob(job: Job): Promise<void> {
    console.log(`Exporting data to: ${job.data.exportFormat}`);
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  private async processReportGenerationJob(job: Job): Promise<void> {
    console.log(`Generating report: ${job.data.reportName}`);
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // Public methods
  public submitJob(type: JobType, data: any, priority: number = 0): string {
    const job: Job = {
      id: `job-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type,
      data,
      createdAt: new Date()
    };
    
    const queue = this.queueManager.getQueue<Job>('jobs');
    if (!queue) {
      throw new Error('Job queue not initialized');
    }
    
    const jobId = queue.enqueue(job, priority);
    console.log(`Job ${job.id} of type ${type} submitted with priority ${priority}`);
    return job.id;
  }
  
  public start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Job processor started');
    
    // Start processing jobs
    const processJobs = async () => {
      if (!this.isRunning) return;
      
      const queue = this.queueManager.getQueue<Job>('jobs');
      if (queue) {
        await queue.processNext();
      }
      
      // Schedule next processing
      setTimeout(processJobs, 100);
    };
    
    processJobs();
  }
  
  public stop() {
    this.isRunning = false;
    console.log('Job processor stopped');
  }
  
  public async shutdown() {
    this.stop();
    await this.queueManager.saveAllQueues();
    console.log('Job processor shut down, state saved');
  }
}

// Usage example
const jobProcessor = new JobProcessor('./job-queue-data');
jobProcessor.start();

// Submit some example jobs
jobProcessor.submitJob('image-resize', { filename: 'photo.jpg', width: 800, height: 600 }, 10);
jobProcessor.submitJob('data-export', { format: 'CSV', tables: ['users', 'orders'] }, 5);
jobProcessor.submitJob('report-generation', { reportName: 'Monthly Sales', period: 'March 2025' }, 8);

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down job processor...');
  await jobProcessor.shutdown();
  process.exit(0);
});
```

## Distributed Task Queue Example

This example shows how to implement a distributed task queue with multiple workers:

```typescript
// worker.ts - Run multiple instances of this file
import { createQueueManager } from 'simple-queue';
import * as os from 'os';

// Worker configuration
const workerId = process.env.WORKER_ID || `worker-${os.hostname()}-${process.pid}`;
const sharedStorageDir = './shared-queue-data'; // Use a shared directory or database in real scenarios

console.log(`Starting worker ${workerId}`);

// Create queue manager with shared storage
const queueManager = createQueueManager(sharedStorageDir);

// Create or get the shared task queue
const taskQueue = queueManager.createQueue<any>('tasks', {
  priorityEnabled: true,
  maxSize: 10000,
  retryLimit: 3
});

// Worker processing function
async function processTask(task: any): Promise<boolean> {
  console.log(`[${workerId}] Processing task:`, task);
  
  // Simulate work
  const processingTime = 500 + Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  // 90% success rate for demonstration
  const success = Math.random() < 0.9;
  
  if (success) {
    console.log(`[${workerId}] Task completed successfully`);
  } else {
    console.log(`[${workerId}] Task failed`);
  }
  
  return success;
}

// Register task processor
taskQueue.registerProcessor(processTask);

// Start processing loop
let isRunning = true;
async function processingLoop() {
  while (isRunning) {
    try {
      const hasProcessed = await taskQueue.processNext();
      
      if (!hasProcessed) {
        // No tasks available, wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`[${workerId}] Error processing task:`, error);
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Start the processing loop
processingLoop();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(`[${workerId}] Shutting down...`);
  isRunning = false;
  
  // Save state before exiting
  try {
    await queueManager.saveAllQueues();
    console.log(`[${workerId}] State saved successfully`);
  } catch (error) {
    console.error(`[${workerId}] Error saving state:`, error);
  }
  
  process.exit(0);
});
```

```typescript
// producer.ts - Run this to add tasks to the queue
import { createQueueManager } from 'simple-queue';

const sharedStorageDir = './shared-queue-data'; // Same as worker

// Create queue manager with shared storage
const queueManager = createQueueManager(sharedStorageDir);

// Get the shared task queue
const taskQueue = queueManager.createQueue<any>('tasks');

// Function to add a task
function addTask(task: any, priority: number = 0): string {
  const id = taskQueue.enqueue(task, priority);
  console.log(`Added task with ID ${id} and priority ${priority}`);
  return id;
}

// Add some example tasks
for (let i = 0; i < 20; i++) {
  const priority = Math.floor(Math.random() * 10);
  addTask({
    id: `task-${i}`,
    type: ['calculation', 'io', 'network'][i % 3],
    data: {
      value: Math.random() * 100,
      timestamp: new Date()
    }
  }, priority);
}

// Save state
queueManager.saveAllQueues().then(() => {
  console.log('All tasks saved to queue');
  process.exit(0);
});
```