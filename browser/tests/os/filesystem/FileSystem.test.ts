/**
 * FileSystem Tests
 *
 * Comprehensive tests for OS-level file system operations.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { FileSystem } from "../../../src/os/filesystem/FileSystem.ts";

const TEST_DIR = "./browser/tests/os/filesystem/temp_test_data";
const fs = new FileSystem();

// Utility to clean up test directory
async function cleanupTestDir() {
    try {
        await fs.rmdir(TEST_DIR, true);
    } catch {
        // Directory may not exist
    }
}

// Setup before all tests
async function setupTestEnv() {
    await cleanupTestDir();
    await fs.mkdir(TEST_DIR);
}

// Teardown after all tests
async function teardownTestEnv() {
    await cleanupTestDir();
}

Deno.test({
    name: "FileSystem - readFile and writeFile with binary data",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/binary_test.bin`;
            const testData = new Uint8Array([0, 1, 2, 3, 4, 255, 254, 253]);

            // Write binary data
            await fs.writeFile(testPath, testData);

            // Read it back
            const readData = await fs.readFile(testPath);

            // Verify data matches
            assertEquals(readData.length, testData.length);
            for (let i = 0; i < testData.length; i++) {
                assertEquals(readData[i], testData[i]);
            }
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - readTextFile and writeTextFile",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/text_test.txt`;
            const testText = "Hello, World!\nThis is a test file.\nUTF-8: 你好世界";

            // Write text
            await fs.writeTextFile(testPath, testText);

            // Read it back
            const readText = await fs.readTextFile(testPath);

            assertEquals(readText, testText);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - readFile throws error for non-existent file",
    async fn() {
        await setupTestEnv();
        try {
            await assertRejects(
                async () => {
                    await fs.readFile(`${TEST_DIR}/does_not_exist.txt`);
                },
                Deno.errors.NotFound,
            );
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - readTextFile throws error for non-existent file",
    async fn() {
        await setupTestEnv();
        try {
            await assertRejects(
                async () => {
                    await fs.readTextFile(`${TEST_DIR}/does_not_exist.txt`);
                },
                Deno.errors.NotFound,
            );
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - writeFile creates new file",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/new_file.bin`;
            const testData = new Uint8Array([1, 2, 3]);

            await fs.writeFile(testPath, testData);

            const exists = await fs.exists(testPath);
            assertEquals(exists, true);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - writeFile overwrites existing file",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/overwrite.txt`;

            await fs.writeTextFile(testPath, "original content");
            await fs.writeTextFile(testPath, "new content");

            const content = await fs.readTextFile(testPath);
            assertEquals(content, "new content");
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - deleteFile removes file",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/to_delete.txt`;

            await fs.writeTextFile(testPath, "delete me");
            assertEquals(await fs.exists(testPath), true);

            await fs.deleteFile(testPath);
            assertEquals(await fs.exists(testPath), false);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - deleteFile throws error for non-existent file",
    async fn() {
        await setupTestEnv();
        try {
            await assertRejects(
                async () => {
                    await fs.deleteFile(`${TEST_DIR}/does_not_exist.txt`);
                },
                Deno.errors.NotFound,
            );
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - exists returns true for existing file",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/exists.txt`;
            await fs.writeTextFile(testPath, "content");

            const exists = await fs.exists(testPath);
            assertEquals(exists, true);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - exists returns false for non-existent file",
    async fn() {
        await setupTestEnv();
        try {
            const exists = await fs.exists(`${TEST_DIR}/does_not_exist.txt`);
            assertEquals(exists, false);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - exists returns true for existing directory",
    async fn() {
        await setupTestEnv();
        try {
            const exists = await fs.exists(TEST_DIR);
            assertEquals(exists, true);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - stat returns file information",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/stat_test.txt`;
            const testContent = "test content for stat";
            await fs.writeTextFile(testPath, testContent);

            const info = await fs.stat(testPath);

            assertEquals(info.isFile, true);
            assertEquals(info.isDirectory, false);
            assertEquals(info.isSymlink, false);
            assertEquals(info.size, new TextEncoder().encode(testContent).length);
            assertEquals(info.mtime !== null, true);
            assertEquals(info.atime !== null, true);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - stat returns directory information",
    async fn() {
        await setupTestEnv();
        try {
            const info = await fs.stat(TEST_DIR);

            assertEquals(info.isFile, false);
            assertEquals(info.isDirectory, true);
            assertEquals(info.isSymlink, false);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - stat throws error for non-existent path",
    async fn() {
        await setupTestEnv();
        try {
            await assertRejects(
                async () => {
                    await fs.stat(`${TEST_DIR}/does_not_exist.txt`);
                },
                Deno.errors.NotFound,
            );
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - mkdir creates directory",
    async fn() {
        await setupTestEnv();
        try {
            const dirPath = `${TEST_DIR}/new_dir`;
            await fs.mkdir(dirPath);

            const exists = await fs.exists(dirPath);
            assertEquals(exists, true);

            const info = await fs.stat(dirPath);
            assertEquals(info.isDirectory, true);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - mkdir creates nested directories recursively",
    async fn() {
        await setupTestEnv();
        try {
            const dirPath = `${TEST_DIR}/nested/path/to/dir`;
            await fs.mkdir(dirPath);

            const exists = await fs.exists(dirPath);
            assertEquals(exists, true);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - mkdir is idempotent (doesn't fail if directory exists)",
    async fn() {
        await setupTestEnv();
        try {
            const dirPath = `${TEST_DIR}/existing_dir`;
            await fs.mkdir(dirPath);
            await fs.mkdir(dirPath); // Should not throw

            const exists = await fs.exists(dirPath);
            assertEquals(exists, true);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - rmdir removes empty directory",
    async fn() {
        await setupTestEnv();
        try {
            const dirPath = `${TEST_DIR}/to_remove`;
            await fs.mkdir(dirPath);
            assertEquals(await fs.exists(dirPath), true);

            await fs.rmdir(dirPath, false);
            assertEquals(await fs.exists(dirPath), false);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - rmdir with recursive removes directory with contents",
    async fn() {
        await setupTestEnv();
        try {
            const dirPath = `${TEST_DIR}/to_remove_recursive`;
            await fs.mkdir(dirPath);
            await fs.writeTextFile(`${dirPath}/file1.txt`, "content");
            await fs.mkdir(`${dirPath}/subdir`);
            await fs.writeTextFile(`${dirPath}/subdir/file2.txt`, "content");

            await fs.rmdir(dirPath, true);
            assertEquals(await fs.exists(dirPath), false);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - rmdir without recursive fails for non-empty directory",
    async fn() {
        await setupTestEnv();
        try {
            const dirPath = `${TEST_DIR}/non_empty`;
            await fs.mkdir(dirPath);
            await fs.writeTextFile(`${dirPath}/file.txt`, "content");

            await assertRejects(
                async () => {
                    await fs.rmdir(dirPath, false);
                },
            );
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - rmdir throws error for non-existent directory",
    async fn() {
        await setupTestEnv();
        try {
            await assertRejects(
                async () => {
                    await fs.rmdir(`${TEST_DIR}/does_not_exist`, false);
                },
                Deno.errors.NotFound,
            );
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - readDir returns directory contents",
    async fn() {
        await setupTestEnv();
        try {
            await fs.writeTextFile(`${TEST_DIR}/file1.txt`, "content");
            await fs.writeTextFile(`${TEST_DIR}/file2.txt`, "content");
            await fs.mkdir(`${TEST_DIR}/subdir`);

            const entries = await fs.readDir(TEST_DIR);

            assertEquals(entries.length, 3);
            assertEquals(entries.includes("file1.txt"), true);
            assertEquals(entries.includes("file2.txt"), true);
            assertEquals(entries.includes("subdir"), true);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - readDir returns empty array for empty directory",
    async fn() {
        await setupTestEnv();
        try {
            const emptyDir = `${TEST_DIR}/empty`;
            await fs.mkdir(emptyDir);

            const entries = await fs.readDir(emptyDir);
            assertEquals(entries.length, 0);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - readDir throws error for non-existent directory",
    async fn() {
        await setupTestEnv();
        try {
            await assertRejects(
                async () => {
                    await fs.readDir(`${TEST_DIR}/does_not_exist`);
                },
                Deno.errors.NotFound,
            );
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - readDir throws error for file path",
    async fn() {
        await setupTestEnv();
        try {
            const filePath = `${TEST_DIR}/not_a_dir.txt`;
            await fs.writeTextFile(filePath, "content");

            await assertRejects(
                async () => {
                    await fs.readDir(filePath);
                },
            );
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - copyFile copies file content",
    async fn() {
        await setupTestEnv();
        try {
            const sourcePath = `${TEST_DIR}/source.txt`;
            const destPath = `${TEST_DIR}/dest.txt`;
            const testContent = "content to copy";

            await fs.writeTextFile(sourcePath, testContent);
            await fs.copyFile(sourcePath, destPath);

            const copiedContent = await fs.readTextFile(destPath);
            assertEquals(copiedContent, testContent);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - copyFile overwrites existing destination",
    async fn() {
        await setupTestEnv();
        try {
            const sourcePath = `${TEST_DIR}/source.txt`;
            const destPath = `${TEST_DIR}/dest.txt`;

            await fs.writeTextFile(sourcePath, "new content");
            await fs.writeTextFile(destPath, "old content");
            await fs.copyFile(sourcePath, destPath);

            const content = await fs.readTextFile(destPath);
            assertEquals(content, "new content");
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - copyFile throws error for non-existent source",
    async fn() {
        await setupTestEnv();
        try {
            await assertRejects(
                async () => {
                    await fs.copyFile(
                        `${TEST_DIR}/does_not_exist.txt`,
                        `${TEST_DIR}/dest.txt`,
                    );
                },
                Deno.errors.NotFound,
            );
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - rename moves file",
    async fn() {
        await setupTestEnv();
        try {
            const oldPath = `${TEST_DIR}/old_name.txt`;
            const newPath = `${TEST_DIR}/new_name.txt`;
            const testContent = "content";

            await fs.writeTextFile(oldPath, testContent);
            await fs.rename(oldPath, newPath);

            assertEquals(await fs.exists(oldPath), false);
            assertEquals(await fs.exists(newPath), true);

            const content = await fs.readTextFile(newPath);
            assertEquals(content, testContent);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - rename moves file to different directory",
    async fn() {
        await setupTestEnv();
        try {
            const oldPath = `${TEST_DIR}/file.txt`;
            const newDir = `${TEST_DIR}/new_location`;
            const newPath = `${newDir}/file.txt`;

            await fs.mkdir(newDir);
            await fs.writeTextFile(oldPath, "content");
            await fs.rename(oldPath, newPath);

            assertEquals(await fs.exists(oldPath), false);
            assertEquals(await fs.exists(newPath), true);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - rename overwrites existing destination",
    async fn() {
        await setupTestEnv();
        try {
            const oldPath = `${TEST_DIR}/old.txt`;
            const newPath = `${TEST_DIR}/new.txt`;

            await fs.writeTextFile(oldPath, "old content");
            await fs.writeTextFile(newPath, "to be replaced");
            await fs.rename(oldPath, newPath);

            const content = await fs.readTextFile(newPath);
            assertEquals(content, "old content");
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - rename throws error for non-existent source",
    async fn() {
        await setupTestEnv();
        try {
            await assertRejects(
                async () => {
                    await fs.rename(
                        `${TEST_DIR}/does_not_exist.txt`,
                        `${TEST_DIR}/new.txt`,
                    );
                },
                Deno.errors.NotFound,
            );
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - writeFile with empty data creates empty file",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/empty.bin`;
            await fs.writeFile(testPath, new Uint8Array(0));

            const info = await fs.stat(testPath);
            assertEquals(info.size, 0);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - writeTextFile with empty string creates empty file",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/empty.txt`;
            await fs.writeTextFile(testPath, "");

            const info = await fs.stat(testPath);
            assertEquals(info.size, 0);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - handles large binary files",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/large.bin`;
            // Create 1MB file
            const largeData = new Uint8Array(1024 * 1024);
            for (let i = 0; i < largeData.length; i++) {
                largeData[i] = i % 256;
            }

            await fs.writeFile(testPath, largeData);
            const readData = await fs.readFile(testPath);

            assertEquals(readData.length, largeData.length);
            // Verify a few sample bytes
            assertEquals(readData[0], 0);
            assertEquals(readData[100], 100);
            assertEquals(readData[1000], 1000 % 256);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - handles special characters in file names",
    async fn() {
        await setupTestEnv();
        try {
            const specialName = `${TEST_DIR}/file with spaces & special (chars).txt`;
            const testContent = "special file";

            await fs.writeTextFile(specialName, testContent);
            const content = await fs.readTextFile(specialName);

            assertEquals(content, testContent);
        } finally {
            await teardownTestEnv();
        }
    },
});

Deno.test({
    name: "FileSystem - handles UTF-8 content correctly",
    async fn() {
        await setupTestEnv();
        try {
            const testPath = `${TEST_DIR}/utf8.txt`;
            const utf8Content = "Hello 世界 🌍 مرحبا Привет";

            await fs.writeTextFile(testPath, utf8Content);
            const readContent = await fs.readTextFile(testPath);

            assertEquals(readContent, utf8Content);
        } finally {
            await teardownTestEnv();
        }
    },
});
