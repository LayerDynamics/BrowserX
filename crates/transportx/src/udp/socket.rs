use lazy_static::lazy_static;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::net::UdpSocket;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::error::{set_last_error, TransportXError};

static NEXT_SOCKET_HANDLE: AtomicU64 = AtomicU64::new(1);

/// Wrapper around a non-blocking UDP socket
pub struct UdpSocketHandle {
    pub socket: UdpSocket,
    pub local_addr: String,
}

lazy_static! {
    pub static ref UDP_SOCKETS: RwLock<HashMap<u64, UdpSocketHandle>> = RwLock::new(HashMap::new());
}

/// Create a new non-blocking UDP socket bound to the given address.
/// Returns a handle (>0) on success, 0 on failure.
pub fn create_udp_socket(bind_addr: &str) -> u64 {
    let socket = match UdpSocket::bind(bind_addr) {
        Ok(s) => s,
        Err(e) => {
            set_last_error(&TransportXError::SocketError {
                message: format!("Failed to bind UDP socket to {}: {}", bind_addr, e),
            });
            return 0;
        }
    };

    if let Err(e) = socket.set_nonblocking(true) {
        set_last_error(&TransportXError::SocketError {
            message: format!("Failed to set non-blocking mode: {}", e),
        });
        return 0;
    }

    let local_addr = socket
        .local_addr()
        .map(|a| a.to_string())
        .unwrap_or_else(|_| bind_addr.to_string());

    let handle = NEXT_SOCKET_HANDLE.fetch_add(1, Ordering::SeqCst);
    let socket_handle = UdpSocketHandle { socket, local_addr };

    UDP_SOCKETS.write().insert(handle, socket_handle);
    handle
}

/// Close and remove a UDP socket by handle.
pub fn close_udp_socket(handle: u64) {
    if UDP_SOCKETS.write().remove(&handle).is_none() {
        set_last_error(&TransportXError::HandleNotFound {
            handle,
            resource_type: "UdpSocket".to_string(),
        });
    }
}

/// Send data through a UDP socket to a target address.
/// Returns bytes sent or -1 on error.
pub fn send_to(handle: u64, data: &[u8], target: &str) -> i64 {
    let sockets = UDP_SOCKETS.read();
    let sock = match sockets.get(&handle) {
        Some(s) => s,
        None => {
            set_last_error(&TransportXError::HandleNotFound {
                handle,
                resource_type: "UdpSocket".to_string(),
            });
            return -1;
        }
    };

    let addr: std::net::SocketAddr = match target.parse() {
        Ok(a) => a,
        Err(e) => {
            set_last_error(&TransportXError::SocketError {
                message: format!("Invalid target address '{}': {}", target, e),
            });
            return -1;
        }
    };

    match sock.socket.send_to(data, addr) {
        Ok(n) => n as i64,
        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => 0,
        Err(e) => {
            set_last_error(&TransportXError::SocketError {
                message: format!("send_to failed: {}", e),
            });
            -1
        }
    }
}

/// Receive data from a UDP socket.
/// Returns (bytes_read, source_addr) or None if no data available / error.
pub fn recv_from(handle: u64, buf: &mut [u8]) -> Option<(usize, String)> {
    let sockets = UDP_SOCKETS.read();
    let sock = match sockets.get(&handle) {
        Some(s) => s,
        None => {
            set_last_error(&TransportXError::HandleNotFound {
                handle,
                resource_type: "UdpSocket".to_string(),
            });
            return None;
        }
    };

    match sock.socket.recv_from(buf) {
        Ok((n, addr)) => Some((n, addr.to_string())),
        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => None,
        Err(e) => {
            set_last_error(&TransportXError::SocketError {
                message: format!("recv_from failed: {}", e),
            });
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_udp_socket_returns_nonzero() {
        let handle = create_udp_socket("127.0.0.1:0");
        assert!(handle > 0, "Expected nonzero handle, got {}", handle);
        close_udp_socket(handle);
    }

    #[test]
    fn test_close_udp_socket_removes_from_registry() {
        let handle = create_udp_socket("127.0.0.1:0");
        assert!(handle > 0);
        close_udp_socket(handle);
        assert!(UDP_SOCKETS.read().get(&handle).is_none());
    }

    #[test]
    fn test_create_multiple_sockets_unique_handles() {
        let h1 = create_udp_socket("127.0.0.1:0");
        let h2 = create_udp_socket("127.0.0.1:0");
        let h3 = create_udp_socket("127.0.0.1:0");
        assert_ne!(h1, h2);
        assert_ne!(h2, h3);
        assert_ne!(h1, h3);
        close_udp_socket(h1);
        close_udp_socket(h2);
        close_udp_socket(h3);
    }

    #[test]
    fn test_close_nonexistent_handle_does_not_panic() {
        close_udp_socket(999_999_999);
        // Should not panic, just sets LAST_ERROR
    }

    #[test]
    fn test_recv_from_fresh_socket_returns_none() {
        let handle = create_udp_socket("127.0.0.1:0");
        let mut buf = [0u8; 1024];
        let result = recv_from(handle, &mut buf);
        assert!(result.is_none(), "Expected None on fresh socket with no data");
        close_udp_socket(handle);
    }

    #[test]
    fn test_send_to_nonexistent_handle_returns_neg1() {
        let result = send_to(999_999_998, b"hello", "127.0.0.1:9999");
        assert_eq!(result, -1);
    }

    #[test]
    fn test_recv_from_nonexistent_handle_returns_none() {
        let mut buf = [0u8; 64];
        let result = recv_from(999_999_997, &mut buf);
        assert!(result.is_none());
    }

    #[test]
    fn test_create_socket_invalid_addr_returns_0() {
        let handle = create_udp_socket("not_an_address");
        assert_eq!(handle, 0);
    }

    #[test]
    fn test_socket_local_addr_stored() {
        let handle = create_udp_socket("127.0.0.1:0");
        assert!(handle > 0);
        let sockets = UDP_SOCKETS.read();
        let sock = sockets.get(&handle).unwrap();
        assert!(sock.local_addr.starts_with("127.0.0.1:"));
        drop(sockets);
        close_udp_socket(handle);
    }

    #[test]
    fn test_udp_send_and_recv_loopback() {
        let h1 = create_udp_socket("127.0.0.1:0");
        let h2 = create_udp_socket("127.0.0.1:0");
        assert!(h1 > 0 && h2 > 0);

        // Get h2's address to send to
        let h2_addr = {
            let sockets = UDP_SOCKETS.read();
            sockets.get(&h2).unwrap().local_addr.clone()
        };

        let payload = b"hello transportx";
        let sent = send_to(h1, payload, &h2_addr);
        assert_eq!(sent, payload.len() as i64);

        // Non-blocking recv may need a brief spin
        let mut buf = [0u8; 1024];
        let mut result = None;
        for _ in 0..100 {
            result = recv_from(h2, &mut buf);
            if result.is_some() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(1));
        }

        let (len, _src) = result.expect("Should have received data");
        assert_eq!(&buf[..len], payload);

        close_udp_socket(h1);
        close_udp_socket(h2);
    }

    #[test]
    fn test_udp_send_large_payload() {
        let h1 = create_udp_socket("127.0.0.1:0");
        let h2 = create_udp_socket("127.0.0.1:0");

        let h2_addr = {
            let sockets = UDP_SOCKETS.read();
            sockets.get(&h2).unwrap().local_addr.clone()
        };

        // 1350 bytes = max QUIC datagram size
        let payload: Vec<u8> = (0..1350).map(|i| (i % 256) as u8).collect();
        let sent = send_to(h1, &payload, &h2_addr);
        assert_eq!(sent, 1350);

        let mut buf = [0u8; 2048];
        let mut result = None;
        for _ in 0..100 {
            result = recv_from(h2, &mut buf);
            if result.is_some() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(1));
        }

        let (len, _) = result.expect("Should have received large payload");
        assert_eq!(len, 1350);
        assert_eq!(&buf[..len], &payload[..]);

        close_udp_socket(h1);
        close_udp_socket(h2);
    }

    #[test]
    fn test_udp_send_multiple_packets() {
        let h1 = create_udp_socket("127.0.0.1:0");
        let h2 = create_udp_socket("127.0.0.1:0");

        let h2_addr = {
            let sockets = UDP_SOCKETS.read();
            sockets.get(&h2).unwrap().local_addr.clone()
        };

        // Send 10 packets
        for i in 0u8..10 {
            let data = [i; 32];
            let sent = send_to(h1, &data, &h2_addr);
            assert_eq!(sent, 32, "Packet {} send failed", i);
        }

        // Receive all 10
        let mut received = Vec::new();
        let mut buf = [0u8; 1024];
        for _ in 0..200 {
            if let Some((len, _)) = recv_from(h2, &mut buf) {
                received.push(buf[..len].to_vec());
                if received.len() == 10 {
                    break;
                }
            } else {
                std::thread::sleep(std::time::Duration::from_millis(1));
            }
        }
        assert_eq!(received.len(), 10, "Expected 10 packets, got {}", received.len());

        close_udp_socket(h1);
        close_udp_socket(h2);
    }

    #[test]
    fn test_udp_recv_returns_sender_address() {
        let h1 = create_udp_socket("127.0.0.1:0");
        let h2 = create_udp_socket("127.0.0.1:0");

        let h1_addr = {
            let sockets = UDP_SOCKETS.read();
            sockets.get(&h1).unwrap().local_addr.clone()
        };
        let h2_addr = {
            let sockets = UDP_SOCKETS.read();
            sockets.get(&h2).unwrap().local_addr.clone()
        };

        send_to(h1, b"ping", &h2_addr);

        let mut buf = [0u8; 1024];
        let mut result = None;
        for _ in 0..100 {
            result = recv_from(h2, &mut buf);
            if result.is_some() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(1));
        }

        let (_, src_addr) = result.expect("Should have received data");
        assert_eq!(src_addr, h1_addr, "Source address should match sender's address");

        close_udp_socket(h1);
        close_udp_socket(h2);
    }

    #[test]
    fn test_udp_nonblocking_recv_no_data() {
        let handle = create_udp_socket("127.0.0.1:0");
        assert!(handle > 0);

        // Immediately try to recv — should return None without blocking
        let start = std::time::Instant::now();
        let mut buf = [0u8; 1024];
        let result = recv_from(handle, &mut buf);
        let elapsed = start.elapsed();

        assert!(result.is_none(), "Expected None when no data available");
        assert!(elapsed.as_millis() < 100, "recv_from should return immediately, took {}ms", elapsed.as_millis());

        close_udp_socket(handle);
    }

    #[test]
    fn test_udp_send_to_specific_port() {
        // Bind receiver to a specific port (use 0, then get actual port)
        let h_recv = create_udp_socket("127.0.0.1:0");
        let recv_addr = {
            let sockets = UDP_SOCKETS.read();
            sockets.get(&h_recv).unwrap().local_addr.clone()
        };
        let recv_port: u16 = recv_addr.split(':').last().unwrap().parse().unwrap();
        assert!(recv_port > 0);

        // Bind sender to specific address too
        let h_send = create_udp_socket("127.0.0.1:0");

        let payload = b"targeted send";
        let target = format!("127.0.0.1:{}", recv_port);
        let sent = send_to(h_send, payload, &target);
        assert_eq!(sent, payload.len() as i64);

        let mut buf = [0u8; 1024];
        let mut result = None;
        for _ in 0..100 {
            result = recv_from(h_recv, &mut buf);
            if result.is_some() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(1));
        }

        let (len, _) = result.expect("Should receive on specific port");
        assert_eq!(&buf[..len], payload);

        close_udp_socket(h_send);
        close_udp_socket(h_recv);
    }
}
