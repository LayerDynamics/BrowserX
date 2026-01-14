/// Calculate aligned size for buffer (4-byte or 256-byte alignment)
///
/// # Arguments
/// * `size` - The unaligned size in bytes
/// * `alignment` - The required alignment (must be power of 2)
///
/// # Returns
/// The size rounded up to the nearest multiple of alignment
///
/// # Example
/// ```
/// let aligned = calculate_aligned_size(100, 4); // Returns 100
/// let aligned = calculate_aligned_size(101, 4); // Returns 104
/// let aligned = calculate_aligned_size(100, 256); // Returns 256
/// ```
pub fn calculate_aligned_size(size: u64, alignment: u64) -> u64 {
    debug_assert!(alignment > 0 && (alignment & (alignment - 1)) == 0, "alignment must be a power of 2");

    let align_mask = alignment - 1;
    (size + align_mask) & !align_mask
}

/// Get alignment requirement for buffer usage
///
/// # Arguments
/// * `usage` - GPUBufferUsage flags
///
/// # Returns
/// Required alignment in bytes (4 or 256)
///
/// # WebGPU Buffer Usage Flags
/// - UNIFORM (0x0040) requires 256-byte alignment
/// - STORAGE (0x0080) requires 256-byte alignment
/// - Other usages require 4-byte alignment
///
/// # Example
/// ```
/// let alignment = get_buffer_alignment(0x0040); // UNIFORM -> 256
/// let alignment = get_buffer_alignment(0x0001); // MAP_READ -> 4
/// ```
pub fn get_buffer_alignment(usage: u32) -> u64 {
    const UNIFORM: u32 = 0x0040;  // GPUBufferUsage.UNIFORM
    const STORAGE: u32 = 0x0080;  // GPUBufferUsage.STORAGE

    if (usage & UNIFORM) != 0 || (usage & STORAGE) != 0 {
        256  // Uniform and storage buffers need 256-byte alignment
    } else {
        4    // Other buffers need 4-byte alignment
    }
}

/// Calculate row padding for texture buffer copies
///
/// WebGPU requires that bytes per row for texture copies be aligned to 256 bytes.
/// This function calculates how much padding is needed for a given row size.
///
/// # Arguments
/// * `row_size` - The actual size of one row in bytes
///
/// # Returns
/// Number of padding bytes needed to reach 256-byte alignment
///
/// # Example
/// ```
/// let padding = get_row_padding(100); // Returns 156 (100 + 156 = 256)
/// let padding = get_row_padding(256); // Returns 0 (already aligned)
/// let padding = get_row_padding(300); // Returns 212 (300 + 212 = 512)
/// ```
pub fn get_row_padding(row_size: u64) -> u64 {
    const COPY_BYTES_PER_ROW_ALIGNMENT: u64 = 256;
    let padded = calculate_aligned_size(row_size, COPY_BYTES_PER_ROW_ALIGNMENT);
    padded - row_size
}

/// Calculate padded row size for texture copies
///
/// # Arguments
/// * `row_size` - The actual size of one row in bytes
///
/// # Returns
/// The padded row size aligned to 256 bytes
pub fn get_padded_row_size(row_size: u64) -> u64 {
    const COPY_BYTES_PER_ROW_ALIGNMENT: u64 = 256;
    calculate_aligned_size(row_size, COPY_BYTES_PER_ROW_ALIGNMENT)
}

/// Calculate total buffer size needed for texture data with padding
///
/// # Arguments
/// * `width` - Texture width in pixels
/// * `height` - Texture height in pixels
/// * `bytes_per_pixel` - Number of bytes per pixel (e.g., 4 for RGBA8)
///
/// # Returns
/// Total buffer size in bytes including padding
pub fn calculate_texture_buffer_size(width: u32, height: u32, bytes_per_pixel: u32) -> u64 {
    let row_size = (width * bytes_per_pixel) as u64;
    let padded_row_size = get_padded_row_size(row_size);
    padded_row_size * height as u64
}

/// Buffer descriptor helper
#[derive(Debug, Clone)]
pub struct BufferDescriptor {
    pub size: u64,
    pub usage: u32,
    pub mapped_at_creation: bool,
}

impl BufferDescriptor {
    /// Create a new buffer descriptor with automatic size alignment
    pub fn new(size: u64, usage: u32) -> Self {
        let alignment = get_buffer_alignment(usage);
        let aligned_size = calculate_aligned_size(size, alignment);

        Self {
            size: aligned_size,
            usage,
            mapped_at_creation: false,
        }
    }

    /// Create a buffer descriptor for mapped-at-creation buffers
    pub fn new_mapped(size: u64, usage: u32) -> Self {
        let mut desc = Self::new(size, usage);
        desc.mapped_at_creation = true;
        desc
    }

    /// Create a uniform buffer descriptor
    pub fn uniform(size: u64) -> Self {
        const UNIFORM: u32 = 0x0040;
        const COPY_DST: u32 = 0x0008;
        Self::new(size, UNIFORM | COPY_DST)
    }

    /// Create a storage buffer descriptor
    pub fn storage(size: u64, writable: bool) -> Self {
        const STORAGE: u32 = 0x0080;
        const COPY_DST: u32 = 0x0008;
        const COPY_SRC: u32 = 0x0004;

        let usage = if writable {
            STORAGE | COPY_DST | COPY_SRC
        } else {
            STORAGE | COPY_DST
        };

        Self::new(size, usage)
    }

    /// Create a vertex buffer descriptor
    pub fn vertex(size: u64) -> Self {
        const VERTEX: u32 = 0x0020;
        const COPY_DST: u32 = 0x0008;
        Self::new(size, VERTEX | COPY_DST)
    }

    /// Create an index buffer descriptor
    pub fn index(size: u64) -> Self {
        const INDEX: u32 = 0x0010;
        const COPY_DST: u32 = 0x0008;
        Self::new(size, INDEX | COPY_DST)
    }

    /// Get the required alignment for this buffer
    pub fn alignment(&self) -> u64 {
        get_buffer_alignment(self.usage)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_aligned_size() {
        assert_eq!(calculate_aligned_size(100, 4), 100);
        assert_eq!(calculate_aligned_size(101, 4), 104);
        assert_eq!(calculate_aligned_size(102, 4), 104);
        assert_eq!(calculate_aligned_size(103, 4), 104);
        assert_eq!(calculate_aligned_size(104, 4), 104);
        assert_eq!(calculate_aligned_size(105, 4), 108);

        assert_eq!(calculate_aligned_size(100, 256), 256);
        assert_eq!(calculate_aligned_size(256, 256), 256);
        assert_eq!(calculate_aligned_size(257, 256), 512);
    }

    #[test]
    fn test_get_buffer_alignment() {
        const UNIFORM: u32 = 0x0040;
        const STORAGE: u32 = 0x0080;
        const VERTEX: u32 = 0x0020;

        assert_eq!(get_buffer_alignment(UNIFORM), 256);
        assert_eq!(get_buffer_alignment(STORAGE), 256);
        assert_eq!(get_buffer_alignment(UNIFORM | STORAGE), 256);
        assert_eq!(get_buffer_alignment(VERTEX), 4);
    }

    #[test]
    fn test_get_row_padding() {
        assert_eq!(get_row_padding(100), 156); // 100 + 156 = 256
        assert_eq!(get_row_padding(256), 0);   // Already aligned
        assert_eq!(get_row_padding(300), 212); // 300 + 212 = 512
    }

    #[test]
    fn test_get_padded_row_size() {
        assert_eq!(get_padded_row_size(100), 256);
        assert_eq!(get_padded_row_size(256), 256);
        assert_eq!(get_padded_row_size(300), 512);
    }

    #[test]
    fn test_calculate_texture_buffer_size() {
        // 100x100 RGBA8 texture (4 bytes per pixel)
        // Row size: 100 * 4 = 400 bytes
        // Padded row: 512 bytes
        // Total: 512 * 100 = 51200 bytes
        assert_eq!(calculate_texture_buffer_size(100, 100, 4), 51200);

        // 64x64 RGBA8 texture
        // Row size: 64 * 4 = 256 bytes (already aligned)
        // Total: 256 * 64 = 16384 bytes
        assert_eq!(calculate_texture_buffer_size(64, 64, 4), 16384);
    }

    #[test]
    fn test_buffer_descriptor() {
        let uniform = BufferDescriptor::uniform(100);
        assert_eq!(uniform.size, 256); // Aligned to 256
        assert_eq!(uniform.alignment(), 256);

        let storage = BufferDescriptor::storage(100, true);
        assert_eq!(storage.size, 256);

        let vertex = BufferDescriptor::vertex(100);
        assert_eq!(vertex.size, 100); // Aligned to 4
    }
}
