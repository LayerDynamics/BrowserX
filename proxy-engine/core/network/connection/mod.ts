/**
 * Network Connection Module
 *
 * Re-exports connection management from core/connection
 */

export * from "../../connection/connection_manager.ts";
export type {
  ConnectionPoolConfig,
  PooledConnectionInfo,
} from "../../connection/connection_pool.ts";
export {
  ConnectionPool,
} from "../../connection/connection_pool.ts";
export * from "../../connection/health_check.ts";
