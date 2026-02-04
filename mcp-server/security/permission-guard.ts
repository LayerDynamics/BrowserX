/**
 * Permission Guard for MCP-level permission enforcement
 * Maps MCP tools to required BrowserX permissions
 */

import { Permission, DEFAULT_PERMISSIONS } from "@browserx/query-engine";

/**
 * Permission set types
 */
export type PermissionSet = "READONLY" | "AUTOMATION" | "FULL";

/**
 * Tool permission mapping
 */
const TOOL_PERMISSION_MAP: Record<string, Permission[]> = {
  // Query tools
  browserx_query: [], // Permissions handled by query engine itself
  browserx_query_explain: [],
  browserx_query_async: [],
  browserx_query_status: [],
  browserx_query_cancel: [],

  // Browser tools
  browser_navigate: [Permission.NAVIGATE_PUBLIC],
  browser_click: [Permission.CLICK],
  browser_type: [Permission.TYPE],
  browser_screenshot: [Permission.SCREENSHOT],
  browser_pdf: [Permission.PDF],
  browser_evaluate: [Permission.EXECUTE_JS],
  browser_query_dom: [Permission.DOM_QUERY],
  browser_wait: [],
  browser_close_session: [],
  browser_list_sessions: [], // No special permissions required

  // Proxy tools
  proxy_cache_get: [Permission.CACHE_RESPONSES],
  proxy_cache_set: [Permission.CACHE_RESPONSES],
  proxy_cache_clear: [Permission.CACHE_RESPONSES],
  proxy_add_interceptor: [Permission.INTERCEPT_TRAFFIC, Permission.MODIFY_REQUESTS],
  proxy_remove_interceptor: [Permission.INTERCEPT_TRAFFIC],
};

/**
 * Permission guard options
 */
export interface PermissionGuardOptions {
  /** Whether to allow unknown tools (default: false for security) */
  allowUnknownTools?: boolean;
  /** Callback for logging permission events */
  onPermissionEvent?: (event: PermissionEvent) => void;
}

/**
 * Permission event for logging
 */
export interface PermissionEvent {
  type: "allowed" | "denied" | "unknown_tool";
  toolName: string;
  requiredPermissions?: Permission[];
  message: string;
}

/**
 * Permission guard for MCP tools
 */
export class PermissionGuard {
  private readonly grantedPermissions: Set<Permission>;
  private readonly permissionSetName: PermissionSet;
  private readonly allowUnknownTools: boolean;
  private readonly onPermissionEvent?: (event: PermissionEvent) => void;

  constructor(permissionSet: PermissionSet = "AUTOMATION", options: PermissionGuardOptions = {}) {
    this.permissionSetName = permissionSet;
    const permissions = DEFAULT_PERMISSIONS[permissionSet] || [];
    this.grantedPermissions = new Set(permissions);
    this.allowUnknownTools = options.allowUnknownTools ?? false;
    this.onPermissionEvent = options.onPermissionEvent;
  }

  /**
   * Check if tool has required permissions
   */
  checkToolPermission(toolName: string): void {
    const requiredPermissions = TOOL_PERMISSION_MAP[toolName];

    if (!requiredPermissions) {
      // Unknown tool - deny by default for security (fail-safe approach)
      const event: PermissionEvent = {
        type: "unknown_tool",
        toolName,
        message: `Unknown tool "${toolName}" - access denied for security`,
      };
      this.onPermissionEvent?.(event);

      if (!this.allowUnknownTools) {
        throw new Error(
          `Permission denied: Unknown tool "${toolName}". ` +
            `Tool must be registered in TOOL_PERMISSION_MAP for security.`,
        );
      }
      return;
    }

    for (const perm of requiredPermissions) {
      if (!this.grantedPermissions.has(perm)) {
        const event: PermissionEvent = {
          type: "denied",
          toolName,
          requiredPermissions,
          message: `Tool "${toolName}" requires ${perm} permission`,
        };
        this.onPermissionEvent?.(event);

        throw new Error(
          `Permission denied: Tool "${toolName}" requires ${perm} permission. ` +
            `Current permission set: ${this.permissionSetName}`,
        );
      }
    }

    // Log successful permission check
    this.onPermissionEvent?.({
      type: "allowed",
      toolName,
      requiredPermissions,
      message: `Tool "${toolName}" access granted`,
    });
  }

  /**
   * Check if a specific permission is granted
   */
  hasPermission(permission: Permission): boolean {
    return this.grantedPermissions.has(permission);
  }

  /**
   * Check if all specified permissions are granted
   */
  hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every((p) => this.grantedPermissions.has(p));
  }

  /**
   * Check if any of the specified permissions are granted
   */
  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some((p) => this.grantedPermissions.has(p));
  }

  /**
   * Get all granted permissions
   */
  getGrantedPermissions(): Permission[] {
    return Array.from(this.grantedPermissions);
  }

  /**
   * Get the permission set name
   */
  getPermissionSetName(): PermissionSet {
    return this.permissionSetName;
  }

  /**
   * Get permissions required for a tool
   */
  static getToolPermissions(toolName: string): Permission[] {
    return TOOL_PERMISSION_MAP[toolName] || [];
  }
}
