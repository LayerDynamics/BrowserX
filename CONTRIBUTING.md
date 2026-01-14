# Contributing to BrowserX

Thank you for your interest in contributing to BrowserX! This document provides guidelines and information for contributors.

## 🚧 Project Status

BrowserX is in **early development**. The architecture is still evolving, and many components are incomplete or contain intentional stubs for planned functionality. Contributions are welcome, but please understand that:

- Core designs may change significantly
- Many files contain stubs and TODOs
- Documentation is a priority over implementation
- Unused imports/variables are often intentional placeholders

## 💡 Contributing Philosophy

### Documentation First

BrowserX prioritizes understanding and documenting browser architecture before rushing to implementation. High-quality documentation contributions are especially valuable:

- Clarifying existing architecture documents
- Adding code examples and diagrams
- Documenting implementation patterns
- Writing guides for specific subsystems

### Implement, Don't Remove

**Critical principle**: If you see unused imports, variables, or methods, they are likely meant to be implemented, not removed.

From our project guidelines:
> "If something is called but missing it means it should be implemented not removed"
> "If there are unused variable or methods or imports ALWAYS use them appropriately as intended and expected as they are always critical to all operations"

When you encounter unused code:
1. ✅ Implement the missing functionality that uses it
2. ✅ Add tests for the new implementation
3. ❌ Don't remove it as "dead code"

### Understand the Architecture

Before contributing code, spend time understanding the layered architecture:

1. Read [Browser.md](./Browser.md) and [ProxyEngine.md](./ProxyEngine.md)
2. Review the [component documentation](./browser/docs/)
3. Understand how data flows through the layers
4. Check [CLAUDE.md](./CLAUDE.md) for detailed architectural guidance

## 🛠️ Development Setup

### Prerequisites

- **Deno** 2.x or later ([install](https://deno.land/))
- **Rust** 1.70+ with Cargo ([install](https://rustup.rs/))
- **Git** for version control
- **Code editor** with TypeScript/Rust support (VSCode, Zed, etc.)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/[your-username]/BrowserX.git
cd BrowserX

# Browser setup
cd browser
deno task check  # Type check

# Proxy setup
cd ../proxy-engine
deno check core/runtime.ts

# Pixpane setup
cd ../crates/pixpane
cargo build --release
deno run --allow-all gen_bindings.ts
```

### Development Workflow

1. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** following the code style (see below)

3. **Test your changes**:
   ```bash
   # Browser tests
   cd browser && deno test --allow-all

   # Rust tests
   cd crates/pixpane && cargo test

   # Type checking
   deno task check
   ```

4. **Commit with descriptive messages**:
   ```bash
   git add .
   git commit -m "feat: add HTML tokenizer state machine

   Implements 80+ tokenization states following HTML5 spec.
   Adds support for RCDATA, RAWTEXT, and SCRIPT_DATA modes."
   ```

5. **Push and create a pull request**

## 📝 Code Style

### TypeScript/Deno

- Use **TypeScript strict mode** with no implicit `any`
- Follow **Deno formatting**: `deno fmt`
- Use **descriptive names** for functions and variables
- Add **JSDoc comments** for public APIs
- Prefer **composition over inheritance**
- Keep functions **small and focused**

Example:
```typescript
/**
 * Resolves a DNS query with caching and TTL management.
 *
 * @param hostname - The hostname to resolve (e.g., "example.com")
 * @param recordType - The DNS record type (A, AAAA, CNAME, etc.)
 * @returns Promise resolving to DNSRecord array
 */
export async function resolveDNS(
  hostname: string,
  recordType: DNSRecordType,
): Promise<DNSRecord[]> {
  // Implementation
}
```

### Rust

- Follow **Rust conventions**: `cargo fmt`
- Run **Clippy**: `cargo clippy`
- Add **documentation comments** with `///`
- Use **Result<T, E>** for error handling
- Prefer **explicit types** for FFI boundaries

Example:
```rust
/// Creates a new window with the specified configuration.
///
/// # Arguments
/// * `config` - Window configuration with title, size, and options
///
/// # Returns
/// Window ID (u64) on success, 0 on failure. Call `get_last_error()` for details.
#[deno_bindgen]
pub fn create_window(config: WindowConfig) -> u64 {
    // Implementation
}
```

### Architecture Patterns

**Layered Design**: Respect layer boundaries
- Don't skip layers (e.g., rendering calling network directly)
- Use well-defined interfaces between layers
- Keep dependencies pointing downward

**Composability**: Expose subsystems publicly
```typescript
class RequestPipeline {
  // Public getters for subsystems
  getDNSResolver(): DNSResolver { return this.dnsResolver; }
  getConnectionPool(): ConnectionPool { return this.connectionPool; }
}
```

**Type Safety**: Use branded types for IDs
```typescript
type RequestID = string & { __brand: "RequestID" };
type NodeID = string & { __brand: "NodeID" };
```

## 🧪 Testing

### Writing Tests

- Add tests for all new functionality
- Use **descriptive test names** that explain what is being tested
- Follow **Arrange-Act-Assert** pattern
- Test both **success and error cases**

Example:
```typescript
Deno.test("DNSResolver caches responses with TTL", async () => {
  // Arrange
  const resolver = new DNSResolver();
  const hostname = "example.com";

  // Act
  const result1 = await resolver.resolve(hostname, "A");
  const result2 = await resolver.resolve(hostname, "A");

  // Assert
  assertEquals(result1.fromCache, false);
  assertEquals(result2.fromCache, true);
});
```

### Running Tests

```bash
# All browser tests
cd browser && deno test --allow-all

# Specific test file
deno test --allow-all src/engine/network/DNSResolver.test.ts

# Rust tests
cd crates/pixpane && cargo test

# Watch mode
deno test --allow-all --watch
```

## 📋 Contribution Types

### 🐛 Bug Fixes

- Create an issue describing the bug first (or reference existing issue)
- Include steps to reproduce
- Add tests that fail before the fix and pass after
- Keep fixes focused and minimal

### ✨ New Features

- Discuss in an issue before starting implementation
- Ensure the feature aligns with project architecture
- Add comprehensive documentation
- Include usage examples
- Add tests covering main use cases

### 📚 Documentation

- Fix typos and clarify unclear sections
- Add code examples and diagrams
- Expand architecture documents
- Create usage guides for specific features
- Document implementation patterns

### 🎨 Refactoring

- Discuss significant refactors in an issue first
- Ensure tests pass before and after
- Keep refactors separate from feature changes
- Update documentation to reflect changes

## 🔍 Pull Request Process

1. **Fork the repository** and create a branch from `main`

2. **Make your changes** following the guidelines above

3. **Update documentation** (README, architecture docs, code comments)

4. **Add tests** for new functionality

5. **Run all checks**:
   ```bash
   deno task check
   deno task test
   deno task lint
   deno fmt --check
   cargo test
   cargo fmt -- --check
   cargo clippy
   ```

6. **Write a clear PR description**:
   - What does this PR do?
   - Why is this change needed?
   - How does it work?
   - Any breaking changes?
   - Related issues?

7. **Request review** and respond to feedback

8. **Wait for approval** from maintainers

### PR Title Format

Use conventional commit format:

- `feat: ` - New features
- `fix: ` - Bug fixes
- `docs: ` - Documentation changes
- `refactor: ` - Code refactoring
- `test: ` - Adding or updating tests
- `chore: ` - Maintenance tasks

Examples:
- `feat: implement CSS cascade algorithm`
- `fix: resolve memory leak in connection pool`
- `docs: add architecture diagram for rendering pipeline`

## 🚫 What NOT to Contribute

- Removing "unused" code without understanding its purpose
- Large refactors without prior discussion
- Features that break the layered architecture
- Code without tests or documentation
- Backwards-incompatible changes without justification
- Changes to the resources/ directory (reference implementations)

## 🤝 Code Review

Expect feedback on:
- **Architecture alignment** - Does this fit the layered design?
- **Code quality** - Is it readable, maintainable, tested?
- **Documentation** - Is the change well-documented?
- **Performance** - Any performance implications?
- **Security** - Are there security considerations?

Be patient - reviewers are volunteers. Respond professionally to feedback.

## 📖 Resources

### Project Documentation

- [README.md](./README.md) - Project overview
- [Browser.md](./Browser.md) - Browser architecture (30k+ tokens)
- [ProxyEngine.md](./ProxyEngine.md) - Proxy architecture (57k+ tokens)
- [browser/docs/](./browser/docs/) - Detailed technical documents
- [CLAUDE.md](./CLAUDE.md) - AI assistant development guide

### External Resources

- [HTML5 Specification](https://html.spec.whatwg.org/)
- [CSS Specifications](https://www.w3.org/Style/CSS/specs.en.html)
- [HTTP/1.1 RFC](https://tools.ietf.org/html/rfc7230)
- [Chromium Design Docs](https://www.chromium.org/developers/design-documents/)
- [Deno Documentation](https://deno.land/manual)
- [Rust Book](https://doc.rust-lang.org/book/)

## 💬 Communication

- **Issues** - For bugs, features, and discussions
- **Pull Requests** - For code contributions
- **Discussions** - For general questions (if enabled)

Be respectful, constructive, and patient. We're all learning and building together.

## 📄 License

By contributing to BrowserX, you agree that your contributions will be licensed under the project's license (see [LICENSE](./LICENSE)).

---

**Thank you for contributing to BrowserX!** Every contribution, no matter how small, helps make this project better.
