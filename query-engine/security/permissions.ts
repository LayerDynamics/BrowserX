/**
 * Permission system for query engine operations
 */

import { Permission } from "../types/execution.ts";
import { PermissionError } from "../errors/types.ts";

/**
 * Permission checker
 */
export class PermissionChecker {
  private grantedPermissions: Set<Permission>;

  constructor(permissions: Permission[] = []) {
    this.grantedPermissions = new Set(permissions);
  }

  /**
   * Check if permission is granted
   */
  has(permission: Permission): boolean {
    return this.grantedPermissions.has(permission);
  }

  /**
   * Grant permission
   */
  grant(permission: Permission): void {
    this.grantedPermissions.add(permission);
  }

  /**
   * Revoke permission
   */
  revoke(permission: Permission): void {
    this.grantedPermissions.delete(permission);
  }

  /**
   * Check if all permissions are granted
   */
  hasAll(permissions: Permission[]): boolean {
    return permissions.every((p) => this.has(p));
  }

  /**
   * Check if any permission is granted
   */
  hasAny(permissions: Permission[]): boolean {
    return permissions.some((p) => this.has(p));
  }

  /**
   * Require permission (throws if not granted)
   */
  require(permission: Permission, operation: string): void {
    if (!this.has(permission)) {
      throw new PermissionError(
        `Permission denied: ${operation} requires ${permission}`,
      );
    }
  }

  /**
   * Get all granted permissions
   */
  getGranted(): Permission[] {
    return Array.from(this.grantedPermissions);
  }

  /**
   * Clear all permissions
   */
  clear(): void {
    this.grantedPermissions.clear();
  }
}

/**
 * Default permission sets
 */
export const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  // Minimal permissions for read-only queries
  READONLY: [
    Permission.NAVIGATE_PUBLIC,
    Permission.READ_COOKIES,
    Permission.READ_STORAGE,
    Permission.DOM_QUERY,
    Permission.CACHE_RESPONSES,
  ],

  // Standard web automation permissions
  AUTOMATION: [
    Permission.NAVIGATE_PUBLIC,
    Permission.READ_COOKIES,
    Permission.WRITE_COOKIES,
    Permission.READ_STORAGE,
    Permission.WRITE_STORAGE,
    Permission.DOM_QUERY,
    Permission.CLICK,
    Permission.TYPE,
    Permission.SCREENSHOT,
    Permission.PDF,
    Permission.CACHE_RESPONSES,
  ],

  // Full permissions including private network and JS execution
  FULL: Object.values(Permission),
};
