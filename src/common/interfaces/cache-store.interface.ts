export interface ICacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string | number, expiryMode: 'EX', time: number): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}
