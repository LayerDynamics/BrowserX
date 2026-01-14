/**
 * File System Interface
 *
 * OS-level file system operations using Deno APIs.
 */

/**
 * File information
 */
export interface FileInfo {
    isFile: boolean;
    isDirectory: boolean;
    isSymlink: boolean;
    size: number;
    mtime: Date | null;
    atime: Date | null;
    birthtime: Date | null;
}

/**
 * File System - OS-level file operations
 */
export class FileSystem {
    /**
     * Read entire file into memory
     * @param path - Absolute or relative path to file
     * @returns File contents as Uint8Array
     */
    async readFile(path: string): Promise<Uint8Array> {
        return await Deno.readFile(path);
    }

    /**
     * Read file as UTF-8 text
     * @param path - Absolute or relative path to file
     * @returns File contents as string
     */
    async readTextFile(path: string): Promise<string> {
        return await Deno.readTextFile(path);
    }

    /**
     * Write data to file
     * @param path - Absolute or relative path to file
     * @param data - Data to write
     */
    async writeFile(path: string, data: Uint8Array): Promise<void> {
        await Deno.writeFile(path, data);
    }

    /**
     * Write text to file
     * @param path - Absolute or relative path to file
     * @param text - Text to write
     */
    async writeTextFile(path: string, text: string): Promise<void> {
        await Deno.writeTextFile(path, text);
    }

    /**
     * Delete file
     * @param path - Absolute or relative path to file
     */
    async deleteFile(path: string): Promise<void> {
        await Deno.remove(path);
    }

    /**
     * Check if file or directory exists
     * @param path - Path to check
     * @returns true if exists, false otherwise
     */
    async exists(path: string): Promise<boolean> {
        try {
            await Deno.stat(path);
            return true;
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get file information
     * @param path - Path to file
     * @returns File information
     */
    async stat(path: string): Promise<FileInfo> {
        const info = await Deno.stat(path);
        return {
            isFile: info.isFile,
            isDirectory: info.isDirectory,
            isSymlink: info.isSymlink,
            size: info.size,
            mtime: info.mtime,
            atime: info.atime,
            birthtime: info.birthtime,
        };
    }

    /**
     * Create directory (including parent directories)
     * @param path - Directory path to create
     */
    async mkdir(path: string): Promise<void> {
        await Deno.mkdir(path, { recursive: true });
    }

    /**
     * Remove directory
     * @param path - Directory path to remove
     * @param recursive - Remove recursively (default: false)
     */
    async rmdir(path: string, recursive = false): Promise<void> {
        await Deno.remove(path, { recursive });
    }

    /**
     * List directory contents
     * @param path - Directory path
     * @returns Array of entry names
     */
    async readDir(path: string): Promise<string[]> {
        const entries: string[] = [];
        for await (const entry of Deno.readDir(path)) {
            entries.push(entry.name);
        }
        return entries;
    }

    /**
     * Copy file
     * @param source - Source file path
     * @param destination - Destination file path
     */
    async copyFile(source: string, destination: string): Promise<void> {
        await Deno.copyFile(source, destination);
    }

    /**
     * Rename/move file
     * @param oldPath - Current file path
     * @param newPath - New file path
     */
    async rename(oldPath: string, newPath: string): Promise<void> {
        await Deno.rename(oldPath, newPath);
    }
}
