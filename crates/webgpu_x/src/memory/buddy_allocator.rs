use deno_bindgen::deno_bindgen;
use std::collections::HashMap;
use parking_lot::Mutex;
use lazy_static::lazy_static;

/// Buddy allocator for sub-allocating GPU buffers
pub struct BuddyAllocator {
    size: u64,
    min_block_size: u64,
    max_order: u32,
    free_lists: Vec<Vec<u64>>, // free_lists[order] = list of free offsets
    allocated: HashMap<u64, u32>, // offset -> order
}

impl BuddyAllocator {
    pub fn new(size: u64, min_block_size: u64) -> Self {
        assert!(size.is_power_of_two(), "Size must be power of 2");
        assert!(min_block_size.is_power_of_two(), "Min block size must be power of 2");
        assert!(size >= min_block_size, "Size must be >= min block size");

        let max_order = (size / min_block_size).trailing_zeros();
        let mut free_lists = vec![Vec::new(); (max_order + 1) as usize];

        // Initially one free block of maximum size
        free_lists[max_order as usize].push(0);

        Self {
            size,
            min_block_size,
            max_order,
            free_lists,
            allocated: HashMap::new(),
        }
    }

    /// Allocate block of given size
    pub fn allocate(&mut self, size: u64) -> Option<u64> {
        // Round up to power of 2
        let size = size.max(self.min_block_size).next_power_of_two();

        // Find order
        let order = (size / self.min_block_size).trailing_zeros();
        if order > self.max_order {
            return None; // Too large
        }

        // Find free block
        let offset = self.allocate_order(order)?;
        self.allocated.insert(offset, order);
        Some(offset)
    }

    fn allocate_order(&mut self, order: u32) -> Option<u64> {
        // Check if free block exists
        if !self.free_lists[order as usize].is_empty() {
            return self.free_lists[order as usize].pop();
        }

        // Try to split larger block
        if order < self.max_order {
            let offset = self.allocate_order(order + 1)?;

            // Split block
            let block_size = self.min_block_size * (1 << order);
            let buddy_offset = offset + block_size;

            // Add buddy to free list
            self.free_lists[order as usize].push(buddy_offset);

            return Some(offset);
        }

        None // Out of memory
    }

    /// Free allocated block
    pub fn free(&mut self, offset: u64) -> bool {
        let order = match self.allocated.remove(&offset) {
            Some(o) => o,
            None => return false, // Not allocated
        };

        self.free_order(offset, order);
        true
    }

    fn free_order(&mut self, offset: u64, order: u32) {
        // Try to merge with buddy
        if order < self.max_order {
            let block_size = self.min_block_size * (1 << order);
            let buddy_offset = offset ^ block_size;

            // Check if buddy is free
            if let Some(pos) = self.free_lists[order as usize]
                .iter()
                .position(|&x| x == buddy_offset)
            {
                // Remove buddy from free list
                self.free_lists[order as usize].swap_remove(pos);

                // Merge and free at higher order
                let merged_offset = offset.min(buddy_offset);
                self.free_order(merged_offset, order + 1);
                return;
            }
        }

        // No merge possible, add to free list
        self.free_lists[order as usize].push(offset);
    }

    /// Get statistics
    pub fn stats(&self) -> AllocatorStats {
        let total_allocated = self.allocated.len();
        let total_free: usize = self.free_lists.iter().map(|list| list.len()).sum();
        let allocated_bytes: u64 = self.allocated.values()
            .map(|&order| self.min_block_size * (1 << order))
            .sum();

        AllocatorStats {
            total_size: self.size,
            allocated_blocks: total_allocated,
            free_blocks: total_free,
            allocated_bytes,
            free_bytes: self.size - allocated_bytes,
            fragmentation: if self.size > 0 {
                (self.size - allocated_bytes) as f64 / self.size as f64
            } else {
                0.0
            },
        }
    }
}

/// Allocator statistics
pub struct AllocatorStats {
    pub total_size: u64,
    pub allocated_blocks: usize,
    pub free_blocks: usize,
    pub allocated_bytes: u64,
    pub free_bytes: u64,
    pub fragmentation: f64,
}

/// Allocation result
pub struct Allocation {
    pub offset: u64,
    pub size: u64,
}

// Global allocator registry
lazy_static! {
    static ref ALLOCATORS: Mutex<HashMap<u64, BuddyAllocator>> = Mutex::new(HashMap::new());
    static ref NEXT_ALLOCATOR_ID: Mutex<u64> = Mutex::new(1);
}

/// Create buddy allocator
pub fn buddy_allocator_create(total_size: u64, min_block_size: u64) -> u64 {
    let allocator = BuddyAllocator::new(total_size, min_block_size);
    let mut allocators = ALLOCATORS.lock();
    let mut next_id = NEXT_ALLOCATOR_ID.lock();
    let id = *next_id;
    *next_id += 1;
    allocators.insert(id, allocator);
    id
}

/// Destroy buddy allocator
pub fn buddy_allocator_destroy(allocator_id: u64) -> u8 {
    if ALLOCATORS.lock().remove(&allocator_id).is_some() { 1 } else { 0 }
}

/// Allocate from buddy allocator
pub fn buddy_allocator_allocate(allocator_id: u64, size: u64) -> Allocation {
    let mut allocators = ALLOCATORS.lock();
    if let Some(allocator) = allocators.get_mut(&allocator_id) {
        if let Some(offset) = allocator.allocate(size) {
            let actual_size = size.max(allocator.min_block_size).next_power_of_two();
            return Allocation {
                offset,
                size: actual_size,
            };
        }
    }

    Allocation {
        offset: 0,
        size: 0,
    }
}

/// Free allocation from buddy allocator
pub fn buddy_allocator_free(allocator_id: u64, offset: u64) -> u8 {
    let mut allocators = ALLOCATORS.lock();
    if let Some(allocator) = allocators.get_mut(&allocator_id) {
        return if allocator.free(offset) { 1 } else { 0 };
    }
    0
}

/// Get buddy allocator statistics
pub fn buddy_allocator_stats(allocator_id: u64) -> AllocatorStats {
    let allocators = ALLOCATORS.lock();
    if let Some(allocator) = allocators.get(&allocator_id) {
        return allocator.stats();
    }

    AllocatorStats {
        total_size: 0,
        allocated_blocks: 0,
        free_blocks: 0,
        allocated_bytes: 0,
        free_bytes: 0,
        fragmentation: 0.0,
    }
}
