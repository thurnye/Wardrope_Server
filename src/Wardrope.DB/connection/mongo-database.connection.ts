import { Db, MongoClient } from 'mongodb';

export class MongoDatabaseConnection {
  private client: MongoClient | null = null;
  private database: Db | null = null;
  private connected = false;

  constructor(
    private readonly uri: string,
    private readonly databaseName: string,
  ) {}

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const client = new MongoClient(this.uri, {
      maxPoolSize: 20,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 10_000,
    });

    try {
      await client.connect();
      const database = client.db(this.databaseName);
      await database.command({ ping: 1 });

      this.client = client;
      this.database = database;
      this.connected = true;
    } catch (error) {
      await client.close().catch(() => undefined);
      throw error;
    }
  }

  getDatabase(): Db {
    if (!this.database || !this.connected) {
      throw new Error('MongoDB is not connected.');
    }

    return this.database;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }

    this.client = null;
    this.database = null;
    this.connected = false;
  }
}
