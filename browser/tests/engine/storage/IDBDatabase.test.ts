/**
 * IndexedDB Tests
 *
 * Comprehensive tests for IDBDatabase and IDBObjectStore implementations.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import {
    IDBDatabaseImpl,
    IDBFactory,
    IDBTransactionImpl,
    indexedDB,
} from "../../../src/engine/storage/IDBDatabase.ts";
import { IDBObjectStoreImpl } from "../../../src/engine/storage/IDBObjectStore.ts";

// ============================================================================
// Database Creation Tests
// ============================================================================

Deno.test("IDBDatabase - create database with version", () => {
    const db = new IDBDatabaseImpl("testDB", 1);

    assertEquals(db.name, "testDB");
    assertEquals(db.version, 1);
    assertEquals(db.objectStoreNames.length, 0);
});

Deno.test("IDBDatabase - create object store", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    assertExists(store);
    assertEquals(store.name, "users");
    assertEquals(store.keyPath, "id");
    assertEquals(db.objectStoreNames.length, 1);
    assertEquals(db.objectStoreNames[0], "users");
});

Deno.test("IDBDatabase - cannot create duplicate object store", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    const error = (() => {
        try {
            db.createObjectStore("users", { keyPath: "id" });
            return null;
        } catch (e) {
            return e as Error;
        }
    })();

    assertExists(error);
    assertEquals(error.message.includes("ConstraintError"), true);
});

Deno.test("IDBDatabase - create multiple object stores", () => {
    const db = new IDBDatabaseImpl("testDB", 1);

    db.createObjectStore("users", { keyPath: "id" });
    db.createObjectStore("posts", { keyPath: "postId" });
    db.createObjectStore("comments", { autoIncrement: true });

    assertEquals(db.objectStoreNames.length, 3);
    assertEquals(db.objectStoreNames.includes("users"), true);
    assertEquals(db.objectStoreNames.includes("posts"), true);
    assertEquals(db.objectStoreNames.includes("comments"), true);
});

Deno.test("IDBDatabase - delete object store", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });
    db.createObjectStore("posts", { keyPath: "postId" });

    assertEquals(db.objectStoreNames.length, 2);

    db.deleteObjectStore("users");

    assertEquals(db.objectStoreNames.length, 1);
    assertEquals(db.objectStoreNames[0], "posts");
});

Deno.test("IDBDatabase - delete non-existent object store throws", () => {
    const db = new IDBDatabaseImpl("testDB", 1);

    const error = (() => {
        try {
            db.deleteObjectStore("nonExistent");
            return null;
        } catch (e) {
            return e as Error;
        }
    })();

    assertExists(error);
    assertEquals(error.message.includes("NotFoundError"), true);
});

// ============================================================================
// Transaction Tests
// ============================================================================

Deno.test("IDBDatabase - create readonly transaction", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    const txn = db.transaction("users", "readonly");

    assertExists(txn);
    assertEquals(txn.mode, "readonly");
    assertEquals(txn.objectStoreNames.length, 1);
    assertEquals(txn.objectStoreNames[0], "users");

    // Wait for auto-commit
    await new Promise((resolve) => setTimeout(resolve, 10));
});

Deno.test("IDBDatabase - create readwrite transaction", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    const txn = db.transaction("users", "readwrite");

    assertEquals(txn.mode, "readwrite");

    // Wait for auto-commit
    await new Promise((resolve) => setTimeout(resolve, 10));
});

Deno.test("IDBDatabase - transaction with multiple stores", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });
    db.createObjectStore("posts", { keyPath: "postId" });

    const txn = db.transaction(["users", "posts"], "readwrite");

    assertEquals(txn.objectStoreNames.length, 2);
    assertEquals(txn.objectStoreNames.includes("users"), true);
    assertEquals(txn.objectStoreNames.includes("posts"), true);

    // Wait for auto-commit
    await new Promise((resolve) => setTimeout(resolve, 10));
});

Deno.test("IDBDatabase - transaction with non-existent store throws", () => {
    const db = new IDBDatabaseImpl("testDB", 1);

    const error = (() => {
        try {
            db.transaction("nonExistent", "readonly");
            return null;
        } catch (e) {
            return e as Error;
        }
    })();

    assertExists(error);
    assertEquals(error.message.includes("NotFoundError"), true);
});

Deno.test("IDBDatabase - cannot create transaction on closed database", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    // Wait for any pending transactions to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    db.close();

    const error = (() => {
        try {
            db.transaction("users", "readonly");
            return null;
        } catch (e) {
            return e as Error;
        }
    })();

    assertExists(error);
    assertEquals(error.message.includes("InvalidStateError"), true);
});

// ============================================================================
// CRUD Operations Tests
// ============================================================================

Deno.test("IDBObjectStore - add and get record", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    const user = { id: 1, name: "Alice", email: "alice@example.com" };
    const key = await store.add(user);

    assertEquals(key, 1);

    const retrieved = await store.get(1);

    assertEquals(retrieved, user);
});

Deno.test("IDBObjectStore - add duplicate key throws", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });

    await assertRejects(
        async () => {
            await store.add({ id: 1, name: "Bob" });
        },
        Error,
        "ConstraintError",
    );
});

Deno.test("IDBObjectStore - put updates existing record", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });
    await store.put({ id: 1, name: "Alice Updated" });

    const retrieved = await store.get(1);

    assertEquals((retrieved as { name: string }).name, "Alice Updated");
});

Deno.test("IDBObjectStore - put creates new record if not exists", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.put({ id: 1, name: "Alice" });

    const retrieved = await store.get(1);

    assertExists(retrieved);
    assertEquals((retrieved as { name: string }).name, "Alice");
});

Deno.test("IDBObjectStore - delete record", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });

    let retrieved = await store.get(1);
    assertExists(retrieved);

    await store.delete(1);

    retrieved = await store.get(1);
    assertEquals(retrieved, undefined);
});

Deno.test("IDBObjectStore - delete non-existent record succeeds", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    // Should not throw
    await store.delete(999);
});

Deno.test("IDBObjectStore - clear all records", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });
    await store.add({ id: 2, name: "Bob" });
    await store.add({ id: 3, name: "Charlie" });

    const countBefore = await store.count();
    assertEquals(countBefore, 3);

    await store.clear();

    const countAfter = await store.count();
    assertEquals(countAfter, 0);
});

// ============================================================================
// Auto-Increment Tests
// ============================================================================

Deno.test("IDBObjectStore - autoIncrement generates keys", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("items", { autoIncrement: true });

    const key1 = await store.add({ name: "Item 1" });
    const key2 = await store.add({ name: "Item 2" });
    const key3 = await store.add({ name: "Item 3" });

    assertEquals(key1, 1);
    assertEquals(key2, 2);
    assertEquals(key3, 3);
});

Deno.test("IDBObjectStore - autoIncrement with keyPath", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });

    const item1 = { name: "Item 1" };
    const key1 = await store.add(item1);

    assertEquals(key1, 1);
    assertEquals((item1 as unknown as { id: number }).id, 1);

    const retrieved = await store.get(1);
    assertEquals((retrieved as { id: number }).id, 1);
});

Deno.test("IDBObjectStore - autoIncrement counter resets on clear", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("items", { autoIncrement: true });

    await store.add({ name: "Item 1" });
    await store.add({ name: "Item 2" });

    await store.clear();

    const key = await store.add({ name: "Item 3" });
    assertEquals(key, 1);
});

// ============================================================================
// Query Operations Tests
// ============================================================================

Deno.test("IDBObjectStore - getAll returns all records", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });
    await store.add({ id: 2, name: "Bob" });
    await store.add({ id: 3, name: "Charlie" });

    const all = await store.getAll();

    assertEquals(all.length, 3);
});

Deno.test("IDBObjectStore - getAll with count limit", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });
    await store.add({ id: 2, name: "Bob" });
    await store.add({ id: 3, name: "Charlie" });

    const limited = await store.getAll(undefined, 2);

    assertEquals(limited.length, 2);
});

Deno.test("IDBObjectStore - getAllKeys returns all keys", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });
    await store.add({ id: 2, name: "Bob" });
    await store.add({ id: 3, name: "Charlie" });

    const keys = await store.getAllKeys();

    assertEquals(keys.length, 3);
    assertEquals(keys.includes(1), true);
    assertEquals(keys.includes(2), true);
    assertEquals(keys.includes(3), true);
});

Deno.test("IDBObjectStore - getAllKeys with count limit", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });
    await store.add({ id: 2, name: "Bob" });
    await store.add({ id: 3, name: "Charlie" });

    const keys = await store.getAllKeys(undefined, 2);

    assertEquals(keys.length, 2);
});

Deno.test("IDBObjectStore - count returns total records", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });
    await store.add({ id: 2, name: "Bob" });

    const count = await store.count();

    assertEquals(count, 2);
});

Deno.test("IDBObjectStore - count on empty store returns 0", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    const count = await store.count();

    assertEquals(count, 0);
});

// ============================================================================
// Index Tests
// ============================================================================

Deno.test("IDBObjectStore - create index", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    const index = store.createIndex("nameIdx", "name", { unique: false });

    assertExists(index);
    assertEquals(index.name, "nameIdx");
    assertEquals(index.keyPath, "name");
    assertEquals(index.unique, false);
    assertEquals(store.indexNames.length, 1);
});

Deno.test("IDBObjectStore - create unique index", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    const index = store.createIndex("emailIdx", "email", { unique: true });

    assertEquals(index.unique, true);
});

Deno.test("IDBObjectStore - cannot create duplicate index", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    store.createIndex("nameIdx", "name", { unique: false });

    const error = (() => {
        try {
            store.createIndex("nameIdx", "name", { unique: false });
            return null;
        } catch (e) {
            return e as Error;
        }
    })();

    assertExists(error);
    assertEquals(error.message.includes("ConstraintError"), true);
});

Deno.test("IDBObjectStore - index is populated with existing data", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    // Add data before creating index
    await store.add({ id: 1, name: "Alice", email: "alice@example.com" });
    await store.add({ id: 2, name: "Bob", email: "bob@example.com" });

    // Create index
    const index = store.createIndex("nameIdx", "name", { unique: false });

    // Index should contain the existing data
    assertExists(index.data.get("Alice"));
    assertExists(index.data.get("Bob"));
});

Deno.test("IDBObjectStore - index updates on add", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    const index = store.createIndex("nameIdx", "name", { unique: false });

    await store.add({ id: 1, name: "Alice", email: "alice@example.com" });

    const primaryKeys = index.data.get("Alice");
    assertExists(primaryKeys);
    assertEquals(primaryKeys.has(1), true);
});

Deno.test("IDBObjectStore - index updates on put", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    const index = store.createIndex("nameIdx", "name", { unique: false });

    await store.add({ id: 1, name: "Alice", email: "alice@example.com" });
    await store.put({ id: 1, name: "Alice Updated", email: "alice@example.com" });

    // Old index entry should be removed
    const oldEntry = index.data.get("Alice");
    assertEquals(oldEntry, undefined);

    // New index entry should exist
    const newEntry = index.data.get("Alice Updated");
    assertExists(newEntry);
    assertEquals(newEntry.has(1), true);
});

Deno.test("IDBObjectStore - index updates on delete", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    const index = store.createIndex("nameIdx", "name", { unique: false });

    await store.add({ id: 1, name: "Alice", email: "alice@example.com" });

    let primaryKeys = index.data.get("Alice");
    assertExists(primaryKeys);

    await store.delete(1);

    primaryKeys = index.data.get("Alice");
    assertEquals(primaryKeys, undefined);
});

Deno.test("IDBObjectStore - unique index prevents duplicate values", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    store.createIndex("emailIdx", "email", { unique: true });

    await store.add({ id: 1, name: "Alice", email: "alice@example.com" });

    await assertRejects(
        async () => {
            await store.add({ id: 2, name: "Bob", email: "alice@example.com" });
        },
        Error,
        "ConstraintError",
    );
});

Deno.test("IDBObjectStore - delete index", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    store.createIndex("nameIdx", "name", { unique: false });
    assertEquals(store.indexNames.length, 1);

    store.deleteIndex("nameIdx");
    assertEquals(store.indexNames.length, 0);
});

Deno.test("IDBObjectStore - compound key index", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    const index = store.createIndex("fullNameIdx", ["firstName", "lastName"], { unique: false });

    await store.add({ id: 1, firstName: "Alice", lastName: "Smith" });

    const compoundKey = index.data.keys().next().value;
    assertExists(compoundKey);
    assertEquals(Array.isArray(compoundKey), true);
});

// ============================================================================
// Cursor Tests
// ============================================================================

Deno.test("IDBObjectStore - openCursor forward iteration", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });
    await store.add({ id: 2, name: "Bob" });
    await store.add({ id: 3, name: "Charlie" });

    const cursor = await store.openCursor(undefined, "next");

    assertExists(cursor);
    assertEquals(cursor.key, 1);

    cursor.continue();
    assertEquals(cursor.key, 2);

    cursor.continue();
    assertEquals(cursor.key, 3);

    cursor.continue();
    assertEquals(cursor.done, true);
});

Deno.test("IDBObjectStore - openCursor reverse iteration", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });
    await store.add({ id: 2, name: "Bob" });
    await store.add({ id: 3, name: "Charlie" });

    const cursor = await store.openCursor(undefined, "prev");

    assertExists(cursor);
    assertEquals(cursor.key, 3);

    cursor.continue();
    assertEquals(cursor.key, 2);

    cursor.continue();
    assertEquals(cursor.key, 1);
});

Deno.test("IDBObjectStore - cursor advance", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });
    await store.add({ id: 2, name: "Bob" });
    await store.add({ id: 3, name: "Charlie" });
    await store.add({ id: 4, name: "Dave" });

    const cursor = await store.openCursor(undefined, "next");

    assertExists(cursor);
    assertEquals(cursor.key, 1);

    await cursor.advance(2);
    assertEquals(cursor.key, 3);
});

Deno.test("IDBObjectStore - cursor value", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    await store.add({ id: 1, name: "Alice" });

    const cursor = await store.openCursor(undefined, "next");

    assertExists(cursor);

    const value = await cursor.value();
    assertEquals((value as { name: string }).name, "Alice");
});

Deno.test("IDBObjectStore - openCursor on empty store returns null", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    const cursor = await store.openCursor(undefined, "next");

    assertEquals(cursor, null);
});

// ============================================================================
// Compound Key Tests
// ============================================================================

Deno.test("IDBObjectStore - compound keyPath", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: ["firstName", "lastName"] });

    const user = { firstName: "Alice", lastName: "Smith", email: "alice@example.com" };
    const key = await store.add(user);

    assertExists(key);
    assertEquals(Array.isArray(key), true);
    assertEquals((key as unknown[])[0], "Alice");
    assertEquals((key as unknown[])[1], "Smith");
});

// ============================================================================
// IDBFactory Tests
// ============================================================================

Deno.test("IDBFactory - open database", async () => {
    const factory = new IDBFactory();
    const db = await factory.open("testDB", 1);

    assertEquals(db.name, "testDB");
    assertEquals(db.version, 1);
});

Deno.test("IDBFactory - open same database returns same instance", async () => {
    const factory = new IDBFactory();
    const db1 = await factory.open("testDB", 1);
    const db2 = await factory.open("testDB", 1);

    assertEquals(db1, db2);
});

Deno.test("IDBFactory - open different version creates new instance", async () => {
    const factory = new IDBFactory();
    const db1 = await factory.open("testDB", 1);
    const db2 = await factory.open("testDB", 2);

    assertEquals(db1.version, 1);
    assertEquals(db2.version, 2);
});

Deno.test("IDBFactory - deleteDatabase removes all versions", async () => {
    const factory = new IDBFactory();

    await factory.open("testDB", 1);
    await factory.open("testDB", 2);

    // Wait for any pending transactions
    await new Promise((resolve) => setTimeout(resolve, 10));

    await factory.deleteDatabase("testDB");

    const names = factory.getDatabaseNames();
    assertEquals(names.includes("testDB"), false);
});

Deno.test("IDBFactory - getDatabaseNames returns all database names", async () => {
    const factory = new IDBFactory();

    await factory.open("db1", 1);
    await factory.open("db2", 1);
    await factory.open("db1", 2);

    const names = factory.getDatabaseNames();

    assertEquals(names.length, 2);
    assertEquals(names.includes("db1"), true);
    assertEquals(names.includes("db2"), true);
});

Deno.test("IDBFactory - cmp compares numbers", () => {
    const factory = new IDBFactory();

    assertEquals(factory.cmp(1, 2), -1);
    assertEquals(factory.cmp(2, 1), 1);
    assertEquals(factory.cmp(5, 5), 0);
});

Deno.test("IDBFactory - cmp compares strings", () => {
    const factory = new IDBFactory();

    assertEquals(factory.cmp("a", "b") < 0, true);
    assertEquals(factory.cmp("b", "a") > 0, true);
    assertEquals(factory.cmp("c", "c"), 0);
});

Deno.test("IDBFactory - cmp handles undefined", () => {
    const factory = new IDBFactory();

    assertEquals(factory.cmp(undefined, 1), -1);
    assertEquals(factory.cmp(1, undefined), 1);
    assertEquals(factory.cmp(undefined, undefined), 0);
});

// ============================================================================
// Transaction State Tests
// ============================================================================

Deno.test("IDBTransaction - objectStore returns store", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    const txn = db.transaction("users", "readonly");
    const store = txn.objectStore("users");

    assertExists(store);
    assertEquals(store.name, "users");
});

Deno.test("IDBTransaction - objectStore throws for non-scoped store", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });
    db.createObjectStore("posts", { keyPath: "postId" });

    const txn = db.transaction("users", "readonly");

    const error = (() => {
        try {
            txn.objectStore("posts");
            return null;
        } catch (e) {
            return e as Error;
        }
    })();

    assertExists(error);
    assertEquals(error.message.includes("NotFoundError"), true);
});

Deno.test("IDBTransaction - abort prevents further operations", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    const txn = db.transaction("users", "readwrite");

    txn.abort();

    const error = (() => {
        try {
            txn.objectStore("users");
            return null;
        } catch (e) {
            return e as Error;
        }
    })();

    assertExists(error);
    assertEquals(error.message.includes("TransactionInactiveError"), true);

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 10));
});

Deno.test("IDBTransaction - commit finalizes transaction", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    const txn = db.transaction("users", "readwrite");

    txn.commit();

    const error = (() => {
        try {
            txn.objectStore("users");
            return null;
        } catch (e) {
            return e as Error;
        }
    })();

    assertExists(error);
    assertEquals(error.message.includes("TransactionInactiveError"), true);

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 10));
});

Deno.test("IDBTransaction - cannot abort already committed transaction", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    const txn = db.transaction("users", "readwrite");

    txn.commit();

    const error = (() => {
        try {
            txn.abort();
            return null;
        } catch (e) {
            return e as Error;
        }
    })();

    assertExists(error);
    assertEquals(error.message.includes("InvalidStateError"), true);
});

Deno.test("IDBTransaction - isActive returns correct state", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    const txn = db.transaction("users", "readwrite");

    assertEquals(txn.isActive(), true);

    txn.commit();

    assertEquals(txn.isActive(), false);
});

// ============================================================================
// Database Export Tests
// ============================================================================

Deno.test("IDBDatabase - export database structure", () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });
    db.createObjectStore("posts", { keyPath: ["userId", "postId"] });
    db.createObjectStore("comments", { autoIncrement: true });

    const exported = db.export();

    assertEquals(exported.name, "testDB");
    assertEquals(exported.version, 1);
    assertEquals(Object.keys(exported.objectStores).length, 3);

    assertEquals(exported.objectStores["users"].name, "users");
    assertEquals(exported.objectStores["users"].keyPath, "id");
    assertEquals(exported.objectStores["users"].autoIncrement, false);

    assertEquals(exported.objectStores["comments"].autoIncrement, true);
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

Deno.test("IDBObjectStore - add without keyPath and no autoIncrement throws", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("items");

    await assertRejects(
        async () => {
            await store.add({ name: "Item" });
        },
        Error,
        "DataError",
    );
});

Deno.test("IDBObjectStore - explicit key overrides keyPath", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    const store = db.createObjectStore("users", { keyPath: "id" });

    const key = await store.add({ id: 1, name: "Alice" }, 999);

    assertEquals(key, 999);

    const retrieved = await store.get(999);
    assertExists(retrieved);
});

Deno.test("IDBDatabase - close prevents transaction creation", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    // Wait for any pending transactions
    await new Promise((resolve) => setTimeout(resolve, 10));

    db.close();

    assertEquals(db.isClosed(), true);

    await assertRejects(
        async () => {
            db.transaction("users", "readonly");
        },
        Error,
        "InvalidStateError",
    );
});

Deno.test("IDBDatabase - cannot close with active transactions", async () => {
    const db = new IDBDatabaseImpl("testDB", 1);
    db.createObjectStore("users", { keyPath: "id" });

    const txn = db.transaction("users", "readonly");

    const error = (() => {
        try {
            db.close();
            return null;
        } catch (e) {
            return e as Error;
        }
    })();

    assertExists(error);
    assertEquals(error.message.includes("InvalidStateError"), true);

    // Wait for auto-commit
    await new Promise((resolve) => setTimeout(resolve, 10));
});
