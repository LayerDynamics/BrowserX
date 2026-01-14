use deno_bindgen::deno_bindgen;
use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use parking_lot::Mutex;
use lazy_static::lazy_static;

/// Pipeline cache entry
#[derive(Clone)]
struct CachedPipeline {
    handle: u64,
    hash: u64,
    created_at: u64,
    hit_count: u64,
}

/// Pipeline cache
pub struct PipelineCache {
    render_pipelines: HashMap<u64, CachedPipeline>,
    compute_pipelines: HashMap<u64, CachedPipeline>,
    total_hits: u64,
    total_misses: u64,
}

lazy_static! {
    static ref PIPELINE_CACHE: Mutex<PipelineCache> = Mutex::new(PipelineCache::new());
}

impl PipelineCache {
    fn new() -> Self {
        Self {
            render_pipelines: HashMap::new(),
            compute_pipelines: HashMap::new(),
            total_hits: 0,
            total_misses: 0,
        }
    }

    /// Lookup render pipeline by descriptor hash
    fn lookup_render_pipeline(&mut self, hash: u64) -> Option<u64> {
        if let Some(cached) = self.render_pipelines.get_mut(&hash) {
            cached.hit_count += 1;
            self.total_hits += 1;
            Some(cached.handle)
        } else {
            self.total_misses += 1;
            None
        }
    }

    /// Cache render pipeline
    fn cache_render_pipeline(&mut self, hash: u64, handle: u64) {
        self.render_pipelines.insert(hash, CachedPipeline {
            handle,
            hash,
            created_at: Self::timestamp(),
            hit_count: 0,
        });
    }

    /// Lookup compute pipeline by descriptor hash
    fn lookup_compute_pipeline(&mut self, hash: u64) -> Option<u64> {
        if let Some(cached) = self.compute_pipelines.get_mut(&hash) {
            cached.hit_count += 1;
            self.total_hits += 1;
            Some(cached.handle)
        } else {
            self.total_misses += 1;
            None
        }
    }

    /// Cache compute pipeline
    fn cache_compute_pipeline(&mut self, hash: u64, handle: u64) {
        self.compute_pipelines.insert(hash, CachedPipeline {
            handle,
            hash,
            created_at: Self::timestamp(),
            hit_count: 0,
        });
    }

    fn timestamp() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

/// Compute hash of descriptor
pub fn hash_descriptor(descriptor_json: String) -> u64 {
    let mut hasher = DefaultHasher::new();
    descriptor_json.hash(&mut hasher);
    hasher.finish()
}

/// Lookup render pipeline in cache
pub fn pipeline_cache_lookup_render(descriptor_hash: u64) -> u64 {
    PIPELINE_CACHE.lock().lookup_render_pipeline(descriptor_hash).unwrap_or(0)
}

/// Cache render pipeline
pub fn pipeline_cache_insert_render(descriptor_hash: u64, pipeline_handle: u64) {
    PIPELINE_CACHE.lock().cache_render_pipeline(descriptor_hash, pipeline_handle);
}

/// Lookup compute pipeline in cache
pub fn pipeline_cache_lookup_compute(descriptor_hash: u64) -> u64 {
    PIPELINE_CACHE.lock().lookup_compute_pipeline(descriptor_hash).unwrap_or(0)
}

/// Cache compute pipeline
pub fn pipeline_cache_insert_compute(descriptor_hash: u64, pipeline_handle: u64) {
    PIPELINE_CACHE.lock().cache_compute_pipeline(descriptor_hash, pipeline_handle);
}

/// Pipeline cache statistics
pub struct PipelineCacheStats {
    pub render_pipelines: usize,
    pub compute_pipelines: usize,
    pub total_hits: u64,
    pub total_misses: u64,
    pub hit_rate: f64,
}

/// Get pipeline cache statistics
pub fn pipeline_cache_stats() -> PipelineCacheStats {
    let cache = PIPELINE_CACHE.lock();
    let total = cache.total_hits + cache.total_misses;
    let hit_rate = if total > 0 {
        cache.total_hits as f64 / total as f64
    } else {
        0.0
    };

    PipelineCacheStats {
        render_pipelines: cache.render_pipelines.len(),
        compute_pipelines: cache.compute_pipelines.len(),
        total_hits: cache.total_hits,
        total_misses: cache.total_misses,
        hit_rate,
    }
}

/// Clear pipeline cache
pub fn pipeline_cache_clear() {
    let mut cache = PIPELINE_CACHE.lock();
    cache.render_pipelines.clear();
    cache.compute_pipelines.clear();
}

/// Remove specific render pipeline from cache
pub fn pipeline_cache_remove_render(descriptor_hash: u64) -> u8 {
    if PIPELINE_CACHE.lock().render_pipelines.remove(&descriptor_hash).is_some() { 1 } else { 0 }
}

/// Remove specific compute pipeline from cache
pub fn pipeline_cache_remove_compute(descriptor_hash: u64) -> u8 {
    if PIPELINE_CACHE.lock().compute_pipelines.remove(&descriptor_hash).is_some() { 1 } else { 0 }
}

/// Get most hit pipelines (top N)
pub struct PipelineHitInfo {
    pub hash: u64,
    pub handle: u64,
    pub hit_count: u64,
    pub pipeline_type: String, // "render" or "compute"
}

pub fn pipeline_cache_top_hits(top_n: u32) -> Vec<PipelineHitInfo> {
    let cache = PIPELINE_CACHE.lock();
    let mut hits: Vec<PipelineHitInfo> = Vec::new();

    // Collect render pipelines
    for (hash, pipeline) in &cache.render_pipelines {
        hits.push(PipelineHitInfo {
            hash: *hash,
            handle: pipeline.handle,
            hit_count: pipeline.hit_count,
            pipeline_type: "render".to_string(),
        });
    }

    // Collect compute pipelines
    for (hash, pipeline) in &cache.compute_pipelines {
        hits.push(PipelineHitInfo {
            hash: *hash,
            handle: pipeline.handle,
            hit_count: pipeline.hit_count,
            pipeline_type: "compute".to_string(),
        });
    }

    // Sort by hit count descending
    hits.sort_by(|a, b| b.hit_count.cmp(&a.hit_count));

    // Take top N
    hits.truncate(top_n as usize);

    hits
}
