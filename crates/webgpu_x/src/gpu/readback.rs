//! GPU Texture Readback
//!
//! Provides functionality to read GPU texture data back to CPU memory.
//! This is essential for the `getPixels()` functionality in BrowserX.
//!
//! The readback process involves:
//! 1. Creating a staging buffer with MAP_READ usage
//! 2. Copying texture data to the buffer via command encoder
//! 3. Mapping the buffer and reading data back to CPU
//! 4. Handling async mapping with pollster

use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use wgpu;

use super::device::{DEVICES, TEXTURES};

// ============================================================================
// Handle Generation
// ============================================================================

static NEXT_READBACK_BUFFER_HANDLE: AtomicU64 = AtomicU64::new(1);

fn next_readback_buffer_handle() -> u64 {
    NEXT_READBACK_BUFFER_HANDLE.fetch_add(1, Ordering::SeqCst)
}

// ============================================================================
// Global Storage
// ============================================================================

lazy_static::lazy_static! {
    /// Storage for readback buffers
    pub static ref READBACK_BUFFERS: RwLock<HashMap<u64, wgpu::Buffer>> = RwLock::new(HashMap::new());

    /// Mapping of buffer handles to their sizes for reading
    static ref BUFFER_SIZES: RwLock<HashMap<u64, u64>> = RwLock::new(HashMap::new());
}

// ============================================================================
// Readback Buffer Creation
// ============================================================================

/// Create a readback buffer for texture data
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `size` - Size of the buffer in bytes
///
/// # Returns
/// Buffer handle or 0 on failure
pub fn gpu_create_readback_buffer(device_handle: u64, size: u64) -> u64 {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return 0,
    };

    // Create buffer with MAP_READ and COPY_DST usage
    let buffer = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("readback_buffer"),
        size,
        usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    });

    let handle = next_readback_buffer_handle();

    // Store buffer and its size
    READBACK_BUFFERS.write().insert(handle, buffer);
    BUFFER_SIZES.write().insert(handle, size);

    handle
}

// ============================================================================
// Texture to Buffer Copy
// ============================================================================

/// Copy texture to readback buffer
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device
/// * `texture_handle` - Handle to the source texture
/// * `buffer_handle` - Handle to the destination readback buffer
/// * `width` - Width of the texture region to copy
/// * `height` - Height of the texture region to copy
/// * `bytes_per_row` - Bytes per row (must be aligned to 256 bytes for WebGPU)
///
/// # Returns
/// true on success, false on failure
pub fn gpu_copy_texture_to_buffer(
    device_handle: u64,
    texture_handle: u64,
    buffer_handle: u64,
    width: u32,
    height: u32,
    bytes_per_row: u32,
) -> bool {
    let devices = DEVICES.read();
    let (device, queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return false,
    };

    let textures = TEXTURES.read();
    let texture = match textures.get(&texture_handle) {
        Some(t) => t,
        None => return false,
    };

    let buffers = READBACK_BUFFERS.read();
    let buffer = match buffers.get(&buffer_handle) {
        Some(b) => b,
        None => return false,
    };

    // Create command encoder
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("readback_encoder"),
    });

    // Copy texture to buffer
    encoder.copy_texture_to_buffer(
        wgpu::ImageCopyTexture {
            texture,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        wgpu::ImageCopyBuffer {
            buffer,
            layout: wgpu::ImageDataLayout {
                offset: 0,
                bytes_per_row: Some(bytes_per_row),
                rows_per_image: Some(height),
            },
        },
        wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        },
    );

    // Submit the command
    queue.submit(std::iter::once(encoder.finish()));

    true
}

// ============================================================================
// Buffer Mapping and Reading
// ============================================================================

/// Map buffer and read data back to CPU
///
/// # Arguments
/// * `device_handle` - Handle to the GPU device (needed for polling)
/// * `buffer_handle` - Handle to the readback buffer
///
/// # Returns
/// JSON-encoded Vec<u8> containing the pixel data, or empty string on failure
pub fn gpu_map_and_read_buffer(device_handle: u64, buffer_handle: u64) -> String {
    let devices = DEVICES.read();
    let (device, _queue) = match devices.get(&device_handle) {
        Some(d) => d,
        None => return String::new(),
    };

    let buffers = READBACK_BUFFERS.read();
    let buffer = match buffers.get(&buffer_handle) {
        Some(b) => b,
        None => return String::new(),
    };

    let sizes = BUFFER_SIZES.read();
    let size = match sizes.get(&buffer_handle) {
        Some(s) => *s,
        None => return String::new(),
    };

    // Map the buffer asynchronously
    let buffer_slice = buffer.slice(..);

    // Use a channel to communicate map completion
    let (sender, receiver) = std::sync::mpsc::channel();

    buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
        let _ = sender.send(result);
    });

    // Poll the device until the buffer is mapped
    device.poll(wgpu::Maintain::Wait);

    // Wait for mapping to complete
    match receiver.recv() {
        Ok(Ok(())) => {
            // Read the data
            let data = buffer_slice.get_mapped_range();
            let bytes: Vec<u8> = data.to_vec();

            // Unmap the buffer
            drop(data);
            buffer.unmap();

            // Verify we got the expected size
            if bytes.len() as u64 != size {
                // Truncate or pad to expected size
                let mut result = bytes;
                result.truncate(size as usize);
                while (result.len() as u64) < size {
                    result.push(0);
                }
                serde_json::to_string(&result).unwrap_or_default()
            } else {
                serde_json::to_string(&bytes).unwrap_or_default()
            }
        }
        _ => String::new(),
    }
}

// ============================================================================
// Cleanup
// ============================================================================

/// Destroy a readback buffer and release its resources
///
/// # Arguments
/// * `handle` - Handle to the readback buffer to destroy
pub fn gpu_destroy_readback_buffer(handle: u64) {
    READBACK_BUFFERS.write().remove(&handle);
    BUFFER_SIZES.write().remove(&handle);
}

/// Clean up all readback buffers
pub fn gpu_cleanup_readback_buffers() {
    READBACK_BUFFERS.write().clear();
    BUFFER_SIZES.write().clear();
}

// ============================================================================
// Utility Functions
// ============================================================================

/// Calculate the required bytes per row with proper alignment (256 bytes for WebGPU)
///
/// # Arguments
/// * `width` - Width of the texture in pixels
/// * `bytes_per_pixel` - Bytes per pixel (e.g., 4 for RGBA8)
///
/// # Returns
/// Aligned bytes per row
pub fn calculate_aligned_bytes_per_row(width: u32, bytes_per_pixel: u32) -> u32 {
    const COPY_BYTES_PER_ROW_ALIGNMENT: u32 = 256;
    let unaligned = width * bytes_per_pixel;
    let aligned = ((unaligned + COPY_BYTES_PER_ROW_ALIGNMENT - 1) / COPY_BYTES_PER_ROW_ALIGNMENT)
        * COPY_BYTES_PER_ROW_ALIGNMENT;
    aligned
}

/// Calculate the required buffer size for a texture readback
///
/// # Arguments
/// * `width` - Width of the texture in pixels
/// * `height` - Height of the texture in pixels
/// * `bytes_per_pixel` - Bytes per pixel (e.g., 4 for RGBA8)
///
/// # Returns
/// Required buffer size in bytes
pub fn calculate_readback_buffer_size(width: u32, height: u32, bytes_per_pixel: u32) -> u64 {
    let bytes_per_row = calculate_aligned_bytes_per_row(width, bytes_per_pixel);
    (bytes_per_row as u64) * (height as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aligned_bytes_per_row() {
        // 100 pixels * 4 bytes = 400 bytes, should align to 512
        assert_eq!(calculate_aligned_bytes_per_row(100, 4), 512);

        // 256 pixels * 4 bytes = 1024 bytes, already aligned
        assert_eq!(calculate_aligned_bytes_per_row(256, 4), 1024);

        // 1 pixel * 4 bytes = 4 bytes, should align to 256
        assert_eq!(calculate_aligned_bytes_per_row(1, 4), 256);
    }

    #[test]
    fn test_readback_buffer_size() {
        // 100x100 RGBA8 texture
        let size = calculate_readback_buffer_size(100, 100, 4);
        // 100 * 4 = 400 -> aligned to 512
        // 512 * 100 = 51200
        assert_eq!(size, 51200);
    }
}
