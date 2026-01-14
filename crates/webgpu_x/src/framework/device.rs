use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Device configuration for WebGPU device initialization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConfig {
    /// Required features that must be supported
    pub required_features: Vec<String>,
    /// Optional features to enable if available
    pub optional_features: Vec<String>,
    /// Required limits (name -> value)
    pub required_limits: HashMap<String, u64>,
}

impl Default for DeviceConfig {
    fn default() -> Self {
        Self {
            required_features: vec![],
            optional_features: vec![
                "timestamp-query".to_string(),
                "depth32float-stencil8".to_string(),
            ],
            required_limits: HashMap::new(),
        }
    }
}

/// Coordinate system conversion matrix (OpenGL to WGPU)
///
/// OpenGL uses a right-handed coordinate system with clip space z in [-1, 1]
/// WGPU (like Vulkan/Metal) uses clip space z in [0, 1]
/// This matrix converts OpenGL clip coordinates to WGPU clip coordinates
pub fn opengl_to_wgpu_matrix() -> [f32; 16] {
    [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 0.5, 0.0,
        0.0, 0.0, 0.5, 1.0,
    ]
}

/// Create perspective projection matrix
///
/// # Arguments
/// * `fov_y_radians` - Field of view in radians (vertical)
/// * `aspect_ratio` - Aspect ratio (width / height)
/// * `near` - Near clipping plane distance
/// * `far` - Far clipping plane distance
///
/// # Returns
/// 4x4 projection matrix in column-major order
pub fn create_perspective_matrix(
    fov_y_radians: f32,
    aspect_ratio: f32,
    near: f32,
    far: f32,
) -> [f32; 16] {
    let f = 1.0 / (fov_y_radians / 2.0).tan();
    let nf = 1.0 / (near - far);

    // Column-major order for GPU
    [
        f / aspect_ratio, 0.0, 0.0, 0.0,
        0.0, f, 0.0, 0.0,
        0.0, 0.0, (far + near) * nf, -1.0,
        0.0, 0.0, 2.0 * far * near * nf, 0.0,
    ]
}

/// Create orthographic projection matrix
///
/// # Arguments
/// * `left` - Left clipping plane coordinate
/// * `right` - Right clipping plane coordinate
/// * `bottom` - Bottom clipping plane coordinate
/// * `top` - Top clipping plane coordinate
/// * `near` - Near clipping plane distance
/// * `far` - Far clipping plane distance
///
/// # Returns
/// 4x4 projection matrix in column-major order
pub fn create_orthographic_matrix(
    left: f32,
    right: f32,
    bottom: f32,
    top: f32,
    near: f32,
    far: f32,
) -> [f32; 16] {
    let rl = 1.0 / (right - left);
    let tb = 1.0 / (top - bottom);
    let fn_ = 1.0 / (far - near);

    // Column-major order for GPU
    [
        2.0 * rl, 0.0, 0.0, 0.0,
        0.0, 2.0 * tb, 0.0, 0.0,
        0.0, 0.0, -2.0 * fn_, 0.0,
        -(right + left) * rl, -(top + bottom) * tb, -(far + near) * fn_, 1.0,
    ]
}

/// Create view matrix for camera
///
/// # Arguments
/// * `eye` - Camera position [x, y, z]
/// * `target` - Look-at target [x, y, z]
/// * `up` - Up vector [x, y, z]
///
/// # Returns
/// 4x4 view matrix in column-major order
pub fn create_view_matrix(eye: [f32; 3], target: [f32; 3], up: [f32; 3]) -> [f32; 16] {
    // Forward vector (z axis)
    let f = normalize([
        target[0] - eye[0],
        target[1] - eye[1],
        target[2] - eye[2],
    ]);

    // Right vector (x axis) = forward × up
    let r = normalize(cross(f, up));

    // Corrected up vector (y axis) = right × forward
    let u = cross(r, f);

    // View matrix (column-major)
    [
        r[0], u[0], -f[0], 0.0,
        r[1], u[1], -f[1], 0.0,
        r[2], u[2], -f[2], 0.0,
        -dot(r, eye), -dot(u, eye), dot(f, eye), 1.0,
    ]
}

/// Create model matrix from translation, rotation, and scale
///
/// # Arguments
/// * `translation` - Position [x, y, z]
/// * `rotation` - Rotation in radians [x, y, z] (Euler angles)
/// * `scale` - Scale factors [x, y, z]
///
/// # Returns
/// 4x4 model matrix in column-major order
pub fn create_model_matrix(
    translation: [f32; 3],
    rotation: [f32; 3],
    scale: [f32; 3],
) -> [f32; 16] {
    let (sin_x, cos_x) = rotation[0].sin_cos();
    let (sin_y, cos_y) = rotation[1].sin_cos();
    let (sin_z, cos_z) = rotation[2].sin_cos();

    // Combined rotation matrix (Z * Y * X)
    let r00 = cos_y * cos_z;
    let r01 = cos_y * sin_z;
    let r02 = -sin_y;

    let r10 = sin_x * sin_y * cos_z - cos_x * sin_z;
    let r11 = sin_x * sin_y * sin_z + cos_x * cos_z;
    let r12 = sin_x * cos_y;

    let r20 = cos_x * sin_y * cos_z + sin_x * sin_z;
    let r21 = cos_x * sin_y * sin_z - sin_x * cos_z;
    let r22 = cos_x * cos_y;

    // Apply scale and translation (column-major)
    [
        r00 * scale[0], r10 * scale[0], r20 * scale[0], 0.0,
        r01 * scale[1], r11 * scale[1], r21 * scale[1], 0.0,
        r02 * scale[2], r12 * scale[2], r22 * scale[2], 0.0,
        translation[0], translation[1], translation[2], 1.0,
    ]
}

// Helper functions for vector math

fn normalize(v: [f32; 3]) -> [f32; 3] {
    let len = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    if len > 0.0 {
        [v[0] / len, v[1] / len, v[2] / len]
    } else {
        [0.0, 0.0, 0.0]
    }
}

fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_opengl_to_wgpu_matrix() {
        let matrix = opengl_to_wgpu_matrix();
        assert_eq!(matrix[0], 1.0);
        assert_eq!(matrix[10], 0.5); // z scale
        assert_eq!(matrix[14], 0.5); // z offset
    }

    #[test]
    fn test_perspective_matrix() {
        let matrix = create_perspective_matrix(
            std::f32::consts::PI / 4.0, // 45 degrees
            16.0 / 9.0,
            0.1,
            100.0,
        );
        // Basic sanity checks
        assert!(matrix[0] > 0.0); // x scale
        assert!(matrix[5] > 0.0); // y scale
        assert!(matrix[10] < 0.0); // z projection
    }

    #[test]
    fn test_orthographic_matrix() {
        let matrix = create_orthographic_matrix(-1.0, 1.0, -1.0, 1.0, 0.0, 1.0);
        assert_eq!(matrix[0], 1.0); // x scale
        assert_eq!(matrix[5], 1.0); // y scale
        assert_eq!(matrix[10], -2.0); // z scale
    }

    #[test]
    fn test_normalize() {
        let v = normalize([3.0, 4.0, 0.0]);
        assert!((v[0] - 0.6).abs() < 0.001);
        assert!((v[1] - 0.8).abs() < 0.001);
        assert_eq!(v[2], 0.0);
    }

    #[test]
    fn test_cross_product() {
        let x = [1.0, 0.0, 0.0];
        let y = [0.0, 1.0, 0.0];
        let z = cross(x, y);
        assert_eq!(z, [0.0, 0.0, 1.0]);
    }

    #[test]
    fn test_dot_product() {
        let a = [1.0, 2.0, 3.0];
        let b = [4.0, 5.0, 6.0];
        let result = dot(a, b);
        assert_eq!(result, 32.0); // 1*4 + 2*5 + 3*6
    }
}
