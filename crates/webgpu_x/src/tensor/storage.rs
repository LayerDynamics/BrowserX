use serde::{Deserialize, Serialize};

/// Tensor data type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum TensorDType {
    Float32 = 0,
    Float16 = 1,
    Int32 = 2,
    Int8 = 3,
    UInt8 = 4,
}

impl Serialize for TensorDType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_u32(*self as u32)
    }
}

impl<'de> Deserialize<'de> for TensorDType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = u32::deserialize(deserializer)?;
        match value {
            0 => Ok(TensorDType::Float32),
            1 => Ok(TensorDType::Float16),
            2 => Ok(TensorDType::Int32),
            3 => Ok(TensorDType::Int8),
            4 => Ok(TensorDType::UInt8),
            _ => Err(serde::de::Error::custom("Invalid TensorDType value")),
        }
    }
}

impl TensorDType {
    /// Get size in bytes for this data type
    pub fn size_bytes(&self) -> u64 {
        match self {
            TensorDType::Float32 | TensorDType::Int32 => 4,
            TensorDType::Float16 => 2,
            TensorDType::Int8 | TensorDType::UInt8 => 1,
        }
    }

    /// Get WGSL type name
    pub fn wgsl_type(&self) -> &'static str {
        match self {
            TensorDType::Float32 => "f32",
            TensorDType::Float16 => "f16",
            TensorDType::Int32 => "i32",
            TensorDType::Int8 => "i8",
            TensorDType::UInt8 => "u8",
        }
    }
}

/// Tensor access pattern
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum TensorAccess {
    ReadOnly = 0,
    WriteOnly = 1,
    ReadWrite = 2,
    Uniform = 3,
}

impl Serialize for TensorAccess {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_u32(*self as u32)
    }
}

impl<'de> Deserialize<'de> for TensorAccess {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = u32::deserialize(deserializer)?;
        match value {
            0 => Ok(TensorAccess::ReadOnly),
            1 => Ok(TensorAccess::WriteOnly),
            2 => Ok(TensorAccess::ReadWrite),
            3 => Ok(TensorAccess::Uniform),
            _ => Err(serde::de::Error::custom("Invalid TensorAccess value")),
        }
    }
}

impl TensorAccess {
    /// Get WGSL storage access qualifier
    pub fn wgsl_qualifier(&self) -> &'static str {
        match self {
            TensorAccess::ReadOnly => "read",
            TensorAccess::WriteOnly => "write",
            TensorAccess::ReadWrite => "read_write",
            TensorAccess::Uniform => "", // Uniform buffers don't use storage qualifiers
        }
    }
}

/// Tensor shape with dimension information
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TensorShape {
    pub dimensions: Vec<u32>,
}

impl TensorShape {
    /// Create new tensor shape
    pub fn new(dimensions: Vec<u32>) -> Self {
        Self { dimensions }
    }

    /// Get rank (number of dimensions)
    pub fn rank(&self) -> u32 {
        self.dimensions.len() as u32
    }

    /// Get total number of elements
    pub fn total_elements(&self) -> u64 {
        if self.dimensions.is_empty() {
            return 0;
        }
        self.dimensions.iter().map(|&d| d as u64).product()
    }

    /// Get stride for a specific dimension
    /// Stride is the number of elements to skip to move one position along this dimension
    pub fn stride(&self, dim: usize) -> u64 {
        if dim >= self.dimensions.len() {
            return 0;
        }
        self.dimensions[dim + 1..]
            .iter()
            .map(|&d| d as u64)
            .product()
    }

    /// Get all strides
    pub fn strides(&self) -> Vec<u64> {
        (0..self.dimensions.len())
            .map(|i| self.stride(i))
            .collect()
    }

    /// Check if shape is compatible for broadcasting
    pub fn is_broadcastable_to(&self, other: &TensorShape) -> bool {
        if self.rank() > other.rank() {
            return false;
        }

        let offset = other.rank() as usize - self.rank() as usize;
        for (i, &dim) in self.dimensions.iter().enumerate() {
            let other_dim = other.dimensions[i + offset];
            if dim != 1 && dim != other_dim {
                return false;
            }
        }
        true
    }

    /// Reshape to new dimensions (must have same total elements)
    pub fn reshape(&self, new_dimensions: Vec<u32>) -> Result<TensorShape, String> {
        let new_shape = TensorShape::new(new_dimensions);
        if new_shape.total_elements() != self.total_elements() {
            return Err(format!(
                "Cannot reshape tensor with {} elements to shape with {} elements",
                self.total_elements(),
                new_shape.total_elements()
            ));
        }
        Ok(new_shape)
    }
}

/// Tensor metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TensorMeta {
    pub buffer_handle: u64,
    pub shape: TensorShape,
    pub dtype: TensorDType,
    pub access: TensorAccess,
    pub offset: u64,
    pub stride: Vec<u64>,
}

impl TensorMeta {
    /// Create new tensor metadata
    pub fn new(
        buffer_handle: u64,
        dimensions: Vec<u32>,
        dtype: TensorDType,
        access: TensorAccess,
    ) -> Self {
        let shape = TensorShape::new(dimensions);
        let stride = shape.strides();
        Self {
            buffer_handle,
            shape,
            dtype,
            access,
            offset: 0,
            stride,
        }
    }

    /// Get total size in bytes
    pub fn size_bytes(&self) -> u64 {
        let element_count = self.shape.total_elements();
        element_count * self.dtype.size_bytes()
    }

    /// Get rank (number of dimensions)
    pub fn rank(&self) -> u32 {
        self.shape.rank()
    }

    /// Get total number of elements
    pub fn total_elements(&self) -> u64 {
        self.shape.total_elements()
    }

    /// Reshape tensor to new dimensions
    pub fn reshape(&self, new_dimensions: Vec<u32>) -> Result<TensorMeta, String> {
        let new_shape = self.shape.reshape(new_dimensions)?;
        let new_stride = new_shape.strides();
        Ok(TensorMeta {
            buffer_handle: self.buffer_handle,
            shape: new_shape,
            dtype: self.dtype,
            access: self.access,
            offset: self.offset,
            stride: new_stride,
        })
    }

    /// Create a view (slice) of the tensor
    pub fn view(&self, offset_elements: u64) -> Result<TensorMeta, String> {
        if offset_elements >= self.total_elements() {
            return Err(format!(
                "Offset {} exceeds tensor size {}",
                offset_elements,
                self.total_elements()
            ));
        }

        let byte_offset = offset_elements * self.dtype.size_bytes();
        Ok(TensorMeta {
            buffer_handle: self.buffer_handle,
            shape: self.shape.clone(),
            dtype: self.dtype,
            access: self.access,
            offset: self.offset + byte_offset,
            stride: self.stride.clone(),
        })
    }

    /// Transpose 2D tensor
    pub fn transpose_2d(&self) -> Result<TensorMeta, String> {
        if self.rank() != 2 {
            return Err(format!(
                "transpose_2d requires 2D tensor, got {}D",
                self.rank()
            ));
        }

        let new_dimensions = vec![self.shape.dimensions[1], self.shape.dimensions[0]];
        let new_shape = TensorShape::new(new_dimensions);
        let new_stride = new_shape.strides();

        Ok(TensorMeta {
            buffer_handle: self.buffer_handle,
            shape: new_shape,
            dtype: self.dtype,
            access: self.access,
            offset: self.offset,
            stride: new_stride,
        })
    }

    /// Check if tensor is contiguous in memory
    pub fn is_contiguous(&self) -> bool {
        let expected_strides = self.shape.strides();
        self.stride == expected_strides
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tensor_shape_rank() {
        let shape = TensorShape::new(vec![2, 3, 4]);
        assert_eq!(shape.rank(), 3);
    }

    #[test]
    fn test_tensor_shape_total_elements() {
        let shape = TensorShape::new(vec![2, 3, 4]);
        assert_eq!(shape.total_elements(), 24);
    }

    #[test]
    fn test_tensor_shape_stride() {
        let shape = TensorShape::new(vec![2, 3, 4]);
        assert_eq!(shape.stride(0), 12); // 3 * 4
        assert_eq!(shape.stride(1), 4);  // 4
        assert_eq!(shape.stride(2), 1);  // 1
    }

    #[test]
    fn test_tensor_meta_size_bytes() {
        let tensor = TensorMeta::new(0, vec![2, 3, 4], TensorDType::Float32, TensorAccess::ReadWrite);
        assert_eq!(tensor.size_bytes(), 24 * 4); // 24 elements * 4 bytes
    }

    #[test]
    fn test_tensor_reshape() {
        let tensor = TensorMeta::new(0, vec![2, 3, 4], TensorDType::Float32, TensorAccess::ReadWrite);
        let reshaped = tensor.reshape(vec![4, 6]).unwrap();
        assert_eq!(reshaped.shape.dimensions, vec![4, 6]);
        assert_eq!(reshaped.total_elements(), 24);
    }

    #[test]
    fn test_tensor_transpose_2d() {
        let tensor = TensorMeta::new(0, vec![2, 3], TensorDType::Float32, TensorAccess::ReadWrite);
        let transposed = tensor.transpose_2d().unwrap();
        assert_eq!(transposed.shape.dimensions, vec![3, 2]);
    }

    #[test]
    fn test_tensor_dtype_size() {
        assert_eq!(TensorDType::Float32.size_bytes(), 4);
        assert_eq!(TensorDType::Float16.size_bytes(), 2);
        assert_eq!(TensorDType::Int32.size_bytes(), 4);
        assert_eq!(TensorDType::Int8.size_bytes(), 1);
        assert_eq!(TensorDType::UInt8.size_bytes(), 1);
    }

    #[test]
    fn test_tensor_is_contiguous() {
        let tensor = TensorMeta::new(0, vec![2, 3, 4], TensorDType::Float32, TensorAccess::ReadWrite);
        assert!(tensor.is_contiguous());
    }

    #[test]
    fn test_tensor_broadcastable() {
        let shape1 = TensorShape::new(vec![1, 3]);
        let shape2 = TensorShape::new(vec![2, 3]);
        assert!(shape1.is_broadcastable_to(&shape2));
    }
}
