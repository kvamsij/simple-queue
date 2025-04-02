import Queue from '../src/queue/Queue';

describe('Queue', () => {
  let queue: Queue<{ task: string }>;

  beforeEach(() => {
    queue = new Queue({ maxSize: 10, priorityEnabled: true });
  });

  test('should enqueue and dequeue items', () => {
    const id = queue.enqueue({ task: 'Test task' });
    expect(queue.size()).toBe(1);
    
    const item = queue.dequeue();
    expect(item).not.toBeNull();
    expect(item?.data.task).toBe('Test task');
    expect(queue.size()).toBe(1); // Still 1 because it's marked as processing
    
    queue.complete(id);
    expect(queue.size()).toBe(0);
  });

  test('should handle priorities correctly', () => {
    queue.enqueue({ task: 'Low priority' }, 1);
    queue.enqueue({ task: 'High priority' }, 10);
    queue.enqueue({ task: 'Medium priority' }, 5);
    
    const firstItem = queue.dequeue();
    expect(firstItem?.data.task).toBe('High priority');
    
    const secondItem = queue.dequeue();
    expect(secondItem?.data.task).toBe('Medium priority');
    
    const thirdItem = queue.dequeue();
    expect(thirdItem?.data.task).toBe('Low priority');
  });

  test('should handle retries', () => {
    const id = queue.enqueue({ task: 'Retry task' });
    queue.dequeue(); // Mark as processing
    
    expect(queue.retry(id)).toBe(true);
    
    const retriedItem = queue.dequeue();
    expect(retriedItem?.data.task).toBe('Retry task');
    expect(retriedItem?.processingAttempts).toBe(1);
  });

  test('should respect max retries', () => {
    const queue = new Queue<{ task: string }>({ retryLimit: 2 });
    const id = queue.enqueue({ task: 'Failing task' });
    
    queue.dequeue(); // First attempt
    queue.retry(id);
    
    queue.dequeue(); // Second attempt
    queue.retry(id);
    
    queue.dequeue(); // Third attempt - should hit retry limit
    expect(queue.retry(id)).toBe(false);
    expect(queue.size()).toBe(0); // Should be removed after retry limit
  });
});