// Content texture management
//
// This module handles the GPU texture that stores web content pixels
// uploaded from TypeScript/Deno via the RenderingPipeline.

use egui_wgpu::wgpu;

pub struct ContentTexture {
    pub texture: wgpu::Texture,
    pub view: wgpu::TextureView,
    pub bind_group: wgpu::BindGroup,
    pub width: u32,
    pub height: u32,
}

impl ContentTexture {
    /// Create a new content texture
    pub fn new(device: &wgpu::Device, width: u32, height: u32, bind_group_layout: &wgpu::BindGroupLayout) -> Self {
        let size = wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        };

        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("content_texture"),
            size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("content_sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("content_bind_group"),
            layout: bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::Sampler(&sampler),
                },
            ],
        });

        Self {
            texture,
            view,
            bind_group,
            width,
            height,
        }
    }

    /// Upload pixel data to the texture
    ///
    /// Pixels must be in RGBA8 format (width * height * 4 bytes)
    pub fn upload_pixels(&self, queue: &wgpu::Queue, pixels: &[u8]) {
        let expected_size = (self.width * self.height * 4) as usize;

        if pixels.len() != expected_size {
            eprintln!(
                "Warning: Pixel buffer size mismatch. Expected {}, got {}",
                expected_size,
                pixels.len()
            );
            return;
        }

        queue.write_texture(
            wgpu::ImageCopyTexture {
                texture: &self.texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            pixels,
            wgpu::ImageDataLayout {
                offset: 0,
                bytes_per_row: Some(4 * self.width),
                rows_per_image: Some(self.height),
            },
            wgpu::Extent3d {
                width: self.width,
                height: self.height,
                depth_or_array_layers: 1,
            },
        );
    }

    /// Resize the texture
    pub fn resize(&mut self, device: &wgpu::Device, width: u32, height: u32, bind_group_layout: &wgpu::BindGroupLayout) {
        if width == self.width && height == self.height {
            return; // No change
        }

        *self = Self::new(device, width, height, bind_group_layout);
    }
}
