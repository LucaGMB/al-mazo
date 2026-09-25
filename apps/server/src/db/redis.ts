import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisService {
  private client: Redis | null = null;
  private isConnected = false;

  public getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 3) return null; // stop retrying after 3 attempts
          return Math.min(times * 100, 1000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
      });

      this.client.on('error', () => {
        this.isConnected = false;
      });
    }

    return this.client;
  }

  public async connect(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.connect();
      return true;
    } catch {
      // In local dev/tests without Redis running, log gracefully
      return false;
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      if (!this.client || !this.isConnected) return null;
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (!this.client || !this.isConnected) return;
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch {
      // Gracefully continue
    }
  }

  public async del(key: string): Promise<void> {
    try {
      if (!this.client || !this.isConnected) return;
      await this.client.del(key);
    } catch {
      // Gracefully continue
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.client = null;
      this.isConnected = false;
    }
  }
}

export const redis = new RedisService();
