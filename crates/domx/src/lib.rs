//! domx — Minimal DOM FFI for BrowserX
//!
//! Provides C-ABI functions for element lifecycle, tree manipulation,
//! and attribute access. Designed for Deno FFI consumption.

use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::sync::{Mutex, RwLock};

// ---------------------------------------------------------------------------
// Node types (mirrors DOM spec)
// ---------------------------------------------------------------------------

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeType {
    Element = 1,
    Text = 3,
    Comment = 8,
    Document = 9,
}

// ---------------------------------------------------------------------------
// Internal DOM node
// ---------------------------------------------------------------------------

#[derive(Debug)]
struct DomNode {
    id: u64,
    node_type: NodeType,
    tag_name: String,
    text_content: String,
    attributes: HashMap<String, String>,
    parent: Option<u64>,
    children: Vec<u64>,
}

impl DomNode {
    fn new_element(id: u64, tag_name: &str) -> Self {
        Self {
            id,
            node_type: NodeType::Element,
            tag_name: tag_name.to_ascii_uppercase(),
            text_content: String::new(),
            attributes: HashMap::new(),
            parent: None,
            children: Vec::new(),
        }
    }

    fn new_text(id: u64, data: &str) -> Self {
        Self {
            id,
            node_type: NodeType::Text,
            tag_name: String::from("#text"),
            text_content: data.to_string(),
            attributes: HashMap::new(),
            parent: None,
            children: Vec::new(),
        }
    }
}

// ---------------------------------------------------------------------------
// Global node store
// ---------------------------------------------------------------------------

static NEXT_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
static NODES: std::sync::LazyLock<RwLock<HashMap<u64, Mutex<DomNode>>>> =
    std::sync::LazyLock::new(|| RwLock::new(HashMap::new()));

static LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);

fn set_error(msg: &str) {
    if let Ok(mut e) = LAST_ERROR.lock() {
        *e = Some(msg.to_string());
    }
}

// ---------------------------------------------------------------------------
// FFI helpers
// ---------------------------------------------------------------------------

unsafe fn cstr_to_str<'a>(ptr: *const c_char) -> &'a str {
    if ptr.is_null() {
        return "";
    }
    unsafe { CStr::from_ptr(ptr) }.to_str().unwrap_or("")
}

fn return_string(s: &str) -> *mut c_char {
    CString::new(s).map(|c| c.into_raw()).unwrap_or(std::ptr::null_mut())
}

// ---------------------------------------------------------------------------
// Public FFI API
// ---------------------------------------------------------------------------

/// Create an element node. Returns node id (0 on failure).
#[no_mangle]
pub unsafe extern "C" fn domx_create_element(tag: *const c_char) -> u64 {
    let tag = unsafe { cstr_to_str(tag) };
    if tag.is_empty() {
        set_error("tag name must not be empty");
        return 0;
    }
    let id = NEXT_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let node = DomNode::new_element(id, tag);
    if let Ok(mut store) = NODES.write() {
        store.insert(id, Mutex::new(node));
    }
    id
}

/// Create a text node. Returns node id (0 on failure).
#[no_mangle]
pub unsafe extern "C" fn domx_create_text(data: *const c_char) -> u64 {
    let data = unsafe { cstr_to_str(data) };
    let id = NEXT_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let node = DomNode::new_text(id, data);
    if let Ok(mut store) = NODES.write() {
        store.insert(id, Mutex::new(node));
    }
    id
}

/// Destroy a node and remove it from its parent. Returns 1 on success, 0 on failure.
#[no_mangle]
pub extern "C" fn domx_destroy(node_id: u64) -> u32 {
    let Ok(mut store) = NODES.write() else {
        set_error("lock poisoned");
        return 0;
    };

    // Remove from parent's children list
    if let Some(node_mutex) = store.get(&node_id) {
        if let Ok(node) = node_mutex.lock() {
            if let Some(parent_id) = node.parent {
                if let Some(parent_mutex) = store.get(&parent_id) {
                    if let Ok(mut parent) = parent_mutex.lock() {
                        parent.children.retain(|&c| c != node_id);
                    }
                }
            }
        }
    }

    if store.remove(&node_id).is_some() { 1 } else { 0 }
}

/// Insert `child_id` as last child of `parent_id`. Returns 1 on success.
#[no_mangle]
pub extern "C" fn domx_append_child(parent_id: u64, child_id: u64) -> u32 {
    let Ok(store) = NODES.read() else { return 0 };

    // Remove child from old parent first
    if let Some(child_mutex) = store.get(&child_id) {
        if let Ok(mut child) = child_mutex.lock() {
            if let Some(old_parent_id) = child.parent {
                if let Some(old_parent_mutex) = store.get(&old_parent_id) {
                    if let Ok(mut old_parent) = old_parent_mutex.lock() {
                        old_parent.children.retain(|&c| c != child_id);
                    }
                }
            }
            child.parent = Some(parent_id);
        }
    }

    if let Some(parent_mutex) = store.get(&parent_id) {
        if let Ok(mut parent) = parent_mutex.lock() {
            if !parent.children.contains(&child_id) {
                parent.children.push(child_id);
            }
            return 1;
        }
    }

    0
}

/// Remove `child_id` from `parent_id`. Returns 1 on success.
#[no_mangle]
pub extern "C" fn domx_remove_child(parent_id: u64, child_id: u64) -> u32 {
    let Ok(store) = NODES.read() else { return 0 };

    if let Some(child_mutex) = store.get(&child_id) {
        if let Ok(mut child) = child_mutex.lock() {
            child.parent = None;
        }
    }

    if let Some(parent_mutex) = store.get(&parent_id) {
        if let Ok(mut parent) = parent_mutex.lock() {
            let before = parent.children.len();
            parent.children.retain(|&c| c != child_id);
            if parent.children.len() < before {
                return 1;
            }
        }
    }

    0
}

/// Insert `child_id` before `ref_id` under `parent_id`. Returns 1 on success.
#[no_mangle]
pub extern "C" fn domx_insert_before(parent_id: u64, child_id: u64, ref_id: u64) -> u32 {
    let Ok(store) = NODES.read() else { return 0 };

    // Update child's parent
    if let Some(child_mutex) = store.get(&child_id) {
        if let Ok(mut child) = child_mutex.lock() {
            if let Some(old_parent_id) = child.parent {
                if let Some(old_parent_mutex) = store.get(&old_parent_id) {
                    if let Ok(mut old_parent) = old_parent_mutex.lock() {
                        old_parent.children.retain(|&c| c != child_id);
                    }
                }
            }
            child.parent = Some(parent_id);
        }
    }

    if let Some(parent_mutex) = store.get(&parent_id) {
        if let Ok(mut parent) = parent_mutex.lock() {
            if let Some(pos) = parent.children.iter().position(|&c| c == ref_id) {
                parent.children.insert(pos, child_id);
                return 1;
            }
            // ref not found — append
            parent.children.push(child_id);
            return 1;
        }
    }

    0
}

/// Set an attribute on a node. Returns 1 on success.
#[no_mangle]
pub unsafe extern "C" fn domx_set_attribute(
    node_id: u64,
    name: *const c_char,
    value: *const c_char,
) -> u32 {
    let name = unsafe { cstr_to_str(name) };
    let value = unsafe { cstr_to_str(value) };

    let Ok(store) = NODES.read() else { return 0 };
    if let Some(node_mutex) = store.get(&node_id) {
        if let Ok(mut node) = node_mutex.lock() {
            node.attributes.insert(name.to_string(), value.to_string());
            return 1;
        }
    }
    0
}

/// Get an attribute value. Caller must free with `domx_free_string`.
#[no_mangle]
pub unsafe extern "C" fn domx_get_attribute(
    node_id: u64,
    name: *const c_char,
) -> *mut c_char {
    let name = unsafe { cstr_to_str(name) };

    let Ok(store) = NODES.read() else { return std::ptr::null_mut() };
    if let Some(node_mutex) = store.get(&node_id) {
        if let Ok(node) = node_mutex.lock() {
            if let Some(val) = node.attributes.get(name) {
                return return_string(val);
            }
        }
    }
    std::ptr::null_mut()
}

/// Remove an attribute. Returns 1 if it existed.
#[no_mangle]
pub unsafe extern "C" fn domx_remove_attribute(node_id: u64, name: *const c_char) -> u32 {
    let name = unsafe { cstr_to_str(name) };

    let Ok(store) = NODES.read() else { return 0 };
    if let Some(node_mutex) = store.get(&node_id) {
        if let Ok(mut node) = node_mutex.lock() {
            return if node.attributes.remove(name).is_some() { 1 } else { 0 };
        }
    }
    0
}

/// Get the tag name. Caller must free with `domx_free_string`.
#[no_mangle]
pub extern "C" fn domx_tag_name(node_id: u64) -> *mut c_char {
    let Ok(store) = NODES.read() else { return std::ptr::null_mut() };
    if let Some(node_mutex) = store.get(&node_id) {
        if let Ok(node) = node_mutex.lock() {
            return return_string(&node.tag_name);
        }
    }
    std::ptr::null_mut()
}

/// Get text content. Caller must free with `domx_free_string`.
#[no_mangle]
pub extern "C" fn domx_text_content(node_id: u64) -> *mut c_char {
    let Ok(store) = NODES.read() else { return std::ptr::null_mut() };
    if let Some(node_mutex) = store.get(&node_id) {
        if let Ok(node) = node_mutex.lock() {
            return return_string(&node.text_content);
        }
    }
    std::ptr::null_mut()
}

/// Get node type. Returns 0 if not found.
#[no_mangle]
pub extern "C" fn domx_node_type(node_id: u64) -> u8 {
    let Ok(store) = NODES.read() else { return 0 };
    if let Some(node_mutex) = store.get(&node_id) {
        if let Ok(node) = node_mutex.lock() {
            return node.node_type as u8;
        }
    }
    0
}

/// Get child count.
#[no_mangle]
pub extern "C" fn domx_child_count(node_id: u64) -> u32 {
    let Ok(store) = NODES.read() else { return 0 };
    if let Some(node_mutex) = store.get(&node_id) {
        if let Ok(node) = node_mutex.lock() {
            return node.children.len() as u32;
        }
    }
    0
}

/// Get child at index. Returns 0 if out of bounds.
#[no_mangle]
pub extern "C" fn domx_child_at(node_id: u64, index: u32) -> u64 {
    let Ok(store) = NODES.read() else { return 0 };
    if let Some(node_mutex) = store.get(&node_id) {
        if let Ok(node) = node_mutex.lock() {
            return node.children.get(index as usize).copied().unwrap_or(0);
        }
    }
    0
}

/// Get parent node id. Returns 0 if none.
#[no_mangle]
pub extern "C" fn domx_parent(node_id: u64) -> u64 {
    let Ok(store) = NODES.read() else { return 0 };
    if let Some(node_mutex) = store.get(&node_id) {
        if let Ok(node) = node_mutex.lock() {
            return node.parent.unwrap_or(0);
        }
    }
    0
}

/// Free a string returned by domx functions.
#[no_mangle]
pub unsafe extern "C" fn domx_free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        drop(unsafe { CString::from_raw(ptr) });
    }
}

/// Get last error message. Caller must free with `domx_free_string`.
#[no_mangle]
pub extern "C" fn domx_get_last_error() -> *mut c_char {
    if let Ok(mut e) = LAST_ERROR.lock() {
        if let Some(msg) = e.take() {
            return return_string(&msg);
        }
    }
    std::ptr::null_mut()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::CString;

    fn c(s: &str) -> CString {
        CString::new(s).unwrap()
    }

    #[test]
    fn create_and_destroy_element() {
        let tag = c("div");
        let id = unsafe { domx_create_element(tag.as_ptr()) };
        assert_ne!(id, 0);
        assert_eq!(domx_node_type(id), NodeType::Element as u8);
        assert_eq!(domx_destroy(id), 1);
        assert_eq!(domx_node_type(id), 0); // gone
    }

    #[test]
    fn tree_operations() {
        let parent_tag = c("ul");
        let child_tag = c("li");
        let parent = unsafe { domx_create_element(parent_tag.as_ptr()) };
        let child = unsafe { domx_create_element(child_tag.as_ptr()) };

        assert_eq!(domx_append_child(parent, child), 1);
        assert_eq!(domx_child_count(parent), 1);
        assert_eq!(domx_child_at(parent, 0), child);
        assert_eq!(domx_parent(child), parent);

        assert_eq!(domx_remove_child(parent, child), 1);
        assert_eq!(domx_child_count(parent), 0);

        domx_destroy(parent);
        domx_destroy(child);
    }

    #[test]
    fn attributes() {
        let tag = c("a");
        let id = unsafe { domx_create_element(tag.as_ptr()) };
        let name = c("href");
        let value = c("https://example.com");

        assert_eq!(unsafe { domx_set_attribute(id, name.as_ptr(), value.as_ptr()) }, 1);

        let result = unsafe { domx_get_attribute(id, name.as_ptr()) };
        assert!(!result.is_null());
        let result_str = unsafe { CStr::from_ptr(result) }.to_str().unwrap();
        assert_eq!(result_str, "https://example.com");
        unsafe { domx_free_string(result) };

        assert_eq!(unsafe { domx_remove_attribute(id, name.as_ptr()) }, 1);
        assert!(unsafe { domx_get_attribute(id, name.as_ptr()) }.is_null());

        domx_destroy(id);
    }

    #[test]
    fn text_node() {
        let data = c("Hello, world!");
        let id = unsafe { domx_create_text(data.as_ptr()) };
        assert_ne!(id, 0);
        assert_eq!(domx_node_type(id), NodeType::Text as u8);

        let content = domx_text_content(id);
        assert!(!content.is_null());
        let s = unsafe { CStr::from_ptr(content) }.to_str().unwrap();
        assert_eq!(s, "Hello, world!");
        unsafe { domx_free_string(content) };

        domx_destroy(id);
    }

    #[test]
    fn insert_before() {
        let ul = c("ul");
        let li1 = c("li");
        let li2 = c("li");
        let parent = unsafe { domx_create_element(ul.as_ptr()) };
        let first = unsafe { domx_create_element(li1.as_ptr()) };
        let second = unsafe { domx_create_element(li2.as_ptr()) };

        domx_append_child(parent, second);
        domx_insert_before(parent, first, second);

        assert_eq!(domx_child_count(parent), 2);
        assert_eq!(domx_child_at(parent, 0), first);
        assert_eq!(domx_child_at(parent, 1), second);

        domx_destroy(parent);
        domx_destroy(first);
        domx_destroy(second);
    }
}
