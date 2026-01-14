/**
 * Image Filter Compute Shader
 *
 * Provides GPU-accelerated image processing operations:
 * - Convolution filters (blur, sharpen, edge detection)
 * - Morphological operations (erode, dilate)
 * - Color transformations (grayscale, sepia, invert)
 * - Histogram calculation
 * - Image scaling and rotation
 */

// ============================================================================
// Structures
// ============================================================================

struct ImageInfo {
    width: u32,
    height: u32,
    channels: u32,  // 3=RGB, 4=RGBA
    _padding: u32,
}

struct ConvolutionKernel {
    // 5x5 kernel (max size, use smaller for 3x3)
    weights: array<f32, 25>,
    size: u32,      // 3, 5, 7, etc.
    divisor: f32,   // Sum of weights (for normalization)
    bias: f32,      // Add to result
    _padding: u32,
}

struct ColorTransform {
    // 4x4 color matrix (column-major)
    matrix: mat4x4<f32>,
    // Additive offset
    offset: vec4<f32>,
}

// ============================================================================
// Bindings
// ============================================================================

// Input image (read-only)
@group(0) @binding(0)
var<storage, read> inputImage: array<vec4<f32>>;

// Output image (write-only)
@group(0) @binding(1)
var<storage, read_write> outputImage: array<vec4<f32>>;

// Image dimensions
@group(0) @binding(2)
var<uniform> imageInfo: ImageInfo;

// Filter parameters
@group(1) @binding(0)
var<uniform> kernel: ConvolutionKernel;

@group(1) @binding(1)
var<uniform> colorTransform: ColorTransform;

// ============================================================================
// Helper Functions
// ============================================================================

fn getPixelIndex(x: u32, y: u32) -> u32 {
    return y * imageInfo.width + x;
}

fn clampCoords(x: i32, y: i32) -> vec2<u32> {
    let cx = clamp(x, 0, i32(imageInfo.width) - 1);
    let cy = clamp(y, 0, i32(imageInfo.height) - 1);
    return vec2<u32>(u32(cx), u32(cy));
}

fn getPixel(x: i32, y: i32) -> vec4<f32> {
    let coords = clampCoords(x, y);
    return inputImage[getPixelIndex(coords.x, coords.y)];
}

fn setPixel(x: u32, y: u32, color: vec4<f32>) {
    outputImage[getPixelIndex(x, y)] = color;
}

// ============================================================================
// Convolution Filter
// ============================================================================

@compute @workgroup_size(16, 16)
fn convolution(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    // Bounds check
    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    let radius = i32(kernel.size) / 2;
    var result = vec4<f32>(0.0);

    // Apply convolution kernel
    for (var ky = -radius; ky <= radius; ky++) {
        for (var kx = -radius; kx <= radius; kx++) {
            let kernelIndex = u32((ky + radius) * i32(kernel.size) + (kx + radius));
            let weight = kernel.weights[kernelIndex];

            let pixel = getPixel(i32(x) + kx, i32(y) + ky);
            result += pixel * weight;
        }
    }

    // Normalize and add bias
    result = result / kernel.divisor + vec4<f32>(kernel.bias);

    // Clamp to valid range
    result = clamp(result, vec4<f32>(0.0), vec4<f32>(1.0));

    // Preserve alpha if input has alpha
    if (imageInfo.channels == 3u) {
        result.a = 1.0;
    }

    setPixel(x, y, result);
}

// ============================================================================
// Gaussian Blur (Separable - Horizontal Pass)
// ============================================================================

@compute @workgroup_size(256, 1)
fn gaussianBlurH(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    // 9-tap Gaussian kernel
    let weights = array<f32, 9>(
        0.0162162162,
        0.0540540541,
        0.1216216216,
        0.1945945946,
        0.2270270270,
        0.1945945946,
        0.1216216216,
        0.0540540541,
        0.0162162162
    );

    var result = vec4<f32>(0.0);

    for (var i = 0; i < 9; i++) {
        let offset = i - 4;
        result += getPixel(i32(x) + offset, i32(y)) * weights[i];
    }

    setPixel(x, y, result);
}

// ============================================================================
// Gaussian Blur (Separable - Vertical Pass)
// ============================================================================

@compute @workgroup_size(1, 256)
fn gaussianBlurV(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    let weights = array<f32, 9>(
        0.0162162162,
        0.0540540541,
        0.1216216216,
        0.1945945946,
        0.2270270270,
        0.1945945946,
        0.1216216216,
        0.0540540541,
        0.0162162162
    );

    var result = vec4<f32>(0.0);

    for (var i = 0; i < 9; i++) {
        let offset = i - 4;
        result += getPixel(i32(x), i32(y) + offset) * weights[i];
    }

    setPixel(x, y, result);
}

// ============================================================================
// Morphological Operations - Erode
// ============================================================================

@compute @workgroup_size(16, 16)
fn erode(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    let radius = i32(kernel.size) / 2;
    var minValue = vec4<f32>(1.0);

    // Find minimum in kernel region
    for (var ky = -radius; ky <= radius; ky++) {
        for (var kx = -radius; kx <= radius; kx++) {
            let pixel = getPixel(i32(x) + kx, i32(y) + ky);
            minValue = min(minValue, pixel);
        }
    }

    setPixel(x, y, minValue);
}

// ============================================================================
// Morphological Operations - Dilate
// ============================================================================

@compute @workgroup_size(16, 16)
fn dilate(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    let radius = i32(kernel.size) / 2;
    var maxValue = vec4<f32>(0.0);

    // Find maximum in kernel region
    for (var ky = -radius; ky <= radius; ky++) {
        for (var kx = -radius; kx <= radius; kx++) {
            let pixel = getPixel(i32(x) + kx, i32(y) + ky);
            maxValue = max(maxValue, pixel);
        }
    }

    setPixel(x, y, maxValue);
}

// ============================================================================
// Color Transformations
// ============================================================================

@compute @workgroup_size(16, 16)
fn applyColorTransform(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    let pixel = inputImage[getPixelIndex(x, y)];

    // Apply color matrix transformation
    var result = colorTransform.matrix * pixel + colorTransform.offset;

    // Clamp to valid range
    result = clamp(result, vec4<f32>(0.0), vec4<f32>(1.0));

    setPixel(x, y, result);
}

// ============================================================================
// Grayscale Conversion
// ============================================================================

@compute @workgroup_size(16, 16)
fn grayscale(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    let pixel = inputImage[getPixelIndex(x, y)];

    // Luminance calculation (ITU-R BT.709)
    let luminance = dot(pixel.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));

    setPixel(x, y, vec4<f32>(vec3<f32>(luminance), pixel.a));
}

// ============================================================================
// Sepia Tone
// ============================================================================

@compute @workgroup_size(16, 16)
fn sepia(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    let pixel = inputImage[getPixelIndex(x, y)];

    // Sepia transformation matrix
    let r = pixel.r * 0.393 + pixel.g * 0.769 + pixel.b * 0.189;
    let g = pixel.r * 0.349 + pixel.g * 0.686 + pixel.b * 0.168;
    let b = pixel.r * 0.272 + pixel.g * 0.534 + pixel.b * 0.131;

    let result = vec4<f32>(
        clamp(r, 0.0, 1.0),
        clamp(g, 0.0, 1.0),
        clamp(b, 0.0, 1.0),
        pixel.a
    );

    setPixel(x, y, result);
}

// ============================================================================
// Invert Colors
// ============================================================================

@compute @workgroup_size(16, 16)
fn invert(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    let pixel = inputImage[getPixelIndex(x, y)];
    let inverted = vec4<f32>(1.0 - pixel.rgb, pixel.a);

    setPixel(x, y, inverted);
}

// ============================================================================
// Edge Detection (Sobel)
// ============================================================================

@compute @workgroup_size(16, 16)
fn edgeDetect(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    // Sobel kernels
    var gx = 0.0;
    var gy = 0.0;

    // Horizontal gradient
    gx += dot(getPixel(i32(x)-1, i32(y)-1).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) * -1.0;
    gx += dot(getPixel(i32(x)-1, i32(y)  ).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) * -2.0;
    gx += dot(getPixel(i32(x)-1, i32(y)+1).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) * -1.0;
    gx += dot(getPixel(i32(x)+1, i32(y)-1).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) *  1.0;
    gx += dot(getPixel(i32(x)+1, i32(y)  ).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) *  2.0;
    gx += dot(getPixel(i32(x)+1, i32(y)+1).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) *  1.0;

    // Vertical gradient
    gy += dot(getPixel(i32(x)-1, i32(y)-1).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) * -1.0;
    gy += dot(getPixel(i32(x)  , i32(y)-1).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) * -2.0;
    gy += dot(getPixel(i32(x)+1, i32(y)-1).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) * -1.0;
    gy += dot(getPixel(i32(x)-1, i32(y)+1).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) *  1.0;
    gy += dot(getPixel(i32(x)  , i32(y)+1).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) *  2.0;
    gy += dot(getPixel(i32(x)+1, i32(y)+1).rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) *  1.0;

    let magnitude = sqrt(gx * gx + gy * gy);
    setPixel(x, y, vec4<f32>(vec3<f32>(magnitude), 1.0));
}

// ============================================================================
// Brightness/Contrast Adjustment
// ============================================================================

@compute @workgroup_size(16, 16)
fn adjustBrightnessContrast(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= imageInfo.width || y >= imageInfo.height) {
        return;
    }

    let pixel = inputImage[getPixelIndex(x, y)];

    // Extract brightness and contrast from color transform offset
    let brightness = colorTransform.offset.x;
    let contrast = colorTransform.matrix[0][0];

    // Apply adjustments
    var rgb = pixel.rgb;
    rgb = (rgb - 0.5) * contrast + 0.5 + brightness;
    rgb = clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));

    setPixel(x, y, vec4<f32>(rgb, pixel.a));
}
