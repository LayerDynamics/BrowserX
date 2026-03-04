//! Serial port and printer enumeration

use serde::{Deserialize, Serialize};
use crate::trace::log_event;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub name: String,
    pub port_type: String,
    pub vid: Option<u16>,
    pub pid: Option<u16>,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterInfo {
    pub name: String,
    pub printer_type: String,
    pub port: Option<String>,
    pub status: String,
}

/// List all available serial ports on the system
pub fn list_serial_ports() -> Vec<PortInfo> {
    log_event("enumerate", "Listing serial ports", "query", None);

    match serialport::available_ports() {
        Ok(ports) => {
            let infos: Vec<PortInfo> = ports
                .into_iter()
                .map(|p| {
                    let (port_type, vid, pid, manufacturer, product, serial_number) = match p.port_type
                    {
                        serialport::SerialPortType::UsbPort(usb) => (
                            "USB".to_string(),
                            Some(usb.vid),
                            Some(usb.pid),
                            usb.manufacturer,
                            usb.product,
                            usb.serial_number,
                        ),
                        serialport::SerialPortType::BluetoothPort => {
                            ("Bluetooth".to_string(), None, None, None, None, None)
                        }
                        serialport::SerialPortType::PciPort => {
                            ("PCI".to_string(), None, None, None, None, None)
                        }
                        serialport::SerialPortType::Unknown => {
                            ("Unknown".to_string(), None, None, None, None, None)
                        }
                    };
                    PortInfo {
                        name: p.port_name,
                        port_type,
                        vid,
                        pid,
                        manufacturer,
                        product,
                        serial_number,
                    }
                })
                .collect();

            log_event(
                "enumerate",
                &format!("Found {} serial ports", infos.len()),
                "result",
                None,
            );
            infos
        }
        Err(e) => {
            log_event("enumerate", &format!("Error listing ports: {}", e), "error", None);
            Vec::new()
        }
    }
}

/// Known printer USB vendor IDs
const PRINTER_VIDS: &[u16] = &[
    0x04B8, // Epson
    0x04F9, // Brother
    0x03F0, // HP
    0x04A9, // Canon
    0x0424, // Star Micronics
    0x0DD4, // Custom Engineering
    0x0519, // Star (alt)
    0x1504, // SNBC
    0x1FC9, // NXP (receipt printers)
];

/// List available printers (serial port printers + OS printers)
pub fn list_printers() -> Vec<PrinterInfo> {
    log_event("enumerate", "Listing printers", "query", None);

    let mut printers = Vec::new();

    // Check serial ports for known printer VIDs
    let ports = list_serial_ports();
    for port in &ports {
        if let Some(vid) = port.vid {
            if PRINTER_VIDS.contains(&vid) {
                printers.push(PrinterInfo {
                    name: port.product.clone().unwrap_or_else(|| port.name.clone()),
                    printer_type: "serial".to_string(),
                    port: Some(port.name.clone()),
                    status: "available".to_string(),
                });
            }
        }
    }

    // Discover OS printers via lpstat (macOS/Linux)
    #[cfg(unix)]
    {
        if let Ok(output) = std::process::Command::new("lpstat")
            .arg("-p")
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if let Some(name) = line.strip_prefix("printer ") {
                    let name = name.split_whitespace().next().unwrap_or("unknown");
                    let status = if line.contains("idle") {
                        "idle"
                    } else if line.contains("disabled") {
                        "disabled"
                    } else {
                        "unknown"
                    };
                    printers.push(PrinterInfo {
                        name: name.to_string(),
                        printer_type: "os".to_string(),
                        port: None,
                        status: status.to_string(),
                    });
                }
            }
        }
    }

    log_event(
        "enumerate",
        &format!("Found {} printers", printers.len()),
        "result",
        None,
    );
    printers
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_serial_ports_no_crash() {
        // Should not panic even with no ports
        let ports = list_serial_ports();
        assert!(ports.len() >= 0); // Just verify it runs
    }

    #[test]
    fn test_list_printers_no_crash() {
        let printers = list_printers();
        assert!(printers.len() >= 0);
    }

    #[test]
    fn test_port_info_serialization() {
        let info = PortInfo {
            name: "/dev/ttyUSB0".to_string(),
            port_type: "USB".to_string(),
            vid: Some(0x04B8),
            pid: Some(0x0202),
            manufacturer: Some("Epson".to_string()),
            product: Some("TM-T88V".to_string()),
            serial_number: None,
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("Epson"));
        assert!(json.contains("TM-T88V"));
    }

    #[test]
    fn test_printer_vids_known() {
        assert!(PRINTER_VIDS.contains(&0x04B8)); // Epson
        assert!(PRINTER_VIDS.contains(&0x04F9)); // Brother
        assert!(PRINTER_VIDS.contains(&0x03F0)); // HP
    }
}
