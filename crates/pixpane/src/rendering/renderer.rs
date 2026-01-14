// Render frame coordinator
//
// This module coordinates the rendering of:
// 1. Content texture (web page pixels from RenderingPipeline.ts)
// 2. egui UI (browser chrome)

use egui_wgpu::wgpu;
use super::wgpu_state::RenderState;

/// Render a frame to the window surface
///
/// This clears the surface, renders the content texture, renders egui, and presents.
pub fn render_frame(render_state: &mut RenderState, window: &winit::window::Window) -> Result<(), wgpu::SurfaceError> {
    // Get the current surface texture
    let surface_texture = render_state.surface.get_current_texture()?;
    let view = surface_texture
        .texture
        .create_view(&wgpu::TextureViewDescriptor::default());

    // Create command encoder
    let mut encoder = render_state
        .device
        .create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("render_encoder"),
        });

    {
        // Render pass for content texture
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("render_pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::WHITE),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });

        // Render content texture if available
        if let Some(content_texture) = &render_state.content_texture {
            render_pass.set_pipeline(&render_state.texture_pipeline);
            render_pass.set_bind_group(0, &content_texture.bind_group, &[]);
            render_pass.draw(0..3, 0..1);  // Fullscreen triangle
        }
    } // render_pass is dropped here

    // Render egui if output is available
    if let Some(egui_output) = render_state.egui_output.take() {
        let window_size = window.inner_size();
        let scale_factor = window.scale_factor() as f32;

        render_state.egui_state.render(
            &render_state.device,
            &render_state.queue,
            &mut encoder,
            &view,
            window,
            window_size,
            scale_factor,
            egui_output,
        );
    }

    // Submit commands and present
    render_state
        .queue
        .submit(std::iter::once(encoder.finish()));
    surface_texture.present();

    Ok(())
}
