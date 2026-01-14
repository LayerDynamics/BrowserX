// Hash utility for generating window IDs

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// Generate a unique 64-bit hash ID from any hashable value.
/// Used primarily for converting winit WindowIds to u64.
pub fn hash_id<T: Hash>(t: &T) -> u64 {
    let mut hasher = DefaultHasher::new();
    t.hash(&mut hasher);
    hasher.finish()
}
