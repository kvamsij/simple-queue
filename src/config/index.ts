import * as path from 'path';
import createLogger from '../utils/logger';

// Application configuration
export interface AppConfig {
  storageDir: string;
  logger: ReturnType<typeof createLogger>;
}

// Create and export the application configuration
export function createAppConfig(): AppConfig {
  return {
    storageDir: path.join(__dirname, '..', '..', 'data'),
    logger: createLogger('SimpleQueue')
  };
}