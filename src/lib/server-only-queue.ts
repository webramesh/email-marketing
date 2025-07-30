// This ensures the module can only be imported on the server
if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server side');
}

// Re-export everything from the queue module
export * from './queue';