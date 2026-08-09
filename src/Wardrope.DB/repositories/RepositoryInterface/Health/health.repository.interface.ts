export type DatabaseHealthStatus = 'connected' | 'disconnected';

export interface IHealthRepository {
  getDatabaseStatus(): DatabaseHealthStatus;
}
