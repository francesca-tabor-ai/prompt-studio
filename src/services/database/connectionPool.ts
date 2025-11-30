import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
}

class ConnectionPool {
  private static instance: ConnectionPool;
  private connections: SupabaseClient[] = [];
  private activeConnections: Set<SupabaseClient> = new Set();
  private config: PoolConfig;

  private constructor(config?: Partial<PoolConfig>) {
    this.config = {
      minConnections: config?.minConnections || 2,
      maxConnections: config?.maxConnections || 10,
      idleTimeout: config?.idleTimeout || 30000,
      connectionTimeout: config?.connectionTimeout || 5000,
    };

    this.initialize();
    this.startMonitoring();
  }

  static getInstance(config?: Partial<PoolConfig>): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool(config);
    }
    return ConnectionPool.instance;
  }

  private initialize(): void {
    for (let i = 0; i < this.config.minConnections; i++) {
      this.createConnection();
    }
  }

  private createConnection(): SupabaseClient {
    const client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    this.connections.push(client);
    return client;
  }

  async getConnection(): Promise<SupabaseClient> {
    const availableConnection = this.connections.find(
      (conn) => !this.activeConnections.has(conn)
    );

    if (availableConnection) {
      this.activeConnections.add(availableConnection);
      return availableConnection;
    }

    if (this.connections.length < this.config.maxConnections) {
      const newConnection = this.createConnection();
      this.activeConnections.add(newConnection);
      return newConnection;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      const interval = setInterval(() => {
        const conn = this.connections.find(
          (c) => !this.activeConnections.has(c)
        );

        if (conn) {
          clearTimeout(timeout);
          clearInterval(interval);
          this.activeConnections.add(conn);
          resolve(conn);
        }
      }, 100);
    });
  }

  releaseConnection(connection: SupabaseClient): void {
    this.activeConnections.delete(connection);
  }

  async executeQuery<T>(
    queryFn: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    const connection = await this.getConnection();

    try {
      const result = await queryFn(connection);
      return result;
    } finally {
      this.releaseConnection(connection);
    }
  }

  getStats(): {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  } {
    return {
      total: this.connections.length,
      active: this.activeConnections.size,
      idle: this.connections.length - this.activeConnections.size,
      waiting: 0,
    };
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.logPoolStats();
    }, 60000);
  }

  private async logPoolStats(): Promise<void> {
    const stats = this.getStats();

    try {
      const { data: existingClient } = await createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
        .from('connection_pool_stats')
        .insert({
          total_connections: stats.total,
          active_connections: stats.active,
          idle_connections: stats.idle,
          waiting_connections: stats.waiting,
        })
        .select()
        .single();
    } catch (error) {
      console.error('Failed to log pool stats:', error);
    }
  }

  async drainPool(): Promise<void> {
    while (this.activeConnections.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

export const connectionPool = ConnectionPool.getInstance({
  minConnections: 5,
  maxConnections: 20,
  idleTimeout: 30000,
  connectionTimeout: 5000,
});
