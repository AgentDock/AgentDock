// Mock implementation of @upstash/redis for Jest tests
export class Redis {
  constructor(config: any) {
    // Mock constructor
  }

  async get(key: string): Promise<string | null> {
    return null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return 0;
  }

  async exists(key: string): Promise<number> {
    return 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return 1;
  }

  async hdel(key: string, field: string): Promise<number> {
    return 1;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return {};
  }

  async keys(pattern: string): Promise<string[]> {
    return [];
  }

  async expire(key: string, seconds: number): Promise<number> {
    return 1;
  }
}

export default Redis;
