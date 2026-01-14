/**
 * Fullscreen Shader
 *
 * Used for fullscreen post-processing effects:
 * - Color correction (brightness, contrast, saturation, gamma)
 * - Blur effects (gaussian, box)
 * - Edge detection and sharpening
 * - Vignette and color grading
 */

// ============================================================================
// Structures
// ============================================================================

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
}

struct ColorCorrection {
    brightness: f32,    // -1.0 to 1.0
    contrast: f32,      // 0.0 to 2.0 (1.0 = no change)
    saturation: f32,    // 0.0 to 2.0 (1.0 = no change)
    gamma: f32,         // 0.1 to 3.0 (1.0 = no change)
    hue: f32,           // -180.0 to 180.0 (degrees)
    _padding: vec3<f32>,
}

struct BlurParams {
    // Kernel size (3, 5, 7, 9, etc.)
    kernelSize: u32,
    // Blur direction: 0=horizontal, 1=vertical (for separable blur)
    direction: u32,
    // Blur strength multiplier
    strength: f32,
    _padding: u32,
}

// ============================================================================
// Bindings
// ============================================================================

// Bind Group 0: Source texture
@group(0) @binding(0)
var sourceTexture: texture_2d<f32>;

@group(0) @binding(1)
var sourceSampler: sampler;

// Bind Group 1: Effect parameters
@group(1) @binding(0)
var<uniform> colorCorrection: ColorCorrection;

@group(1) @binding(1)
var<uniform> blurParams: BlurParams;

// ============================================================================
// Vertex Shader - Fullscreen Quad
// ============================================================================

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;

    // Generate fullscreen triangle
    // Covers entire NDC space with a single triangle
    let x = f32(i32(vertexIndex) - 1);
    let y = f32(i32(vertexIndex & 1u) * 2 - 1);

    out.position = vec4<f32>(x, y, 0.0, 1.0);
    out.texCoord = vec2<f32>(x * 0.5 + 0.5, 1.0 - (y * 0.5 + 0.5));

    return out;
}

// ============================================================================
// Color Space Conversions
// ============================================================================

// RGB to HSV
fn rgbToHsv(rgb: vec3<f32>) -> vec3<f32> {
    let maxC = max(max(rgb.r, rgb.g), rgb.b);
    let minC = min(min(rgb.r, rgb.g), rgb.b);
    let delta = maxC - minC;

    var hsv: vec3<f32>;

    // Hue
    if (delta == 0.0) {
        hsv.x = 0.0;
    } else if (maxC == rgb.r) {
        hsv.x = 60.0 * (((rgb.g - rgb.b) / delta) % 6.0);
    } else if (maxC == rgb.g) {
        hsv.x = 60.0 * (((rgb.b - rgb.r) / delta) + 2.0);
    } else {
        hsv.x = 60.0 * (((rgb.r - rgb.g) / delta) + 4.0);
    }

    // Saturation
    if (maxC == 0.0) {
        hsv.y = 0.0;
    } else {
        hsv.y = delta / maxC;
    }

    // Value
    hsv.z = maxC;

    return hsv;
}

// HSV to RGB
fn hsvToRgb(hsv: vec3<f32>) -> vec3<f32> {
    let c = hsv.z * hsv.y;
    let x = c * (1.0 - abs((hsv.x / 60.0) % 2.0 - 1.0));
    let m = hsv.z - c;

    var rgb: vec3<f32>;

    if (hsv.x < 60.0) {
        rgb = vec3<f32>(c, x, 0.0);
    } else if (hsv.x < 120.0) {
        rgb = vec3<f32>(x, c, 0.0);
    } else if (hsv.x < 180.0) {
        rgb = vec3<f32>(0.0, c, x);
    } else if (hsv.x < 240.0) {
        rgb = vec3<f32>(0.0, x, c);
    } else if (hsv.x < 300.0) {
        rgb = vec3<f32>(x, 0.0, c);
    } else {
        rgb = vec3<f32>(c, 0.0, x);
    }

    return rgb + vec3<f32>(m);
}

// ============================================================================
// Color Correction Functions
// ============================================================================

fn applyBrightness(color: vec3<f32>, brightness: f32) -> vec3<f32> {
    return color + vec3<f32>(brightness);
}

fn applyContrast(color: vec3<f32>, contrast: f32) -> vec3<f32> {
    return (color - 0.5) * contrast + 0.5;
}

fn applySaturation(color: vec3<f32>, saturation: f32) -> vec3<f32> {
    let gray = dot(color, vec3<f32>(0.299, 0.587, 0.114));
    return mix(vec3<f32>(gray), color, saturation);
}

fn applyGamma(color: vec3<f32>, gamma: f32) -> vec3<f32> {
    return pow(color, vec3<f32>(1.0 / gamma));
}

fn applyHue(color: vec3<f32>, hueShift: f32) -> vec3<f32> {
    var hsv = rgbToHsv(color);
    hsv.x = (hsv.x + hueShift) % 360.0;
    if (hsv.x < 0.0) {
        hsv.x += 360.0;
    }
    return hsvToRgb(hsv);
}

// ============================================================================
// Fragment Shader - Color Correction
// ============================================================================

@fragment
fn fs_colorCorrection(in: VertexOutput) -> @location(0) vec4<f32> {
    var color = textureSample(sourceTexture, sourceSampler, in.texCoord);

    // Apply color corrections in sequence
    var rgb = color.rgb;

    // Brightness
    rgb = applyBrightness(rgb, colorCorrection.brightness);

    // Contrast
    rgb = applyContrast(rgb, colorCorrection.contrast);

    // Saturation
    rgb = applySaturation(rgb, colorCorrection.saturation);

    // Hue shift
    if (colorCorrection.hue != 0.0) {
        rgb = applyHue(rgb, colorCorrection.hue);
    }

    // Gamma
    rgb = applyGamma(rgb, colorCorrection.gamma);

    // Clamp to valid range
    rgb = clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));

    return vec4<f32>(rgb, color.a);
}

// ============================================================================
// Fragment Shader - Gaussian Blur (Separable)
// ============================================================================

@fragment
fn fs_gaussianBlur(in: VertexOutput) -> @location(0) vec4<f32> {
    let texSize = textureDimensions(sourceTexture);
    let texelSize = 1.0 / vec2<f32>(texSize);

    var offset: vec2<f32>;
    if (blurParams.direction == 0u) {
        // Horizontal
        offset = vec2<f32>(texelSize.x, 0.0);
    } else {
        // Vertical
        offset = vec2<f32>(0.0, texelSize.y);
    }

    // 9-tap Gaussian kernel weights
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
        let sampleOffset = offset * (f32(i - 4) * blurParams.strength);
        let sampleCoord = in.texCoord + sampleOffset;
        result += textureSample(sourceTexture, sourceSampler, sampleCoord) * weights[i];
    }

    return result;
}

// ============================================================================
// Fragment Shader - Box Blur
// ============================================================================

@fragment
fn fs_boxBlur(in: VertexOutput) -> @location(0) vec4<f32> {
    let texSize = textureDimensions(sourceTexture);
    let texelSize = 1.0 / vec2<f32>(texSize);

    let radius = i32(blurParams.kernelSize) / 2;
    var result = vec4<f32>(0.0);
    var count = 0.0;

    for (var y = -radius; y <= radius; y++) {
        for (var x = -radius; x <= radius; x++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize * blurParams.strength;
            result += textureSample(sourceTexture, sourceSampler, in.texCoord + offset);
            count += 1.0;
        }
    }

    return result / count;
}

// ============================================================================
// Fragment Shader - Edge Detection (Sobel)
// ============================================================================

@fragment
fn fs_edgeDetection(in: VertexOutput) -> @location(0) vec4<f32> {
    let texSize = textureDimensions(sourceTexture);
    let texelSize = 1.0 / vec2<f32>(texSize);

    // Sobel kernels
    let sobelX = mat3x3<f32>(
        -1.0, 0.0, 1.0,
        -2.0, 0.0, 2.0,
        -1.0, 0.0, 1.0
    );

    let sobelY = mat3x3<f32>(
        -1.0, -2.0, -1.0,
         0.0,  0.0,  0.0,
         1.0,  2.0,  1.0
    );

    var gx = 0.0;
    var gy = 0.0;

    for (var y = -1; y <= 1; y++) {
        for (var x = -1; x <= 1; x++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
            let sample = textureSample(sourceTexture, sourceSampler, in.texCoord + offset);
            let luminance = dot(sample.rgb, vec3<f32>(0.299, 0.587, 0.114));

            let kx = sobelX[x + 1][y + 1];
            let ky = sobelY[x + 1][y + 1];

            gx += luminance * kx;
            gy += luminance * ky;
        }
    }

    let magnitude = sqrt(gx * gx + gy * gy);
    return vec4<f32>(vec3<f32>(magnitude), 1.0);
}

// ============================================================================
// Fragment Shader - Passthrough
// ============================================================================

@fragment
fn fs_passthrough(in: VertexOutput) -> @location(0) vec4<f32> {
    return textureSample(sourceTexture, sourceSampler, in.texCoord);
}
