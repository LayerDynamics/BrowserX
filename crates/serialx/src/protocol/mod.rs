//! Printer protocol implementations — ESC/POS, IPP stubs

use serde::{Deserialize, Serialize};
use std::io::Write;

use crate::device::with_device;
use crate::trace::log_event;

/// ESC/POS commands
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum EscPosCommand {
    Init,
    Print { text: String },
    Cut,
    LineFeed { lines: u8 },
    SetBold { enabled: bool },
    SetAlign { align: String },
    SetFontSize { width: u8, height: u8 },
    PrintBarcode { data: String, barcode_type: u8 },
    FeedAndCut,
}

impl EscPosCommand {
    /// Convert command to raw ESC/POS bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        match self {
            EscPosCommand::Init => vec![0x1B, 0x40], // ESC @
            EscPosCommand::Print { text } => {
                let mut bytes = text.as_bytes().to_vec();
                bytes.push(0x0A); // Line feed
                bytes
            }
            EscPosCommand::Cut => vec![0x1D, 0x56, 0x00], // GS V 0 (full cut)
            EscPosCommand::LineFeed { lines } => vec![0x1B, 0x64, *lines], // ESC d n
            EscPosCommand::SetBold { enabled } => {
                vec![0x1B, 0x45, if *enabled { 1 } else { 0 }] // ESC E n
            }
            EscPosCommand::SetAlign { align } => {
                let n = match align.as_str() {
                    "center" => 1,
                    "right" => 2,
                    _ => 0, // left
                };
                vec![0x1B, 0x61, n] // ESC a n
            }
            EscPosCommand::SetFontSize { width, height } => {
                let n = ((width.saturating_sub(1)) << 4) | (height.saturating_sub(1));
                vec![0x1D, 0x21, n] // GS ! n
            }
            EscPosCommand::PrintBarcode { data, barcode_type } => {
                let mut bytes = vec![0x1D, 0x6B, *barcode_type]; // GS k m
                bytes.extend_from_slice(data.as_bytes());
                bytes.push(0x00); // NUL terminator
                bytes
            }
            EscPosCommand::FeedAndCut => {
                let mut bytes = vec![0x1B, 0x64, 3]; // Feed 3 lines
                bytes.extend_from_slice(&[0x1D, 0x56, 0x00]); // Full cut
                bytes
            }
        }
    }
}

/// Send an ESC/POS command to a device. Returns 0 on success, 1 on failure.
pub fn send_escpos_command(device_id: u64, command_json: &str) -> u8 {
    log_event(
        "protocol",
        &format!("ESC/POS command to device {}", device_id),
        "out",
        Some(command_json),
    );

    let command: EscPosCommand = match serde_json::from_str(command_json) {
        Ok(c) => c,
        Err(e) => {
            log_event(
                "protocol",
                &format!("Invalid ESC/POS command JSON: {}", e),
                "error",
                None,
            );
            return 1;
        }
    };

    let bytes = command.to_bytes();

    match with_device(device_id, |port| port.write_all(&bytes)) {
        Some(Ok(())) => {
            log_event(
                "protocol",
                &format!("Sent {} bytes ESC/POS data", bytes.len()),
                "result",
                None,
            );
            0
        }
        Some(Err(e)) => {
            log_event(
                "protocol",
                &format!("ESC/POS write error: {}", e),
                "error",
                None,
            );
            1
        }
        None => {
            log_event(
                "protocol",
                &format!("Device {} not found", device_id),
                "error",
                None,
            );
            1
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_bytes() {
        let cmd = EscPosCommand::Init;
        assert_eq!(cmd.to_bytes(), vec![0x1B, 0x40]);
    }

    #[test]
    fn test_print_bytes() {
        let cmd = EscPosCommand::Print { text: "Hi".to_string() };
        let bytes = cmd.to_bytes();
        assert_eq!(bytes, vec![b'H', b'i', 0x0A]);
    }

    #[test]
    fn test_cut_bytes() {
        let cmd = EscPosCommand::Cut;
        assert_eq!(cmd.to_bytes(), vec![0x1D, 0x56, 0x00]);
    }

    #[test]
    fn test_line_feed_bytes() {
        let cmd = EscPosCommand::LineFeed { lines: 5 };
        assert_eq!(cmd.to_bytes(), vec![0x1B, 0x64, 5]);
    }

    #[test]
    fn test_bold_bytes() {
        assert_eq!(
            EscPosCommand::SetBold { enabled: true }.to_bytes(),
            vec![0x1B, 0x45, 1]
        );
        assert_eq!(
            EscPosCommand::SetBold { enabled: false }.to_bytes(),
            vec![0x1B, 0x45, 0]
        );
    }

    #[test]
    fn test_align_bytes() {
        assert_eq!(
            EscPosCommand::SetAlign { align: "left".to_string() }.to_bytes(),
            vec![0x1B, 0x61, 0]
        );
        assert_eq!(
            EscPosCommand::SetAlign { align: "center".to_string() }.to_bytes(),
            vec![0x1B, 0x61, 1]
        );
        assert_eq!(
            EscPosCommand::SetAlign { align: "right".to_string() }.to_bytes(),
            vec![0x1B, 0x61, 2]
        );
    }

    #[test]
    fn test_font_size_bytes() {
        let cmd = EscPosCommand::SetFontSize { width: 2, height: 2 };
        assert_eq!(cmd.to_bytes(), vec![0x1D, 0x21, 0x11]);
    }

    #[test]
    fn test_barcode_bytes() {
        let cmd = EscPosCommand::PrintBarcode {
            data: "123".to_string(),
            barcode_type: 2,
        };
        let bytes = cmd.to_bytes();
        assert_eq!(bytes, vec![0x1D, 0x6B, 2, b'1', b'2', b'3', 0x00]);
    }

    #[test]
    fn test_feed_and_cut() {
        let cmd = EscPosCommand::FeedAndCut;
        let bytes = cmd.to_bytes();
        assert_eq!(bytes, vec![0x1B, 0x64, 3, 0x1D, 0x56, 0x00]);
    }

    #[test]
    fn test_send_to_nonexistent_device() {
        let result = send_escpos_command(99999, r#"{"type":"Init"}"#);
        assert_eq!(result, 1);
    }

    #[test]
    fn test_send_invalid_json() {
        let result = send_escpos_command(1, "not json");
        assert_eq!(result, 1);
    }

    #[test]
    fn test_command_json_roundtrip() {
        let cmd = EscPosCommand::Print { text: "Hello".to_string() };
        let json = serde_json::to_string(&cmd).unwrap();
        let parsed: EscPosCommand = serde_json::from_str(&json).unwrap();
        assert_eq!(cmd.to_bytes(), parsed.to_bytes());
    }
}
