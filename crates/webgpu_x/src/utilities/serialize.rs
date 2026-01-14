use deno_bindgen::deno_bindgen;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Serialize buffer descriptor to JSON
pub fn serialize_buffer_descriptor(
    size: u64,
    usage: u32,
    mapped_at_creation: bool,
    label: String,
) -> String {
    json!({
        "size": size,
        "usage": usage,
        "mappedAtCreation": mapped_at_creation,
        "label": label
    })
    .to_string()
}

/// Deserialize buffer descriptor from JSON
pub fn deserialize_buffer_descriptor(json_str: String) -> String {
    match serde_json::from_str::<Value>(&json_str) {
        Ok(val) => {
            json!({
                "size": val["size"].as_u64().unwrap_or(0),
                "usage": val["usage"].as_u64().unwrap_or(0),
                "mappedAtCreation": val["mappedAtCreation"].as_bool().unwrap_or(false),
                "label": val["label"].as_str().unwrap_or("")
            })
            .to_string()
        }
        Err(e) => json!({"error": e.to_string()}).to_string(),
    }
}

/// Serialize texture descriptor to JSON
pub fn serialize_texture_descriptor(
    width: u32,
    height: u32,
    depth: u32,
    format: String,
    usage: u32,
    dimension: String,
    mip_level_count: u32,
    sample_count: u32,
    label: String,
) -> String {
    json!({
        "size": {
            "width": width,
            "height": height,
            "depthOrArrayLayers": depth
        },
        "format": format,
        "usage": usage,
        "dimension": dimension,
        "mipLevelCount": mip_level_count,
        "sampleCount": sample_count,
        "label": label
    })
    .to_string()
}

/// Serialize sampler descriptor to JSON
pub fn serialize_sampler_descriptor(
    address_mode_u: String,
    address_mode_v: String,
    address_mode_w: String,
    mag_filter: String,
    min_filter: String,
    mipmap_filter: String,
    lod_min_clamp: f32,
    lod_max_clamp: f32,
    compare: String,
    max_anisotropy: u32,
) -> String {
    json!({
        "addressModeU": address_mode_u,
        "addressModeV": address_mode_v,
        "addressModeW": address_mode_w,
        "magFilter": mag_filter,
        "minFilter": min_filter,
        "mipmapFilter": mipmap_filter,
        "lodMinClamp": lod_min_clamp,
        "lodMaxClamp": lod_max_clamp,
        "compare": compare,
        "maxAnisotropy": max_anisotropy
    })
    .to_string()
}

/// Serialize bind group layout entry
pub fn serialize_bind_group_layout_entry(
    binding: u32,
    visibility: u32,
    binding_type: String,
    has_dynamic_offset: bool,
    min_binding_size: u64,
) -> String {
    json!({
        "binding": binding,
        "visibility": visibility,
        "buffer": {
            "type": binding_type,
            "hasDynamicOffset": has_dynamic_offset,
            "minBindingSize": min_binding_size
        }
    })
    .to_string()
}

/// Serialize shader module descriptor
pub fn serialize_shader_module_descriptor(code: String, label: String) -> String {
    json!({
        "code": code,
        "label": label
    })
    .to_string()
}

/// Serialize pipeline layout descriptor
pub fn serialize_pipeline_layout_descriptor(
    bind_group_layouts: Vec<u32>,
    label: String,
) -> String {
    json!({
        "bindGroupLayouts": bind_group_layouts,
        "label": label
    })
    .to_string()
}

/// Serialize vertex buffer layout
pub fn serialize_vertex_buffer_layout(
    array_stride: u64,
    step_mode: String,
    attributes: String,
) -> String {
    let attrs: Value = serde_json::from_str(&attributes).unwrap_or(json!([]));
    json!({
        "arrayStride": array_stride,
        "stepMode": step_mode,
        "attributes": attrs
    })
    .to_string()
}

/// Serialize vertex attribute
pub fn serialize_vertex_attribute(
    shader_location: u32,
    format: String,
    offset: u64,
) -> String {
    json!({
        "shaderLocation": shader_location,
        "format": format,
        "offset": offset
    })
    .to_string()
}

/// Serialize render pipeline descriptor
pub fn serialize_render_pipeline_descriptor(
    layout: u32,
    vertex_module: u32,
    vertex_entry_point: String,
    fragment_module: u32,
    fragment_entry_point: String,
    fragment_targets: String,
    primitive_topology: String,
    label: String,
) -> String {
    let targets: Value = serde_json::from_str(&fragment_targets).unwrap_or(json!([]));
    json!({
        "layout": layout,
        "vertex": {
            "module": vertex_module,
            "entryPoint": vertex_entry_point
        },
        "fragment": {
            "module": fragment_module,
            "entryPoint": fragment_entry_point,
            "targets": targets
        },
        "primitive": {
            "topology": primitive_topology
        },
        "label": label
    })
    .to_string()
}

/// Serialize compute pipeline descriptor
pub fn serialize_compute_pipeline_descriptor(
    layout: u32,
    compute_module: u32,
    entry_point: String,
    label: String,
) -> String {
    json!({
        "layout": layout,
        "compute": {
            "module": compute_module,
            "entryPoint": entry_point
        },
        "label": label
    })
    .to_string()
}

/// Serialize color target state
pub fn serialize_color_target_state(
    format: String,
    blend: String,
    write_mask: u32,
) -> String {
    let blend_val: Value = if blend.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&blend).unwrap_or(Value::Null)
    };

    json!({
        "format": format,
        "blend": blend_val,
        "writeMask": write_mask
    })
    .to_string()
}

/// Serialize blend state
pub fn serialize_blend_state(
    color_src_factor: String,
    color_dst_factor: String,
    color_operation: String,
    alpha_src_factor: String,
    alpha_dst_factor: String,
    alpha_operation: String,
) -> String {
    json!({
        "color": {
            "srcFactor": color_src_factor,
            "dstFactor": color_dst_factor,
            "operation": color_operation
        },
        "alpha": {
            "srcFactor": alpha_src_factor,
            "dstFactor": alpha_dst_factor,
            "operation": alpha_operation
        }
    })
    .to_string()
}

/// Parse JSON and extract field
pub fn json_get_field(json_str: String, field_path: String) -> String {
    match serde_json::from_str::<Value>(&json_str) {
        Ok(mut val) => {
            for part in field_path.split('.') {
                val = val.get(part).cloned().unwrap_or(Value::Null);
            }
            val.to_string()
        }
        Err(_) => "null".to_string(),
    }
}

/// Merge two JSON objects
pub fn json_merge(json1: String, json2: String) -> String {
    let val1: Value = serde_json::from_str(&json1).unwrap_or(json!({}));
    let val2: Value = serde_json::from_str(&json2).unwrap_or(json!({}));

    if let (Some(obj1), Some(obj2)) = (val1.as_object(), val2.as_object()) {
        let mut merged = obj1.clone();
        for (key, value) in obj2 {
            merged.insert(key.clone(), value.clone());
        }
        json!(merged).to_string()
    } else {
        json1
    }
}

/// Validate JSON structure
pub fn json_validate(json_str: String) -> bool {
    serde_json::from_str::<Value>(&json_str).is_ok()
}

/// Pretty print JSON
pub fn json_pretty_print(json_str: String) -> String {
    match serde_json::from_str::<Value>(&json_str) {
        Ok(val) => serde_json::to_string_pretty(&val).unwrap_or(json_str),
        Err(_) => json_str,
    }
}

/// Minify JSON
pub fn json_minify(json_str: String) -> String {
    match serde_json::from_str::<Value>(&json_str) {
        Ok(val) => val.to_string(),
        Err(_) => json_str,
    }
}
