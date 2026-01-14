/// Shader compilation infrastructure with hot-reload support
///
/// This module provides shader loading, caching, and hot-reload capabilities:
/// - Automatic shader stage detection from file extension
/// - File-based hot-reload with change detection
/// - Source code hashing for cache invalidation
/// - Multiple entry point support

use super::ShaderStage; // Import from parent module
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use lazy_static::lazy_static;

/// Shader source with metadata
#[derive(Clone, Serialize, Deserialize)]
pub struct ShaderSource {
    pub code: String,
    pub stage: ShaderStage,
    pub entry_point: String,
    pub file_path: Option<String>,
    pub last_modified: u64,
}

/// Cached shader entry
struct CachedShader {
    source: ShaderSource,
    hash: u64,
    compiled_at: u64,
}

/// Shader cache for hot-reload
pub struct ShaderCache {
    shaders: HashMap<String, CachedShader>,
}

impl ShaderCache {
    pub fn new() -> Self {
        Self {
            shaders: HashMap::new(),
        }
    }

    /// Load shader from file, reload if changed
    pub fn load(&mut self, file_path: String) -> Result<ShaderSource, String> {
        // Check if file changed
        let metadata = std::fs::metadata(&file_path)
            .map_err(|e| format!("Failed to read shader file: {}", e))?;

        let modified = metadata
            .modified()
            .unwrap()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Check cache
        if let Some(cached) = self.shaders.get(&file_path) {
            if cached.source.last_modified == modified {
                return Ok(cached.source.clone());
            }
        }

        // Load and cache
        let code = std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read shader: {}", e))?;

        let stage = detect_shader_stage(&file_path);
        let source = ShaderSource {
            code: code.clone(),
            stage,
            entry_point: "main".to_string(),
            file_path: Some(file_path.clone()),
            last_modified: modified,
        };

        let hash = Self::hash_source(&source.code);
        self.shaders.insert(
            file_path,
            CachedShader {
                source: source.clone(),
                hash,
                compiled_at: modified,
            },
        );

        Ok(source)
    }

    /// Load shader from string with custom stage and entry point
    pub fn load_from_string(
        &mut self,
        code: String,
        stage: ShaderStage,
        entry_point: String,
    ) -> ShaderSource {
        ShaderSource {
            code,
            stage,
            entry_point,
            file_path: None,
            last_modified: 0,
        }
    }

    /// Check if shader file has changed
    pub fn has_changed(&self, file_path: &str) -> bool {
        let Ok(metadata) = std::fs::metadata(file_path) else {
            return false;
        };

        let modified = metadata
            .modified()
            .unwrap()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if let Some(cached) = self.shaders.get(file_path) {
            return cached.source.last_modified != modified;
        }

        false
    }

    /// Clear shader cache
    pub fn clear(&mut self) {
        self.shaders.clear();
    }

    /// Get cache statistics
    pub fn stats(&self) -> ShaderCacheStats {
        ShaderCacheStats {
            cached_shaders: self.shaders.len() as u32,
        }
    }

    fn hash_source(code: &str) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        code.hash(&mut hasher);
        hasher.finish()
    }
}

impl Default for ShaderCache {
    fn default() -> Self {
        Self::new()
    }
}

/// Shader cache statistics
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ShaderCacheStats {
    pub cached_shaders: u32,
}

/// Detect shader stage from file extension
///
/// Supported extensions:
/// - .vert, .vs -> Vertex
/// - .frag, .fs -> Fragment
/// - .comp, .cs, .wgsl -> Compute
pub fn detect_shader_stage(file_path: &str) -> ShaderStage {
    let path = Path::new(file_path);
    match path.extension().and_then(|e| e.to_str()) {
        Some("vert") | Some("vs") => ShaderStage::Vertex,
        Some("frag") | Some("fs") => ShaderStage::Fragment,
        Some("comp") | Some("cs") | Some("wgsl") => ShaderStage::Compute,
        _ => ShaderStage::Compute, // Default to compute
    }
}

// Global shader cache registry
lazy_static! {
    static ref SHADER_CACHES: Mutex<HashMap<u64, ShaderCache>> = Mutex::new(HashMap::new());
    static ref NEXT_CACHE_ID: Mutex<u64> = Mutex::new(1);
}

/// Create a new shader cache
pub fn shader_cache_create() -> u64 {
    let mut caches = SHADER_CACHES.lock().unwrap();
    let mut next_id = NEXT_CACHE_ID.lock().unwrap();

    let cache_id = *next_id;
    *next_id += 1;

    let cache = ShaderCache::new();
    caches.insert(cache_id, cache);

    cache_id
}

/// Load shader from file
pub fn shader_cache_load(cache_handle: u64, file_path: String) -> Result<ShaderSource, String> {
    let mut caches = SHADER_CACHES.lock().unwrap();

    if let Some(cache) = caches.get_mut(&cache_handle) {
        cache.load(file_path)
    } else {
        Err("Invalid shader cache handle".to_string())
    }
}

/// Load shader from string
pub fn shader_cache_load_from_string(
    cache_handle: u64,
    code: String,
    stage: ShaderStage,
    entry_point: String,
) -> Result<ShaderSource, String> {
    let mut caches = SHADER_CACHES.lock().unwrap();

    if let Some(cache) = caches.get_mut(&cache_handle) {
        Ok(cache.load_from_string(code, stage, entry_point))
    } else {
        Err("Invalid shader cache handle".to_string())
    }
}

/// Check if shader file has changed
pub fn shader_cache_has_changed(cache_handle: u64, file_path: String) -> bool {
    let caches = SHADER_CACHES.lock().unwrap();

    if let Some(cache) = caches.get(&cache_handle) {
        cache.has_changed(&file_path)
    } else {
        false
    }
}

/// Clear shader cache
pub fn shader_cache_clear(cache_handle: u64) {
    let mut caches = SHADER_CACHES.lock().unwrap();

    if let Some(cache) = caches.get_mut(&cache_handle) {
        cache.clear();
    }
}

/// Get shader cache statistics
pub fn shader_cache_stats(cache_handle: u64) -> ShaderCacheStats {
    let caches = SHADER_CACHES.lock().unwrap();

    if let Some(cache) = caches.get(&cache_handle) {
        cache.stats()
    } else {
        ShaderCacheStats {
            cached_shaders: 0,
        }
    }
}

/// Destroy a shader cache
pub fn shader_cache_destroy(cache_handle: u64) {
    let mut caches = SHADER_CACHES.lock().unwrap();
    caches.remove(&cache_handle);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[test]
    fn test_detect_shader_stage() {
        assert_eq!(detect_shader_stage("shader.vert"), ShaderStage::Vertex);
        assert_eq!(detect_shader_stage("shader.vs"), ShaderStage::Vertex);
        assert_eq!(detect_shader_stage("shader.frag"), ShaderStage::Fragment);
        assert_eq!(detect_shader_stage("shader.fs"), ShaderStage::Fragment);
        assert_eq!(detect_shader_stage("shader.comp"), ShaderStage::Compute);
        assert_eq!(detect_shader_stage("shader.cs"), ShaderStage::Compute);
        assert_eq!(detect_shader_stage("shader.wgsl"), ShaderStage::Compute);
        assert_eq!(detect_shader_stage("shader.unknown"), ShaderStage::Compute); // Default
    }

    #[test]
    fn test_shader_cache_from_string() {
        let mut cache = ShaderCache::new();

        let source = cache.load_from_string(
            "@compute @workgroup_size(64) fn main() {}".to_string(),
            ShaderStage::Compute,
            "main".to_string(),
        );

        assert_eq!(source.stage, ShaderStage::Compute);
        assert_eq!(source.entry_point, "main");
        assert!(source.code.contains("@compute"));
    }

    #[test]
    fn test_shader_cache_stats() {
        let cache = ShaderCache::new();
        let stats = cache.stats();
        assert_eq!(stats.cached_shaders, 0);
    }

    #[test]
    fn test_shader_cache_load_from_file() {
        // Create a temporary shader file
        let test_shader = "test_shader.wgsl";
        let mut file = fs::File::create(test_shader).unwrap();
        file.write_all(b"@compute @workgroup_size(64) fn main() {}").unwrap();
        drop(file);

        // Load shader
        let mut cache = ShaderCache::new();
        let result = cache.load(test_shader.to_string());
        assert!(result.is_ok());

        let source = result.unwrap();
        assert_eq!(source.stage, ShaderStage::Compute);
        assert!(source.code.contains("@compute"));
        assert_eq!(source.file_path, Some(test_shader.to_string()));

        // Load again (should use cache)
        let result2 = cache.load(test_shader.to_string());
        assert!(result2.is_ok());

        // Clean up
        fs::remove_file(test_shader).unwrap();
    }

    #[test]
    fn test_shader_cache_has_changed() {
        // Create a temporary shader file
        let test_shader = "test_shader_change.wgsl";
        let mut file = fs::File::create(test_shader).unwrap();
        file.write_all(b"@compute @workgroup_size(64) fn main() {}").unwrap();
        drop(file);

        // Load shader
        let mut cache = ShaderCache::new();
        cache.load(test_shader.to_string()).unwrap();

        // Check if changed (should be false)
        assert!(!cache.has_changed(test_shader));

        // Wait a bit and modify file
        std::thread::sleep(std::time::Duration::from_millis(100));
        let mut file = fs::File::create(test_shader).unwrap();
        file.write_all(b"@compute @workgroup_size(128) fn main() {}").unwrap();
        drop(file);

        // Check if changed (should be true)
        assert!(cache.has_changed(test_shader));

        // Clean up
        fs::remove_file(test_shader).unwrap();
    }
}
