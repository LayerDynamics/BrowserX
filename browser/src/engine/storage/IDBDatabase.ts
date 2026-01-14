/**
 * IndexedDB Database
 *
 * Implements IndexedDB with transactions and object stores.
 */

import { IDBObjectStoreImpl } from "./IDBObjectStore.ts";
import type { IDBObjectStoreOptions, IDBTransactionMode } from "../../types/storage.ts";

/**
 * Transaction state
 */
enum TransactionState {
    ACTIVE = "active",
    INACTIVE = "inactive",
    COMMITTING = "committing",
    FINISHED = "finished",
}

/**
 * IDB Transaction implementation
 */
export class IDBTransactionImpl {
    readonly db: IDBDatabaseImpl;
    readonly mode: IDBTransactionMode;
    readonly objectStoreNames: string[];

    private state: TransactionState = TransactionState.ACTIVE;
    private objectStores: Map<string, IDBObjectStoreImpl> = new Map();
    private error: Error | null = null;
    private onComplete: (() => void) | null = null;
    private onAbort: ((error: Error) => void) | null = null;

    constructor(db: IDBDatabaseImpl, storeNames: string[], mode: IDBTransactionMode) {
        this.db = db;
        this.mode = mode;
        this.objectStoreNames = storeNames;

        // Get object stores
        for (const name of storeNames) {
            const store = db.getObjectStore(name);
            if (!store) {
                throw new Error(`NotFoundError: Object store '${name}' not found`);
            }
            this.objectStores.set(name, store);
        }
    }

    /**
     * Get object store
     */
    objectStore(name: string): IDBObjectStoreImpl {
        if (!this.objectStoreNames.includes(name)) {
            throw new Error(`NotFoundError: Object store '${name}' not in transaction scope`);
        }

        const store = this.objectStores.get(name);
        if (!store) {
            throw new Error(`NotFoundError: Object store '${name}' not found`);
        }

        if (this.state !== TransactionState.ACTIVE) {
            throw new Error("TransactionInactiveError: Transaction is not active");
        }

        return store;
    }

    /**
     * Abort transaction
     */
    abort(): void {
        if (this.state !== TransactionState.ACTIVE) {
            throw new Error("InvalidStateError: Transaction is not active");
        }

        this.state = TransactionState.FINISHED;
        const error = new Error("AbortError: Transaction was aborted");
        this.error = error;

        if (this.onAbort) {
            this.onAbort(error);
        }
    }

    /**
     * Commit transaction
     */
    commit(): void {
        if (this.state !== TransactionState.ACTIVE) {
            throw new Error("InvalidStateError: Transaction is not active");
        }

        this.state = TransactionState.COMMITTING;

        // In a real implementation, this would flush pending operations
        this.state = TransactionState.FINISHED;

        if (this.onComplete) {
            this.onComplete();
        }
    }

    /**
     * Get transaction state
     */
    getState(): TransactionState {
        return this.state;
    }

    /**
     * Check if transaction is active
     */
    isActive(): boolean {
        return this.state === TransactionState.ACTIVE;
    }

    /**
     * Set completion callback
     */
    setOnComplete(callback: () => void): void {
        this.onComplete = callback;
    }

    /**
     * Set abort callback
     */
    setOnAbort(callback: (error: Error) => void): void {
        this.onAbort = callback;
    }
}

/**
 * IDB Database implementation
 */
export class IDBDatabaseImpl {
    readonly name: string;
    readonly version: number;
    readonly objectStoreNames: string[];

    private objectStores: Map<string, IDBObjectStoreImpl> = new Map();
    private closed: boolean = false;
    private transactions: Set<IDBTransactionImpl> = new Set();

    constructor(name: string, version: number) {
        this.name = name;
        this.version = version;
        this.objectStoreNames = [];
    }

    /**
     * Create object store
     */
    createObjectStore(name: string, options?: IDBObjectStoreOptions): IDBObjectStoreImpl {
        if (this.objectStores.has(name)) {
            throw new Error(`ConstraintError: Object store '${name}' already exists`);
        }

        const store = new IDBObjectStoreImpl(name, options);
        this.objectStores.set(name, store);
        this.objectStoreNames.push(name);

        return store;
    }

    /**
     * Delete object store
     */
    deleteObjectStore(name: string): void {
        if (!this.objectStores.has(name)) {
            throw new Error(`NotFoundError: Object store '${name}' not found`);
        }

        this.objectStores.delete(name);

        const index = this.objectStoreNames.indexOf(name);
        if (index !== -1) {
            this.objectStoreNames.splice(index, 1);
        }
    }

    /**
     * Create transaction
     */
    transaction(
        storeNames: string | string[],
        mode: IDBTransactionMode = "readonly",
    ): IDBTransactionImpl {
        if (this.closed) {
            throw new Error("InvalidStateError: Database is closed");
        }

        // Normalize store names to array
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];

        // Validate store names
        for (const name of names) {
            if (!this.objectStores.has(name)) {
                throw new Error(`NotFoundError: Object store '${name}' not found`);
            }
        }

        // Create transaction
        const txn = new IDBTransactionImpl(this, names, mode);

        // Track transaction
        this.transactions.add(txn);

        // Auto-commit on next microtask if no operations are queued
        queueMicrotask(() => {
            if (txn.isActive()) {
                txn.commit();
            }
        });

        // Remove from tracking when finished
        txn.setOnComplete(() => {
            this.transactions.delete(txn);
        });

        txn.setOnAbort(() => {
            this.transactions.delete(txn);
        });

        return txn;
    }

    /**
     * Close database
     */
    close(): void {
        if (this.closed) {
            return;
        }

        // Wait for pending transactions
        if (this.transactions.size > 0) {
            throw new Error("InvalidStateError: Cannot close database with active transactions");
        }

        this.closed = true;
    }

    /**
     * Check if database is closed
     */
    isClosed(): boolean {
        return this.closed;
    }

    /**
     * Get object store (internal use)
     */
    getObjectStore(name: string): IDBObjectStoreImpl | undefined {
        return this.objectStores.get(name);
    }

    /**
     * Get all object stores (internal use)
     */
    getAllObjectStores(): IDBObjectStoreImpl[] {
        return Array.from(this.objectStores.values());
    }

    /**
     * Export database data
     */
    export(): {
        name: string;
        version: number;
        objectStores: Record<string, {
            name: string;
            keyPath: string | string[] | null;
            autoIncrement: boolean;
            data: [unknown, unknown][];
        }>;
    } {
        const objectStores: Record<string, {
            name: string;
            keyPath: string | string[] | null;
            autoIncrement: boolean;
            data: [unknown, unknown][];
        }> = {};

        for (const [name, store] of this.objectStores.entries()) {
            objectStores[name] = {
                name: store.name,
                keyPath: store.keyPath,
                autoIncrement: store.autoIncrement,
                data: [], // Would need to expose data from store
            };
        }

        return {
            name: this.name,
            version: this.version,
            objectStores,
        };
    }
}

/**
 * IndexedDB Factory
 * Manages database instances
 */
export class IDBFactory {
    private databases: Map<string, IDBDatabaseImpl> = new Map();

    /**
     * Open database
     */
    async open(name: string, version: number = 1): Promise<IDBDatabaseImpl> {
        const key = `${name}-${version}`;

        // Check if database already exists
        if (this.databases.has(key)) {
            return this.databases.get(key)!;
        }

        // Create new database
        const db = new IDBDatabaseImpl(name, version);
        this.databases.set(key, db);

        return db;
    }

    /**
     * Delete database
     */
    async deleteDatabase(name: string): Promise<void> {
        // Remove all versions of the database
        const toDelete: string[] = [];

        for (const key of this.databases.keys()) {
            if (key.startsWith(`${name}-`)) {
                toDelete.push(key);
            }
        }

        for (const key of toDelete) {
            const db = this.databases.get(key);
            if (db && !db.isClosed()) {
                db.close();
            }
            this.databases.delete(key);
        }
    }

    /**
     * Get all database names
     */
    getDatabaseNames(): string[] {
        const names = new Set<string>();

        for (const key of this.databases.keys()) {
            const name = key.split("-")[0];
            names.add(name);
        }

        return Array.from(names);
    }

    /**
     * Compare versions
     */
    cmp(a: unknown, b: unknown): number {
        if (a === b) return 0;
        if (a === undefined) return -1;
        if (b === undefined) return 1;

        // Simplified comparison - real implementation would handle all IndexedDB key types
        if (typeof a === "number" && typeof b === "number") {
            return a - b;
        }

        if (typeof a === "string" && typeof b === "string") {
            return a.localeCompare(b);
        }

        return 0;
    }
}

// Export singleton factory
export const indexedDB = new IDBFactory();
