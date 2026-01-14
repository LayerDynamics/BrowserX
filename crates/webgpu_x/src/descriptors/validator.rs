use deno_bindgen::deno_bindgen;
use serde_json::Value;

/// Field validation rule
pub enum ValidationRule {
    Required,
    Optional,
    Range { min: u64, max: u64 },
    Enum { values: Vec<String> },
    PowerOfTwo,
    NonZero,
}

/// Validation result
pub struct DescriptorValidationResult {
    pub valid: u8,
    pub error_count: u32,
    pub error_0: String,
    pub error_1: String,
    pub error_2: String,
    pub error_3: String,
    pub error_4: String,
}

impl DescriptorValidationResult {
    fn ok() -> Self {
        Self {
            valid: 1,
            error_count: 0,
            error_0: String::new(),
            error_1: String::new(),
            error_2: String::new(),
            error_3: String::new(),
            error_4: String::new(),
        }
    }

    fn with_error(error: String) -> Self {
        Self {
            valid: 0,
            error_count: 1,
            error_0: error,
            error_1: String::new(),
            error_2: String::new(),
            error_3: String::new(),
            error_4: String::new(),
        }
    }

    fn add_error(&mut self, error: String) {
        self.valid = 0;
        match self.error_count {
            0 => self.error_0 = error,
            1 => self.error_1 = error,
            2 => self.error_2 = error,
            3 => self.error_3 = error,
            4 => self.error_4 = error,
            _ => return, // Max 5 errors
        }
        self.error_count += 1;
    }
}

/// Validate descriptor field
fn validate_field(
    field_name: &str,
    value: Option<&Value>,
    rule: &ValidationRule,
) -> Result<(), String> {
    match rule {
        ValidationRule::Required => {
            if value.is_none() {
                return Err(format!("Required field '{}' is missing", field_name));
            }
        }
        ValidationRule::Optional => {
            // Always valid
        }
        ValidationRule::Range { min, max } => {
            if let Some(value) = value {
                if let Some(num) = value.as_u64() {
                    if num < *min || num > *max {
                        return Err(format!(
                            "Field '{}' value {} out of range [{}, {}]",
                            field_name, num, min, max
                        ));
                    }
                } else {
                    return Err(format!("Field '{}' must be a number", field_name));
                }
            }
        }
        ValidationRule::Enum { values } => {
            if let Some(value) = value {
                if let Some(string) = value.as_str() {
                    if !values.contains(&string.to_string()) {
                        return Err(format!(
                            "Field '{}' value '{}' not in allowed values: {:?}",
                            field_name, string, values
                        ));
                    }
                } else {
                    return Err(format!("Field '{}' must be a string", field_name));
                }
            }
        }
        ValidationRule::PowerOfTwo => {
            if let Some(value) = value {
                if let Some(num) = value.as_u64() {
                    if num == 0 || !num.is_power_of_two() {
                        return Err(format!(
                            "Field '{}' value {} must be power of 2",
                            field_name, num
                        ));
                    }
                } else {
                    return Err(format!("Field '{}' must be a number", field_name));
                }
            }
        }
        ValidationRule::NonZero => {
            if let Some(value) = value {
                if let Some(num) = value.as_u64() {
                    if num == 0 {
                        return Err(format!("Field '{}' must be non-zero", field_name));
                    }
                } else {
                    return Err(format!("Field '{}' must be a number", field_name));
                }
            }
        }
    }
    Ok(())
}

/// Validate buffer descriptor
pub fn validate_buffer_descriptor(descriptor_json: String) -> DescriptorValidationResult {
    let descriptor: Value = match serde_json::from_str(&descriptor_json) {
        Ok(d) => d,
        Err(e) => return DescriptorValidationResult::with_error(format!("Invalid JSON: {}", e)),
    };

    let obj = match descriptor.as_object() {
        Some(o) => o,
        None => return DescriptorValidationResult::with_error("Descriptor must be an object".to_string()),
    };

    let mut result = DescriptorValidationResult::ok();

    // Validate size field
    if let Err(e) = validate_field("size", obj.get("size"), &ValidationRule::Required) {
        result.add_error(e);
    }
    if let Err(e) = validate_field("size", obj.get("size"), &ValidationRule::NonZero) {
        result.add_error(e);
    }

    // Validate usage field
    if let Err(e) = validate_field("usage", obj.get("usage"), &ValidationRule::Required) {
        result.add_error(e);
    }

    result
}

/// Validate texture descriptor
pub fn validate_texture_descriptor(descriptor_json: String) -> DescriptorValidationResult {
    let descriptor: Value = match serde_json::from_str(&descriptor_json) {
        Ok(d) => d,
        Err(e) => return DescriptorValidationResult::with_error(format!("Invalid JSON: {}", e)),
    };

    let obj = match descriptor.as_object() {
        Some(o) => o,
        None => return DescriptorValidationResult::with_error("Descriptor must be an object".to_string()),
    };

    let mut result = DescriptorValidationResult::ok();

    // Validate size field
    if let Err(e) = validate_field("size", obj.get("size"), &ValidationRule::Required) {
        result.add_error(e);
    }

    // Validate format field
    if let Err(e) = validate_field("format", obj.get("format"), &ValidationRule::Required) {
        result.add_error(e);
    }

    // Validate usage field
    if let Err(e) = validate_field("usage", obj.get("usage"), &ValidationRule::Required) {
        result.add_error(e);
    }

    // Validate size.width and size.height if size is present
    if let Some(size) = obj.get("size") {
        if let Some(size_obj) = size.as_object() {
            if let Err(e) = validate_field("size.width", size_obj.get("width"), &ValidationRule::NonZero) {
                result.add_error(e);
            }
            if let Err(e) = validate_field("size.height", size_obj.get("height"), &ValidationRule::NonZero) {
                result.add_error(e);
            }
        }
    }

    result
}

/// Validate render pipeline descriptor
pub fn validate_render_pipeline_descriptor(descriptor_json: String) -> DescriptorValidationResult {
    let descriptor: Value = match serde_json::from_str(&descriptor_json) {
        Ok(d) => d,
        Err(e) => return DescriptorValidationResult::with_error(format!("Invalid JSON: {}", e)),
    };

    let obj = match descriptor.as_object() {
        Some(o) => o,
        None => return DescriptorValidationResult::with_error("Descriptor must be an object".to_string()),
    };

    let mut result = DescriptorValidationResult::ok();

    // Validate vertex field
    if let Err(e) = validate_field("vertex", obj.get("vertex"), &ValidationRule::Required) {
        result.add_error(e);
    }

    // Validate vertex.module if vertex is present
    if let Some(vertex) = obj.get("vertex") {
        if let Some(vertex_obj) = vertex.as_object() {
            if let Err(e) = validate_field("vertex.module", vertex_obj.get("module"), &ValidationRule::Required) {
                result.add_error(e);
            }
            if let Err(e) = validate_field("vertex.entryPoint", vertex_obj.get("entryPoint"), &ValidationRule::Required) {
                result.add_error(e);
            }
        }
    }

    result
}

/// Validate compute pipeline descriptor
pub fn validate_compute_pipeline_descriptor(descriptor_json: String) -> DescriptorValidationResult {
    let descriptor: Value = match serde_json::from_str(&descriptor_json) {
        Ok(d) => d,
        Err(e) => return DescriptorValidationResult::with_error(format!("Invalid JSON: {}", e)),
    };

    let obj = match descriptor.as_object() {
        Some(o) => o,
        None => return DescriptorValidationResult::with_error("Descriptor must be an object".to_string()),
    };

    let mut result = DescriptorValidationResult::ok();

    // Validate compute field
    if let Err(e) = validate_field("compute", obj.get("compute"), &ValidationRule::Required) {
        result.add_error(e);
    }

    // Validate compute.module if compute is present
    if let Some(compute) = obj.get("compute") {
        if let Some(compute_obj) = compute.as_object() {
            if let Err(e) = validate_field("compute.module", compute_obj.get("module"), &ValidationRule::Required) {
                result.add_error(e);
            }
            if let Err(e) = validate_field("compute.entryPoint", compute_obj.get("entryPoint"), &ValidationRule::Required) {
                result.add_error(e);
            }
        }
    }

    result
}

/// Validate bind group layout descriptor
pub fn validate_bind_group_layout_descriptor(descriptor_json: String) -> DescriptorValidationResult {
    let descriptor: Value = match serde_json::from_str(&descriptor_json) {
        Ok(d) => d,
        Err(e) => return DescriptorValidationResult::with_error(format!("Invalid JSON: {}", e)),
    };

    let obj = match descriptor.as_object() {
        Some(o) => o,
        None => return DescriptorValidationResult::with_error("Descriptor must be an object".to_string()),
    };

    let mut result = DescriptorValidationResult::ok();

    // Validate entries field
    if let Err(e) = validate_field("entries", obj.get("entries"), &ValidationRule::Required) {
        result.add_error(e);
    }

    // Validate entries is an array
    if let Some(entries) = obj.get("entries") {
        if !entries.is_array() {
            result.add_error("Field 'entries' must be an array".to_string());
        }
    }

    result
}
