// Main entry point for the library
// Re-export everything from the API module
export * from './api';

// Also export the CLI starter in case it's needed
import startCli from './cli';
export { startCli };