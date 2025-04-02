# System Architecture

This document provides a visual representation of the Simple Queue System's architecture.

## Class Diagram

```mermaid
classDiagram
    %% Core Queue Classes
    class Queue {
        -Map items
        -Set processing
        -QueueOptions options
        -StorageAdapter storage
        +enqueue(data, priority) string
        +enqueueMany(dataItems, priorities) string[]
        +dequeue() QueueItem
        +dequeueMany(count) QueueItem[]
        +peek() QueueItem
        +complete(id) boolean
        +completeMany(ids) BatchResult
        +retry(id) boolean
        +retryMany(ids) BatchResult
        +size() number
        +browse(limit) QueueItem[]
        +registerProcessor(processor) void
        +processNext() Promise~boolean~
        +setStorageAdapter(adapter) void
        +loadFromStorage() Promise~void~
        +saveToStorage() Promise~void~
    }

    class QueueManager {
        -Map queues
        -string storageDir
        +createQueue(name, options) Queue
        +getQueue(name) Queue
        +listQueues() string[]
        +saveAllQueues() Promise~void~
        +loadAllQueues() Promise~void~
    }

    class QueueService {
        -QueueManager queueManager
        -Map processors
        +initialize() Promise~void~
        +getQueueManager() QueueManager
        +startProcessing(queueName) void
        +stopProcessing(queueName) void
        +shutdown() Promise~void~
    }

    %% Storage
    class StorageAdapter {
        <<interface>>
        +save(data) Promise~void~
        +load() Promise~QueueData~
    }

    class FileStorageAdapter {
        -string filePath
        +save(data) Promise~void~
        +load() Promise~QueueData~
    }

    %% CLI Components
    class CliInterface {
        -readline.Interface rl
        -CommandHandler commandHandler
        +start() void
        +showHelp() void
        +shutdown() Promise~void~
    }

    class CommandHandler {
        -Map commands
        -QueueManager queueManager
        +executeCommand(command, args) Promise~void~
    }

    class Command {
        <<interface>>
        +execute(args) Promise~void~
    }

    %% Configuration
    class AppConfig {
        +string storageDir
        +logger
    }

    %% API Exports
    class API {
        +createQueue() Queue
        +createQueueManager() QueueManager
        +createQueueService() QueueService
        +initializeQueueSystem() Promise~QueueService~
    }

    %% Relationships
    QueueManager --> Queue : creates and manages
    QueueService --> QueueManager : uses
    Queue --> StorageAdapter : uses
    FileStorageAdapter ..|> StorageAdapter : implements
    CliInterface --> CommandHandler : uses
    CommandHandler --> Command : contains many
    CommandHandler --> QueueManager : uses
    QueueService --> AppConfig : configured by
    CliInterface --> AppConfig : configured by
    API --> Queue : exports
    API --> QueueManager : exports
    API --> QueueService : exports
```

## Component Diagram

```mermaid
flowchart TB
    subgraph "CLI Layer"
        CLI[CLI Interface]
        CMD[Command Handler]
    end

    subgraph "Service Layer"
        QS[Queue Service]
    end

    subgraph "Core Layer"
        QM[Queue Manager]
        Q1[Messages Queue]
        Q2[Tasks Queue]
        Q3[JSON Queue]
    end

    subgraph "Storage Layer"
        FS[File Storage]
    end

    subgraph "API"
        AEXP[API Exports]
    end

    %% Connections
    CLI --> CMD
    CMD --> QS
    CMD --> QM
    QS --> QM
    QM --> Q1
    QM --> Q2
    QM --> Q3
    Q1 --> FS
    Q2 --> FS
    Q3 --> FS
    AEXP --> QS
    AEXP --> QM
    AEXP --> Q1
    AEXP --> Q2
    AEXP --> Q3

    %% External Systems
    User([User]) --> CLI
    App([Application]) --> AEXP
```

## Sequence Diagram: Message Processing

```mermaid
sequenceDiagram
    participant Client
    participant QueueManager
    participant Queue
    participant Processor
    participant Storage

    Client->>QueueManager: getQueue("messages")
    QueueManager-->>Client: messagesQueue
    Client->>Queue: enqueue({content: "Hello"}, 5)
    Queue-->>Client: itemId
    
    Note over Queue: Message stored with priority 5
    
    Queue->>Processor: processNext()
    activate Processor
    Processor-->>Queue: true (success) / false (failure)
    deactivate Processor
    
    alt Success
        Queue->>Queue: complete(itemId)
        Queue->>Storage: saveToStorage()
    else Failure
        Queue->>Queue: retry(itemId)
        Note over Queue: Increments retry count
    end
```

## Deployment Diagram

```mermaid
flowchart LR
    subgraph "Application Deployment"
        subgraph "As NPM Package"
            NPM[NPM Registry]
            INST[npm install simple-queue]
            NPM --> INST
            INST --> LIB[Library Import]
            LIB --> APP[Host Application]
        end
        
        subgraph "As CLI Tool"
            GLOBAL[npm install -g simple-queue]
            NPM --> GLOBAL
            GLOBAL --> CLITOOL[simple-queue Command]
            CLITOOL --> TERM[Terminal]
        end
    end
    
    DATA[(Persistent Storage)] --- APP
    DATA --- TERM
```