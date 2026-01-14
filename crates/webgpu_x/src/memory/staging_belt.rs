use parking_lot::Mutex;
use std::sync::mpsc::{channel, Receiver, Sender};
use lazy_static::lazy_static;
use std::collections::HashMap;

/// Chunk size for staging belt (1KB to 64KB typical)
pub struct StagingBelt {
    chunk_size: u64,
    active_chunks: Vec<Chunk>,
    free_chunks: Vec<Chunk>,
    sender: Sender<Chunk>,
    receiver: Receiver<Chunk>,
    next_buffer_id: u64,
}

struct Chunk {
    buffer_handle: u64,  // GPU buffer handle
    size: u64,
    offset: u64,         // Current write offset
    capacity: u64,
}

impl StagingBelt {
    pub fn new(chunk_size: u64) -> Self {
        let (sender, receiver) = channel();
        Self {
            chunk_size,
            active_chunks: Vec::new(),
            free_chunks: Vec::new(),
            sender,
            receiver,
            next_buffer_id: 1,
        }
    }

    /// Write data to staging buffer, returns (buffer_handle, offset, size)
    pub fn write(&mut self, size: u64) -> StagingWrite {
        // Find chunk with enough space or allocate new
        let chunk = self.get_chunk_with_space(size);
        let offset = chunk.offset;
        let buffer_handle = chunk.buffer_handle;

        chunk.offset += size;

        StagingWrite {
            buffer_handle,
            offset,
            size,
        }
    }

    /// Finish current frame and recover completed buffers
    pub fn finish(&mut self) {
        // Move active chunks to recovery channel
        for mut chunk in self.active_chunks.drain(..) {
            // Reset offset for reuse
            chunk.offset = 0;
            let _ = self.sender.send(chunk);
        }

        // Try to recover finished chunks
        while let Ok(chunk) = self.receiver.try_recv() {
            self.free_chunks.push(chunk);
        }
    }

    fn get_chunk_with_space(&mut self, size: u64) -> &mut Chunk {
        // Try to find active chunk with space
        let found_index = self.active_chunks.iter()
            .position(|chunk| chunk.offset + size <= chunk.capacity);

        if let Some(index) = found_index {
            return &mut self.active_chunks[index];
        }

        // Allocate new chunk
        let chunk = if let Some(mut free_chunk) = self.free_chunks.pop() {
            free_chunk.offset = 0;
            free_chunk
        } else {
            let buffer_id = self.next_buffer_id;
            self.next_buffer_id += 1;

            Chunk {
                buffer_handle: buffer_id,
                size: self.chunk_size,
                offset: 0,
                capacity: self.chunk_size,
            }
        };

        self.active_chunks.push(chunk);
        self.active_chunks.last_mut().unwrap()
    }

    /// Get statistics about the staging belt
    pub fn stats(&self) -> StagingBeltStats {
        StagingBeltStats {
            active_chunks: self.active_chunks.len() as u32,
            free_chunks: self.free_chunks.len() as u32,
            chunk_size: self.chunk_size,
            total_allocated: (self.active_chunks.len() + self.free_chunks.len()) as u64 * self.chunk_size,
        }
    }
}

/// Result of a staging write operation
#[derive(Clone)]
pub struct StagingWrite {
    pub buffer_handle: u64,
    pub offset: u64,
    pub size: u64,
}

/// Statistics about staging belt usage
pub struct StagingBeltStats {
    pub active_chunks: u32,
    pub free_chunks: u32,
    pub chunk_size: u64,
    pub total_allocated: u64,
}

// Global staging belt registry
lazy_static! {
    static ref STAGING_BELTS: Mutex<HashMap<u64, StagingBelt>> = Mutex::new(HashMap::new());
    static ref NEXT_BELT_ID: Mutex<u64> = Mutex::new(1);
}

/// Create a new staging belt with specified chunk size
pub fn staging_belt_create(chunk_size: u64) -> u64 {
    let mut belts = STAGING_BELTS.lock();
    let mut next_id = NEXT_BELT_ID.lock();

    let belt_id = *next_id;
    *next_id += 1;

    let belt = StagingBelt::new(chunk_size);
    belts.insert(belt_id, belt);

    belt_id
}

/// Write data to staging buffer
pub fn staging_belt_write(belt_handle: u64, size: u64) -> StagingWrite {
    let mut belts = STAGING_BELTS.lock();

    if let Some(belt) = belts.get_mut(&belt_handle) {
        belt.write(size)
    } else {
        // Return invalid write if belt doesn't exist
        StagingWrite {
            buffer_handle: 0,
            offset: 0,
            size: 0,
        }
    }
}

/// Finish current frame and recover completed buffers
pub fn staging_belt_finish(belt_handle: u64) {
    let mut belts = STAGING_BELTS.lock();

    if let Some(belt) = belts.get_mut(&belt_handle) {
        belt.finish();
    }
}

/// Get staging belt statistics
pub fn staging_belt_stats(belt_handle: u64) -> StagingBeltStats {
    let belts = STAGING_BELTS.lock();

    if let Some(belt) = belts.get(&belt_handle) {
        belt.stats()
    } else {
        StagingBeltStats {
            active_chunks: 0,
            free_chunks: 0,
            chunk_size: 0,
            total_allocated: 0,
        }
    }
}

/// Destroy a staging belt
pub fn staging_belt_destroy(belt_handle: u64) {
    let mut belts = STAGING_BELTS.lock();
    belts.remove(&belt_handle);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_staging_belt_basic() {
        let mut belt = StagingBelt::new(1024);

        let write1 = belt.write(256);
        assert_eq!(write1.size, 256);
        assert_eq!(write1.offset, 0);

        let write2 = belt.write(256);
        assert_eq!(write2.size, 256);
        assert_eq!(write2.offset, 256);
    }

    #[test]
    fn test_staging_belt_finish() {
        let mut belt = StagingBelt::new(1024);

        let _write1 = belt.write(512);
        assert_eq!(belt.active_chunks.len(), 1);

        belt.finish();
        assert_eq!(belt.active_chunks.len(), 0);
    }

    #[test]
    fn test_staging_belt_reuse() {
        let mut belt = StagingBelt::new(1024);

        let write1 = belt.write(512);
        let buffer1 = write1.buffer_handle;

        belt.finish();

        let write2 = belt.write(512);
        let buffer2 = write2.buffer_handle;

        // Should reuse the same buffer
        assert_eq!(buffer1, buffer2);
    }

    #[test]
    fn test_staging_belt_multiple_chunks() {
        let mut belt = StagingBelt::new(1024);

        // Fill first chunk
        let _write1 = belt.write(1024);

        // This should allocate a second chunk
        let write2 = belt.write(512);
        assert_eq!(write2.offset, 0); // New chunk starts at 0

        assert_eq!(belt.active_chunks.len(), 2);
    }
}
