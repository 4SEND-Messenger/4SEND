import type { Message } from '../types/message';

interface QueueEntry {
  message: Message;
  retries: number;
  maxRetries: number;
  lastAttempt: number;
}

export class MessageRetryQueue {
  private pending = new Map<string, QueueEntry>();

  enqueue(message: Message): void {
    const id = message.tempId || message.id;
    this.pending.set(id, {
      message,
      retries: 0,
      maxRetries: 3,
      lastAttempt: Date.now(),
    });
  }

  dequeue(messageId: string): void {
    this.pending.delete(messageId);
  }

  async retry(messageId: string, sendFn: () => Promise<void>): Promise<boolean> {
    const entry = this.pending.get(messageId);
    if (!entry) return false;

    try {
      await sendFn();
      this.pending.delete(messageId);
      return true;
    } catch {
      entry.retries += 1;
      entry.lastAttempt = Date.now();
      if (entry.retries >= entry.maxRetries) {
        return false;
      }
      return false;
    }
  }

  get(messageId: string): QueueEntry | undefined {
    return this.pending.get(messageId);
  }
}

export const messageRetryQueue = new MessageRetryQueue();
