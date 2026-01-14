/// Texture operations and utilities for WebGPU
///
/// This module provides comprehensive texture support including:
/// - Mipmap generation and level calculations
/// - Texture format information and conversion
/// - Texture copying and blitting operations
/// - Sampler configuration

pub mod utilities;

// Re-export public types and functions
pub use utilities::{
    calculate_mip_levels,
    get_mip_level_size,
    get_mip_level_size_3d,
    TextureFormat,
    TextureCopyDescriptor,
    AddressMode,
    FilterMode,
    SamplerConfig,
    CompareFunction,
};
