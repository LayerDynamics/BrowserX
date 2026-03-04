//! Trace logging for serial device operations

use lazy_static::lazy_static;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_TRACE_ENTRIES: usize = 1000;

/// Direction of a trace event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TraceDirection {
    In,
    Out,
    Error,
    Result,
    Query,
    Open,
    Close,
    Config,
    Flush,
    Timeout,
}

impl TraceDirection {
    fn from_str(s: &str) -> Self {
        match s {
            "in" => Self::In,
            "out" => Self::Out,
            "error" => Self::Error,
            "result" => Self::Result,
            "query" => Self::Query,
            "open" => Self::Open,
            "close" => Self::Close,
            "config" => Self::Config,
            "flush" => Self::Flush,
            "timeout" => Self::Timeout,
            _ => Self::Out,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceEvent {
    pub timestamp: u64,
    pub component: String,
    pub message: String,
    pub direction: TraceDirection,
    pub data_preview: Option<String>,
}

lazy_static! {
    static ref TRACE_LOG: Mutex<VecDeque<TraceEvent>> = Mutex::new(VecDeque::new());
}

pub fn log_event(component: &str, message: &str, direction: &str, data_preview: Option<&str>) {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let event = TraceEvent {
        timestamp,
        component: component.to_string(),
        message: message.to_string(),
        direction: TraceDirection::from_str(direction),
        data_preview: data_preview.map(|s| s.to_string()),
    };

    let mut log = TRACE_LOG.lock();
    if log.len() >= MAX_TRACE_ENTRIES {
        log.pop_front();
    }
    log.push_back(event);
}

pub fn get_trace_log() -> String {
    let log = TRACE_LOG.lock();
    serde_json::to_string(&*log).unwrap_or_else(|_| "[]".to_string())
}

pub fn clear_trace_log() {
    TRACE_LOG.lock().clear();
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    #[test]
    #[serial]
    fn test_log_and_retrieve() {
        clear_trace_log();
        log_event("test", "hello", "out", Some("data"));
        let json = get_trace_log();
        assert!(json.contains("hello"));
        assert!(json.contains("test"));
    }

    #[test]
    #[serial]
    fn test_clear() {
        clear_trace_log();
        log_event("test", "msg", "in", None);
        clear_trace_log();
        let json = get_trace_log();
        assert_eq!(json, "[]");
    }

    #[test]
    #[serial]
    fn test_ring_buffer_limit() {
        clear_trace_log();
        for i in 0..1005 {
            log_event("ringtest", &format!("msg{}", i), "out", None);
        }
        let log = TRACE_LOG.lock();
        assert!(log.len() <= MAX_TRACE_ENTRIES);
        // Verify the buffer was bounded and last entry is present
        assert!(log.back().unwrap().message.contains("msg1004"));
    }
}
