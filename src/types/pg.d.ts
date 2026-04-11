declare module 'pg' {
  export type PoolConfig = {
    connectionString?: string;
    max?: number;
  };

  export class Pool {
    constructor(config?: PoolConfig);
    query(queryText: string): Promise<unknown>;
    end(): Promise<void>;
  }
}
