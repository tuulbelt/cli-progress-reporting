# CLI Progress Reporting / `prog`

Part of the [Tuulbelt](https://github.com/tuulbelt/tuulbelt) collection.

## Quick Reference

- **Language:** TypeScript
- **CLI Short Name:** `prog`
- **CLI Long Name:** `cli-progress-reporting`
- **Tests:** `npm test`
- **Build:** `npm run build`

## Development Commands

```bash
npm install      # Install dependencies
npm test         # Run all tests
npm run build    # Build for distribution
npx tsc --noEmit # Type check only
npm run test:watch  # Watch mode
```

## Code Conventions

- Zero external dependencies (Tuulbelt tools allowed via git URL)
- Result pattern for error handling
- 80%+ test coverage
- ES modules with `node:` prefix for built-ins
- See main repo for full [PRINCIPLES.md](https://github.com/tuulbelt/tuulbelt/blob/main/PRINCIPLES.md)

## Dependencies

This tool does not use other Tuulbelt tools.

## Testing

```bash
npm test                    # Run all tests (121 tests)
npm run test:unit           # Unit tests only
npm run test:cli            # CLI integration tests
npm run test:filesystem     # Filesystem tests
npm run test:fuzzy          # Fuzzy input tests
./scripts/dogfood-flaky.sh  # Validate test reliability (optional)
./scripts/dogfood-diff.sh   # Prove deterministic outputs (optional)
```

## Security

- No hardcoded secrets
- Input validation on all public APIs
- Path traversal prevention in file operations
- Run security scan: See main repo `/security-scan` command

## Related

- [Main Tuulbelt Repository](https://github.com/tuulbelt/tuulbelt)
- [Documentation](https://tuulbelt.github.io/tuulbelt/tools/cli-progress-reporting/)
- [Contributing Guide](https://github.com/tuulbelt/tuulbelt/blob/main/CONTRIBUTING.md)
- [Testing Standards](https://github.com/tuulbelt/tuulbelt/blob/main/docs/testing-standards.md)
