# Changelog

All notable changes to CLI Progress Reporting will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-01-12

### Added
- **Streaming API**: Native async generator support with `ProgressStream` for async iterables
- **ProgressTransform**: Node.js Transform stream with automatic progress tracking
- **attachProgress helper**: Utility to attach progress tracking to existing readable streams
- **Nested CLI structure**: More intuitive command syntax `prog <id> <action>` instead of `prog <action> --id <id>`
- **SPEC.md**: Formal specification documenting all behavior, algorithms, and invariants
- **Advanced examples**: 4 comprehensive real-world examples:
  - Concurrent file downloads with parallel tracking
  - Build pipeline with multi-stage progress
  - Streaming data processing with backpressure
  - Multi-service deployment orchestration
- **Performance benchmarks**: Statistical benchmarking with tatami-ng (criterion-equivalent rigor)
- **Buffer overflow protection**: List command now limits output to 50 trackers to prevent ENOBUFS errors

### Changed
- **BREAKING**: CLI command structure changed from `prog <action> --id <id>` to `prog <id> <action>`
  - Old: `prog init --total 100 --id myproject`
  - New: `prog myproject init 100`
- Test suite expanded from 239 to 264 tests (10.5% increase)
- Improved error messages and validation

### Removed
- 195 lines of unnecessary backward compatibility code
- Legacy command parsing logic

### Fixed
- Buffer overflow (ENOBUFS) when listing thousands of progress trackers
- CLI executor now properly limits output to prevent stdout buffer overflow in spawned processes

### Implementation Notes
- Zero runtime dependencies maintained
- Uses Node.js built-in modules only
- TypeScript with strict type checking
- All 264 tests passing with zero flaky tests

## [0.1.0] - 2025-12-XX

### Added
- Core progress tracking functionality (functional API)
- Object-oriented API with `ProgressTracker` class
- Builder pattern API with `ProgressBuilder`
- Multi-progress tracking with `MultiProgress`
- CLI tool for shell script integration
- Template system with built-in progress bar templates
- Comprehensive test suite (239 tests)
- API documentation and examples

### Implementation Notes
- Zero runtime dependencies
- Uses Node.js built-in modules only
- TypeScript with strict type checking

---

## Template Instructions

When releasing versions, follow this format:

### Version 0.1.0 - Initial Release

**Added:**
- List new features
- New functions or capabilities
- New documentation

**Changed:**
- List modifications to existing features
- API changes

**Deprecated:**
- List features marked for removal

**Removed:**
- List removed features
- Breaking changes

**Fixed:**
- List bug fixes

**Security:**
- List security fixes or improvements

### Version Numbering

- **MAJOR (X.0.0)**: Breaking changes, incompatible API changes
- **MINOR (0.X.0)**: New features, backwards-compatible
- **PATCH (0.0.X)**: Bug fixes, backwards-compatible

### Example Entry

```markdown
## [1.2.3] - 2025-01-15

### Added
- New `processData()` function with validation
- Support for UTF-8 input (#42)

### Fixed
- Handle empty string input correctly (#38)
- Memory leak in parsing loop (#40)

### Security
- Validate file paths to prevent traversal attacks
```

---

*Remove these instructions before the first release.*
