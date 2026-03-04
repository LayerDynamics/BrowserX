// build.rs - ensures deno_bindgen has an OUT_DIR to write to
fn main() {
    // This is intentionally minimal - just ensures OUT_DIR exists
    println!("cargo:rerun-if-changed=src/");
}
