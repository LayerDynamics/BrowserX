/// Texture utilities for WebGPU operations
///
/// This module provides helper functions for texture operations including:
/// - Mipmap level calculation
/// - Texture size computation at specific mip levels
/// - Texture copy descriptors
/// - Sampler configuration

use serde::{Deserialize, Serialize};

/// Calculate mipmap level count for texture dimensions
///
/// # Arguments
/// * `width` - Texture width in pixels
/// * `height` - Texture height in pixels
///
/// # Returns
/// Number of mipmap levels (including base level)
///
/// # Example
/// ```
/// let levels = calculate_mip_levels(1024, 1024);
/// assert_eq!(levels, 11); // log2(1024) + 1
/// ```
pub fn calculate_mip_levels(width: u32, height: u32) -> u32 {
    let max_dim = width.max(height);
    if max_dim == 0 {
        return 1;
    }
    // Number of times we can divide by 2 until we reach 1
    // This is equivalent to floor(log2(max_dim)) + 1
    (32 - max_dim.leading_zeros()) as u32
}

/// Calculate texture dimensions at specific mip level
///
/// # Arguments
/// * `width` - Base texture width
/// * `height` - Base texture height
/// * `mip_level` - Mipmap level (0 = base level)
///
/// # Returns
/// Tuple of (width, height) at the specified mip level (minimum 1x1)
pub fn get_mip_level_size(width: u32, height: u32, mip_level: u32) -> (u32, u32) {
    let mip_width = (width >> mip_level).max(1);
    let mip_height = (height >> mip_level).max(1);
    (mip_width, mip_height)
}

/// Calculate 3D texture dimensions at specific mip level
pub fn get_mip_level_size_3d(width: u32, height: u32, depth: u32, mip_level: u32) -> (u32, u32, u32) {
    let mip_width = (width >> mip_level).max(1);
    let mip_height = (height >> mip_level).max(1);
    let mip_depth = (depth >> mip_level).max(1);
    (mip_width, mip_height, mip_depth)
}

/// Texture format information
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextureFormat {
    // 8-bit formats
    R8Unorm,
    R8Snorm,
    R8Uint,
    R8Sint,

    // 16-bit formats
    R16Uint,
    R16Sint,
    R16Float,
    RG8Unorm,
    RG8Snorm,
    RG8Uint,
    RG8Sint,

    // 32-bit formats
    R32Uint,
    R32Sint,
    R32Float,
    RG16Uint,
    RG16Sint,
    RG16Float,
    RGBA8Unorm,
    RGBA8UnormSrgb,
    RGBA8Snorm,
    RGBA8Uint,
    RGBA8Sint,
    BGRA8Unorm,
    BGRA8UnormSrgb,

    // Packed 32-bit formats
    RGB10A2Unorm,
    RG11B10Float,

    // 64-bit formats
    RG32Uint,
    RG32Sint,
    RG32Float,
    RGBA16Uint,
    RGBA16Sint,
    RGBA16Float,

    // 128-bit formats
    RGBA32Uint,
    RGBA32Sint,
    RGBA32Float,

    // Depth/stencil formats
    Depth32Float,
    Depth24Plus,
    Depth24PlusStencil8,
    Depth32FloatStencil8,

    // BC compressed formats (Desktop)
    BC1RGBAUnorm,
    BC1RGBAUnormSrgb,
    BC2RGBAUnorm,
    BC2RGBAUnormSrgb,
    BC3RGBAUnorm,
    BC3RGBAUnormSrgb,
    BC4RUnorm,
    BC4RSnorm,
    BC5RGUnorm,
    BC5RGSnorm,
    BC6HRGBUfloat,
    BC6HRGBSfloat,
    BC7RGBAUnorm,
    BC7RGBAUnormSrgb,

    // ETC2 compressed formats (Mobile)
    ETC2RGB8Unorm,
    ETC2RGB8UnormSrgb,
    ETC2RGB8A1Unorm,
    ETC2RGB8A1UnormSrgb,
    ETC2RGBA8Unorm,
    ETC2RGBA8UnormSrgb,
    EACR11Unorm,
    EACR11Snorm,
    EACRG11Unorm,
    EACRG11Snorm,

    // ASTC compressed formats (Mobile)
    ASTC4x4Unorm,
    ASTC4x4UnormSrgb,
    ASTC5x4Unorm,
    ASTC5x4UnormSrgb,
    ASTC5x5Unorm,
    ASTC5x5UnormSrgb,
    ASTC6x5Unorm,
    ASTC6x5UnormSrgb,
    ASTC6x6Unorm,
    ASTC6x6UnormSrgb,
    ASTC8x5Unorm,
    ASTC8x5UnormSrgb,
    ASTC8x6Unorm,
    ASTC8x6UnormSrgb,
    ASTC8x8Unorm,
    ASTC8x8UnormSrgb,
    ASTC10x5Unorm,
    ASTC10x5UnormSrgb,
    ASTC10x6Unorm,
    ASTC10x6UnormSrgb,
    ASTC10x8Unorm,
    ASTC10x8UnormSrgb,
    ASTC10x10Unorm,
    ASTC10x10UnormSrgb,
    ASTC12x10Unorm,
    ASTC12x10UnormSrgb,
    ASTC12x12Unorm,
    ASTC12x12UnormSrgb,
}

impl TextureFormat {
    /// Get the number of bytes per texel for this format
    pub fn bytes_per_texel(&self) -> u32 {
        match self {
            // 8-bit formats
            Self::R8Unorm | Self::R8Snorm | Self::R8Uint | Self::R8Sint => 1,

            // 16-bit formats
            Self::R16Uint | Self::R16Sint | Self::R16Float |
            Self::RG8Unorm | Self::RG8Snorm | Self::RG8Uint | Self::RG8Sint => 2,

            // 32-bit formats
            Self::R32Uint | Self::R32Sint | Self::R32Float |
            Self::RG16Uint | Self::RG16Sint | Self::RG16Float |
            Self::RGBA8Unorm | Self::RGBA8UnormSrgb | Self::RGBA8Snorm |
            Self::RGBA8Uint | Self::RGBA8Sint |
            Self::BGRA8Unorm | Self::BGRA8UnormSrgb |
            Self::RGB10A2Unorm | Self::RG11B10Float |
            Self::Depth32Float | Self::Depth24Plus | Self::Depth24PlusStencil8 => 4,

            // 64-bit formats
            Self::RG32Uint | Self::RG32Sint | Self::RG32Float |
            Self::RGBA16Uint | Self::RGBA16Sint | Self::RGBA16Float |
            Self::Depth32FloatStencil8 => 8,

            // 128-bit formats
            Self::RGBA32Uint | Self::RGBA32Sint | Self::RGBA32Float => 16,

            // Compressed formats (bytes per 4x4 block)
            Self::BC1RGBAUnorm | Self::BC1RGBAUnormSrgb |
            Self::BC4RUnorm | Self::BC4RSnorm => 8, // 0.5 bytes per texel, 8 bytes per 4x4 block

            Self::BC2RGBAUnorm | Self::BC2RGBAUnormSrgb |
            Self::BC3RGBAUnorm | Self::BC3RGBAUnormSrgb |
            Self::BC5RGUnorm | Self::BC5RGSnorm |
            Self::BC6HRGBUfloat | Self::BC6HRGBSfloat |
            Self::BC7RGBAUnorm | Self::BC7RGBAUnormSrgb => 16, // 1 byte per texel, 16 bytes per 4x4 block

            // ETC2/EAC formats (4x4 blocks)
            Self::ETC2RGB8Unorm | Self::ETC2RGB8UnormSrgb |
            Self::ETC2RGB8A1Unorm | Self::ETC2RGB8A1UnormSrgb |
            Self::EACR11Unorm | Self::EACR11Snorm => 8,

            Self::ETC2RGBA8Unorm | Self::ETC2RGBA8UnormSrgb |
            Self::EACRG11Unorm | Self::EACRG11Snorm => 16,

            // ASTC formats (variable block size, return bytes per smallest block)
            Self::ASTC4x4Unorm | Self::ASTC4x4UnormSrgb |
            Self::ASTC5x4Unorm | Self::ASTC5x4UnormSrgb |
            Self::ASTC5x5Unorm | Self::ASTC5x5UnormSrgb |
            Self::ASTC6x5Unorm | Self::ASTC6x5UnormSrgb |
            Self::ASTC6x6Unorm | Self::ASTC6x6UnormSrgb |
            Self::ASTC8x5Unorm | Self::ASTC8x5UnormSrgb |
            Self::ASTC8x6Unorm | Self::ASTC8x6UnormSrgb |
            Self::ASTC8x8Unorm | Self::ASTC8x8UnormSrgb |
            Self::ASTC10x5Unorm | Self::ASTC10x5UnormSrgb |
            Self::ASTC10x6Unorm | Self::ASTC10x6UnormSrgb |
            Self::ASTC10x8Unorm | Self::ASTC10x8UnormSrgb |
            Self::ASTC10x10Unorm | Self::ASTC10x10UnormSrgb |
            Self::ASTC12x10Unorm | Self::ASTC12x10UnormSrgb |
            Self::ASTC12x12Unorm | Self::ASTC12x12UnormSrgb => 16, // All ASTC blocks are 16 bytes
        }
    }

    /// Check if this format is compressed
    pub fn is_compressed(&self) -> bool {
        matches!(self,
            Self::BC1RGBAUnorm | Self::BC1RGBAUnormSrgb |
            Self::BC2RGBAUnorm | Self::BC2RGBAUnormSrgb |
            Self::BC3RGBAUnorm | Self::BC3RGBAUnormSrgb |
            Self::BC4RUnorm | Self::BC4RSnorm |
            Self::BC5RGUnorm | Self::BC5RGSnorm |
            Self::BC6HRGBUfloat | Self::BC6HRGBSfloat |
            Self::BC7RGBAUnorm | Self::BC7RGBAUnormSrgb |
            Self::ETC2RGB8Unorm | Self::ETC2RGB8UnormSrgb |
            Self::ETC2RGB8A1Unorm | Self::ETC2RGB8A1UnormSrgb |
            Self::ETC2RGBA8Unorm | Self::ETC2RGBA8UnormSrgb |
            Self::EACR11Unorm | Self::EACR11Snorm |
            Self::EACRG11Unorm | Self::EACRG11Snorm |
            Self::ASTC4x4Unorm | Self::ASTC4x4UnormSrgb |
            Self::ASTC5x4Unorm | Self::ASTC5x4UnormSrgb |
            Self::ASTC5x5Unorm | Self::ASTC5x5UnormSrgb |
            Self::ASTC6x5Unorm | Self::ASTC6x5UnormSrgb |
            Self::ASTC6x6Unorm | Self::ASTC6x6UnormSrgb |
            Self::ASTC8x5Unorm | Self::ASTC8x5UnormSrgb |
            Self::ASTC8x6Unorm | Self::ASTC8x6UnormSrgb |
            Self::ASTC8x8Unorm | Self::ASTC8x8UnormSrgb |
            Self::ASTC10x5Unorm | Self::ASTC10x5UnormSrgb |
            Self::ASTC10x6Unorm | Self::ASTC10x6UnormSrgb |
            Self::ASTC10x8Unorm | Self::ASTC10x8UnormSrgb |
            Self::ASTC10x10Unorm | Self::ASTC10x10UnormSrgb |
            Self::ASTC12x10Unorm | Self::ASTC12x10UnormSrgb |
            Self::ASTC12x12Unorm | Self::ASTC12x12UnormSrgb
        )
    }
}

/// Texture copy region descriptor
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct TextureCopyDescriptor {
    pub src_x: u32,
    pub src_y: u32,
    pub src_z: u32,
    pub dst_x: u32,
    pub dst_y: u32,
    pub dst_z: u32,
    pub width: u32,
    pub height: u32,
    pub depth: u32,
    pub src_mip_level: u32,
    pub dst_mip_level: u32,
    pub src_array_layer: u32,
    pub dst_array_layer: u32,
}

impl Default for TextureCopyDescriptor {
    fn default() -> Self {
        Self {
            src_x: 0,
            src_y: 0,
            src_z: 0,
            dst_x: 0,
            dst_y: 0,
            dst_z: 0,
            width: 0,
            height: 0,
            depth: 1,
            src_mip_level: 0,
            dst_mip_level: 0,
            src_array_layer: 0,
            dst_array_layer: 0,
        }
    }
}

/// Sampler address mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AddressMode {
    ClampToEdge,
    Repeat,
    MirrorRepeat,
}

/// Sampler filter mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FilterMode {
    Nearest,
    Linear,
}

/// Sampler configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SamplerConfig {
    pub address_mode_u: AddressMode,
    pub address_mode_v: AddressMode,
    pub address_mode_w: AddressMode,
    pub mag_filter: FilterMode,
    pub min_filter: FilterMode,
    pub mipmap_filter: FilterMode,
    pub lod_min_clamp: f32,
    pub lod_max_clamp: f32,
    pub compare: Option<CompareFunction>,
    pub max_anisotropy: u32,
}

/// Compare function for depth/stencil testing
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompareFunction {
    Never,
    Less,
    Equal,
    LessEqual,
    Greater,
    NotEqual,
    GreaterEqual,
    Always,
}

impl Default for SamplerConfig {
    fn default() -> Self {
        Self {
            address_mode_u: AddressMode::ClampToEdge,
            address_mode_v: AddressMode::ClampToEdge,
            address_mode_w: AddressMode::ClampToEdge,
            mag_filter: FilterMode::Linear,
            min_filter: FilterMode::Linear,
            mipmap_filter: FilterMode::Linear,
            lod_min_clamp: 0.0,
            lod_max_clamp: 32.0,
            compare: None,
            max_anisotropy: 1,
        }
    }
}

impl SamplerConfig {
    /// Create nearest-neighbor sampler (pixelated)
    pub fn nearest() -> Self {
        Self {
            mag_filter: FilterMode::Nearest,
            min_filter: FilterMode::Nearest,
            mipmap_filter: FilterMode::Nearest,
            ..Default::default()
        }
    }

    /// Create linear sampler (smooth)
    pub fn linear() -> Self {
        Self::default()
    }

    /// Create anisotropic sampler for high-quality texture filtering
    pub fn anisotropic(max_anisotropy: u32) -> Self {
        Self {
            max_anisotropy,
            ..Self::linear()
        }
    }

    /// Create sampler for shadow mapping
    pub fn shadow() -> Self {
        Self {
            address_mode_u: AddressMode::ClampToEdge,
            address_mode_v: AddressMode::ClampToEdge,
            address_mode_w: AddressMode::ClampToEdge,
            mag_filter: FilterMode::Linear,
            min_filter: FilterMode::Linear,
            mipmap_filter: FilterMode::Nearest,
            compare: Some(CompareFunction::LessEqual),
            ..Default::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mipmap_level_calculation() {
        assert_eq!(calculate_mip_levels(1024, 1024), 11); // log2(1024) + 1
        assert_eq!(calculate_mip_levels(512, 512), 10);
        assert_eq!(calculate_mip_levels(256, 128), 9); // Uses max dimension
        assert_eq!(calculate_mip_levels(1, 1), 1);
        assert_eq!(calculate_mip_levels(0, 0), 1); // Edge case
    }

    #[test]
    fn test_mip_level_sizes() {
        // 1024x1024 texture
        assert_eq!(get_mip_level_size(1024, 1024, 0), (1024, 1024));
        assert_eq!(get_mip_level_size(1024, 1024, 1), (512, 512));
        assert_eq!(get_mip_level_size(1024, 1024, 10), (1, 1));

        // Non-square texture
        assert_eq!(get_mip_level_size(512, 256, 0), (512, 256));
        assert_eq!(get_mip_level_size(512, 256, 1), (256, 128));
        assert_eq!(get_mip_level_size(512, 256, 8), (2, 1));
        assert_eq!(get_mip_level_size(512, 256, 9), (1, 1));
    }

    #[test]
    fn test_texture_format_bytes() {
        assert_eq!(TextureFormat::R8Unorm.bytes_per_texel(), 1);
        assert_eq!(TextureFormat::RGBA8Unorm.bytes_per_texel(), 4);
        assert_eq!(TextureFormat::RGBA16Float.bytes_per_texel(), 8);
        assert_eq!(TextureFormat::RGBA32Float.bytes_per_texel(), 16);
    }

    #[test]
    fn test_texture_format_compressed() {
        assert!(!TextureFormat::RGBA8Unorm.is_compressed());
        assert!(TextureFormat::BC1RGBAUnorm.is_compressed());
        assert!(TextureFormat::ETC2RGB8Unorm.is_compressed());
        assert!(TextureFormat::ASTC4x4Unorm.is_compressed());
    }

    #[test]
    fn test_sampler_presets() {
        let nearest = SamplerConfig::nearest();
        assert_eq!(nearest.mag_filter, FilterMode::Nearest);

        let linear = SamplerConfig::linear();
        assert_eq!(linear.mag_filter, FilterMode::Linear);

        let aniso = SamplerConfig::anisotropic(16);
        assert_eq!(aniso.max_anisotropy, 16);

        let shadow = SamplerConfig::shadow();
        assert!(shadow.compare.is_some());
    }
}
