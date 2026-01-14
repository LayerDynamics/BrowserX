// egui integration for UI rendering
//
// This module handles egui state management, including:
// - egui Context for immediate-mode UI
// - egui-wgpu Renderer for GPU rendering
// - egui-winit State for input event handling

use egui_wgpu::wgpu;
use egui_wgpu::ScreenDescriptor;
use winit::event::WindowEvent;
use winit::window::Window as WinitWindow;
use std::collections::HashMap;

/// UI command for deferred execution
#[derive(Debug, Clone)]
pub enum UICommand {
    Button { label: String },
    Label { text: String },
    TextInput { id: String, value: String },
    HorizontalBegin,
    HorizontalEnd,
    VerticalBegin,
    VerticalEnd,
    ContextMenuArea { id: String },
    ContextMenuBegin { menu_id: String },
    ContextMenuItem { menu_id: String, item_id: String, label: String },
    ContextMenuEnd,
}

/// Result from executing UI commands
#[derive(Debug, Default)]
pub struct UIResult {
    pub button_clicked: HashMap<String, bool>,
    pub text_values: HashMap<String, String>,
    pub context_menu_clicked: HashMap<String, String>, // menu_id -> clicked item_id
}

pub struct EguiState {
    /// egui context - the main immediate-mode UI state
    pub ctx: egui::Context,

    /// egui-wgpu renderer for GPU-accelerated rendering
    renderer: egui_wgpu::Renderer,

    /// egui-winit state for handling input events
    winit_state: egui_winit::State,

    /// UI commands to execute in the next frame
    pub ui_commands: Vec<UICommand>,

    /// Results from the last frame's UI execution
    pub ui_result: UIResult,

    /// Persistent state for text inputs (id -> current text value)
    pub text_state: HashMap<String, String>,
}

impl EguiState {
    /// Create a new egui state
    pub fn new(
        device: &wgpu::Device,
        surface_format: wgpu::TextureFormat,
        window: &WinitWindow,
    ) -> Self {
        let ctx = egui::Context::default();

        // Create egui-wgpu renderer
        let renderer = egui_wgpu::Renderer::new(
            device,
            surface_format,
            None,  // depth format
            1,     // sample count
            false, // support_transparent_backbuffer
        );

        // Create egui-winit state for input handling
        let winit_state = egui_winit::State::new(
            ctx.clone(),
            egui::ViewportId::ROOT,
            window,
            Some(window.scale_factor() as f32),
            None,
            Some(2048), // max texture side
        );

        Self {
            ctx,
            renderer,
            winit_state,
            ui_commands: Vec::new(),
            ui_result: UIResult::default(),
            text_state: HashMap::new(),
        }
    }

    /// Execute queued UI commands
    pub fn execute_ui_commands(&mut self) {
        let mut result = UIResult::default();
        let commands = std::mem::take(&mut self.ui_commands);
        let text_state = &mut self.text_state;

        egui::CentralPanel::default().show(&self.ctx, |ui| {
            Self::execute_commands_recursive(ui, &commands, 0, &mut result, text_state);
        });

        self.ui_result = result;
    }

    fn execute_commands_recursive(
        ui: &mut egui::Ui,
        commands: &[UICommand],
        mut index: usize,
        result: &mut UIResult,
        text_state: &mut HashMap<String, String>,
    ) -> usize {
        while index < commands.len() {
            match &commands[index] {
                UICommand::Button { label } => {
                    let clicked = ui.button(label).clicked();
                    result.button_clicked.insert(label.clone(), clicked);
                    index += 1;
                }
                UICommand::Label { text } => {
                    ui.label(text);
                    index += 1;
                }
                UICommand::TextInput { id, value } => {
                    // Initialize text state only if not present (don't overwrite user edits!)
                    text_state.entry(id.clone()).or_insert_with(|| value.clone());

                    // Get mutable reference to the persistent text
                    if let Some(text) = text_state.get_mut(id) {
                        ui.text_edit_singleline(text);
                        result.text_values.insert(id.clone(), text.clone());
                    }
                    index += 1;
                }
                UICommand::HorizontalBegin => {
                    ui.horizontal(|ui| {
                        index = Self::execute_commands_recursive(ui, commands, index + 1, result, text_state);
                    });
                }
                UICommand::HorizontalEnd => {
                    return index + 1;
                }
                UICommand::VerticalBegin => {
                    ui.vertical(|ui| {
                        index = Self::execute_commands_recursive(ui, commands, index + 1, result, text_state);
                    });
                }
                UICommand::VerticalEnd => {
                    return index + 1;
                }
                UICommand::ContextMenuArea { id } => {
                    // Create an invisible area that covers available space and responds to right-click
                    let available_size = ui.available_size();
                    let response = ui.allocate_response(available_size, egui::Sense::click());

                    response.context_menu(|ui| {
                        // Find and execute the corresponding context menu items
                        let menu_index = index + 1;
                        if menu_index < commands.len() {
                            if let UICommand::ContextMenuBegin { menu_id } = &commands[menu_index] {
                                Self::execute_context_menu_items(
                                    ui,
                                    commands,
                                    menu_index + 1,
                                    menu_id,
                                    result,
                                );
                            }
                        }
                    });
                    // Skip to after ContextMenuEnd
                    index = Self::find_context_menu_end(commands, index + 1);
                }
                UICommand::ContextMenuBegin { .. } => {
                    // This is handled by ContextMenuArea, skip it
                    index += 1;
                }
                UICommand::ContextMenuItem { .. } => {
                    // This is handled by execute_context_menu_items, skip it
                    index += 1;
                }
                UICommand::ContextMenuEnd => {
                    index += 1;
                }
            }
        }
        index
    }

    fn execute_context_menu_items(
        ui: &mut egui::Ui,
        commands: &[UICommand],
        mut index: usize,
        menu_id: &str,
        result: &mut UIResult,
    ) {
        while index < commands.len() {
            match &commands[index] {
                UICommand::ContextMenuItem { menu_id: mid, item_id, label } if mid == menu_id => {
                    if ui.button(label).clicked() {
                        result.context_menu_clicked.insert(menu_id.to_string(), item_id.clone());
                        ui.close_menu();
                    }
                    index += 1;
                }
                UICommand::ContextMenuEnd => {
                    break;
                }
                _ => {
                    index += 1;
                }
            }
        }
    }

    fn find_context_menu_end(commands: &[UICommand], mut index: usize) -> usize {
        while index < commands.len() {
            if matches!(commands[index], UICommand::ContextMenuEnd) {
                return index + 1;
            }
            index += 1;
        }
        index
    }

    /// Handle a winit window event
    ///
    /// Returns true if egui consumed the event (e.g., clicked on a button).
    /// If true, the event should not be propagated to the application.
    pub fn handle_event(&mut self, window: &WinitWindow, event: &WindowEvent) -> bool {
        let response = self.winit_state.on_window_event(window, event);
        response.consumed
    }

    /// Begin a new egui frame
    ///
    /// Call this before drawing any egui UI.
    pub fn begin_frame(&mut self, window: &WinitWindow) {
        // Get the input from winit_state (this includes all events collected via handle_event)
        let raw_input = self.winit_state.take_egui_input(window);
        self.ctx.begin_pass(raw_input);
    }

    /// End the egui frame
    ///
    /// Returns the full output from egui, including shapes to render.
    /// Call this after drawing all egui UI but before rendering.
    pub fn end_frame(&mut self) -> egui::FullOutput {
        // Execute all queued UI commands
        self.execute_ui_commands();

        let output = self.ctx.end_pass();
        output
    }

    /// Render egui - this combines prepare and render into one call
    pub fn render(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        view: &wgpu::TextureView,
        window: &WinitWindow,
        window_size: winit::dpi::PhysicalSize<u32>,
        scale_factor: f32,
        output: egui::FullOutput,
    ) {
        // Handle platform output (cursor icon, clipboard, etc.)
        self.winit_state.handle_platform_output(window, output.platform_output);
        // Tessellate shapes
        let clipped_primitives = self.ctx.tessellate(output.shapes, output.pixels_per_point);

        let screen_descriptor = ScreenDescriptor {
            size_in_pixels: [window_size.width, window_size.height],
            pixels_per_point: scale_factor,
        };

        // Upload textures
        for (id, image_delta) in &output.textures_delta.set {
            self.renderer.update_texture(device, queue, *id, image_delta);
        }

        // Update buffers
        self.renderer.update_buffers(
            device,
            queue,
            encoder,
            &clipped_primitives,
            &screen_descriptor,
        );

        // Render egui
        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("egui_render_pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Load, // Don't clear - render on top
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            // SAFETY: We transmute the lifetime to 'static here because egui's Renderer::render
            // requires a RenderPass<'static>. This is safe because:
            // 1. The render_pass is immediately dropped after this call (end of scope)
            // 2. We don't store any references to the render_pass
            // 3. The encoder outlives the render_pass
            let mut render_pass_static = unsafe {
                std::mem::transmute::<_, wgpu::RenderPass<'static>>(render_pass)
            };

            self.renderer.render(&mut render_pass_static, &clipped_primitives, &screen_descriptor);
        }

        // Cleanup textures
        for id in &output.textures_delta.free {
            self.renderer.free_texture(id);
        }
    }
}
