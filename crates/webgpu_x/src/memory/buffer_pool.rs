use deno_bindgen::deno_bindgen;
use std::collections::HashMap;
use parking_lot::Mutex;
use lazy_static::lazy_static;
use crate::gpu::device::DEVICES;
use crate::gpu::bind_group::{GPU_BUFFERS, gpu_create_buffer};

/// Buffer pool entry
#[derive(Debug, Clone)]
struct PooledBuffer {
    size: u64,
    usage: u32, // wgpu::BufferUsages bits
    last_used: u64, // Timestamp
    in_use: u8,
    device_handle: u64, // Which device created this buffer
}

/// Buffer pool configuration
#[derive(Debug, Clone)]
pub struct BufferPoolConfig {
    pub max_buffers: usize,
    pub max_total_size: u64,
    pub eviction_timeout_ms: u64,
    pub enable_size_classes: u8,
}

/// Buffer pool for reusing GPU buffers
pub struct BufferPool {
    buffers: HashMap<u64, PooledBuffer>, // handle -> buffer
    config: BufferPoolConfig,
    total_size: u64,
    hits: u64,
    misses: u64,
    default_device_handle: u64,
}

lazy_static! {
    static ref BUFFER_POOL: Mutex<BufferPool> = Mutex::new(BufferPool::new(BufferPoolConfig {
        max_buffers: 100,
        max_total_size: 256 * 1024 * 1024, // 256 MB
        eviction_timeout_ms: 60000, // 1 minute
        enable_size_classes: 1,
    }));
}

impl BufferPool {
    fn new(config: BufferPoolConfig) -> Self {
        Self {
            buffers: HashMap::new(),
            config,
            total_size: 0,
            hits: 0,
            misses: 0,
            default_device_handle: 1,
        }
    }

    /// Acquire buffer from pool or create new
    fn acquire(&mut self, size: u64, usage: u32) -> Option<u64> {
        // Try to find suitable buffer
        for (handle, buffer) in &mut self.buffers {
            if buffer.in_use == 0 && buffer.size >= size && buffer.usage == usage {
                buffer.in_use = 1;
                buffer.last_used = Self::timestamp();
                self.hits += 1;
                return Some(*handle);
            }
        }

        // No suitable buffer found
        self.misses += 1;

        // Check if we can allocate new buffer
        if self.buffers.len() >= self.config.max_buffers
           || self.total_size + size > self.config.max_total_size {
            // Try eviction
            self.evict_old_buffers();

            // Check again
            if self.buffers.len() >= self.config.max_buffers
               || self.total_size + size > self.config.max_total_size {
                return None; // Pool exhausted
            }
        }

        // Create a real GPU buffer via the DEVICES registry
        let device_handle = self.default_device_handle;
        let buffer_handle = gpu_create_buffer(device_handle, size, usage, false);
        if buffer_handle == 0 {
            return None; // Device not available or buffer creation failed
        }

        self.buffers.insert(buffer_handle, PooledBuffer {
            size,
            usage,
            last_used: Self::timestamp(),
            in_use: 1,
            device_handle,
        });
        self.total_size += size;

        Some(buffer_handle)
    }

    /// Release buffer back to pool
    fn release(&mut self, handle: u64) {
        if let Some(buffer) = self.buffers.get_mut(&handle) {
            buffer.in_use = 0;
            buffer.last_used = Self::timestamp();
        }
    }

    /// Add buffer to pool
    fn add(&mut self, handle: u64, size: u64, usage: u32) {
        self.buffers.insert(handle, PooledBuffer {
            size,
            usage,
            last_used: Self::timestamp(),
            in_use: 0,
            device_handle: self.default_device_handle,
        });
        self.total_size += size;
    }

    /// Remove buffer from pool
    fn remove(&mut self, handle: u64) {
        if let Some(buffer) = self.buffers.remove(&handle) {
            self.total_size -= buffer.size;
        }
    }

    /// Evict old unused buffers
    fn evict_old_buffers(&mut self) {
        let now = Self::timestamp();
        let timeout = self.config.eviction_timeout_ms;

        let to_remove: Vec<u64> = self.buffers
            .iter()
            .filter(|(_, buf)| buf.in_use == 0 && now - buf.last_used > timeout)
            .map(|(handle, _)| *handle)
            .collect();

        for handle in to_remove {
            if let Some(buffer) = self.buffers.remove(&handle) {
                self.total_size -= buffer.size;
                // Destroy the actual GPU buffer
                GPU_BUFFERS.write().remove(&handle);
            }
        }
    }

    fn timestamp() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

/// FFI: Acquire buffer from pool
pub fn buffer_pool_acquire(size: u64, usage: u32) -> u64 {
    BUFFER_POOL.lock().acquire(size, usage).unwrap_or(0)
}

/// FFI: Release buffer to pool
pub fn buffer_pool_release(handle: u64) {
    BUFFER_POOL.lock().release(handle);
}

/// FFI: Add buffer to pool
pub fn buffer_pool_add(handle: u64, size: u64, usage: u32) {
    BUFFER_POOL.lock().add(handle, size, usage);
}

/// FFI: Remove buffer from pool
pub fn buffer_pool_remove(handle: u64) {
    BUFFER_POOL.lock().remove(handle);
}

/// FFI: Get pool statistics
#[derive(Debug, Clone)]
pub struct BufferPoolStats {
    pub total_buffers: usize,
    pub in_use: usize,
    pub total_size_bytes: u64,
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
}

pub fn buffer_pool_stats() -> BufferPoolStats {
    let pool = BUFFER_POOL.lock();
    let in_use = pool.buffers.values().filter(|b| b.in_use != 0).count();
    let total = pool.hits + pool.misses;
    let hit_rate = if total > 0 {
        pool.hits as f64 / total as f64
    } else {
        0.0
    };

    BufferPoolStats {
        total_buffers: pool.buffers.len(),
        in_use,
        total_size_bytes: pool.total_size,
        hits: pool.hits,
        misses: pool.misses,
        hit_rate,
    }
}

/// FFI: Configure buffer pool
pub fn buffer_pool_configure(config: BufferPoolConfig) {
    let mut pool = BUFFER_POOL.lock();
    pool.config = config;
}

/// FFI: Clear all buffers from pool
pub fn buffer_pool_clear() {
    let mut pool = BUFFER_POOL.lock();
    pool.buffers.clear();
    pool.total_size = 0;
}

/// FFI: Evict old buffers
pub fn buffer_pool_evict() {
    BUFFER_POOL.lock().evict_old_buffers();
}

/// FFI: Set the default device handle for buffer creation
/// Returns 1 if device exists, 0 if not found
pub fn buffer_pool_set_device(device_handle: u64) -> u8 {
    let devices = DEVICES.read();
    if devices.get(&device_handle).is_none() {
        return 0;
    }
    drop(devices);
    let mut pool = BUFFER_POOL.lock();
    pool.default_device_handle = device_handle;
    1
}
