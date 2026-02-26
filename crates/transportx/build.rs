//! Build script for transportx
//!
//! quiche depends on BoringSSL which requires cmake.
//! This build script checks for cmake availability and provides helpful error messages.

use std::process::Command;

fn main() {
    // Check that cmake is available (required by quiche's BoringSSL dependency)
    let cmake_check = Command::new("cmake").arg("--version").output();

    match cmake_check {
        Ok(output) => {
            if !output.status.success() {
                eprintln!(
                    "WARNING: cmake found but returned non-zero exit code. \
                     quiche's BoringSSL build may fail."
                );
            }
        }
        Err(_) => {
            eprintln!(
                "ERROR: cmake not found. quiche requires cmake to build BoringSSL.\n\
                 Install cmake:\n\
                 - macOS:  brew install cmake\n\
                 - Ubuntu: sudo apt-get install cmake\n\
                 - Windows: choco install cmake"
            );
        }
    }

    // Re-run build script if build.rs changes
    println!("cargo:rerun-if-changed=build.rs");
}
