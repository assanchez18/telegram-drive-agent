# CLAUDE.md - Telegram Drive Agent Project

## Project Context

This is a **Telegram bot** that integrates with **Google Drive** using OAuth (offline mode) and runs on **Google Cloud Run**. 

- **Architecture**: Serverless bot deployed to Cloud Run
- **Google Drive Integration**: OAuth 2.0 with offline access for persistent file operations
- **Local Development**: Uses `cloudflared` tunnel to receive Telegram webhooks locally
- **Testing Framework**: Vitest with **100% branch coverage** requirement
- **Language**: Node.js/JavaScript

## Security Rules

**CRITICAL - NO EXCEPTIONS:**

- **NEVER** write secrets, API keys, tokens, or credentials directly in code
- **NEVER** commit `.env` files, credentials, or secrets to the repository
- **ALL** secrets MUST be managed via:
  - Environment variables (local development)
  - Google Secret Manager (Cloud Run deployment)
- Always validate that sensitive data is properly externalized before committing

## Architecture & Code Style

### Preferred Structure

- **Handlers/Controllers**: Entry points for Telegram commands/callbacks
- **Services**: Business logic layer (e.g., `DriveService`, `TelegramService`)
- **Repositories/Adapters**: External integrations (Drive API, Telegram API)
- **Domain**: Pure business entities and logic

### Code Organization Rules

- Keep modules **small and focused** (single responsibility)
- **NO business logic in `index.js`** or entry points - only bootstrapping/wiring
- Follow existing patterns in the codebase (check similar files first)
- Reuse existing code instead of duplicating functionality
- Maintain consistent naming conventions with the rest of the project

## One-Prompt Implementation Rule

**Each feature/fix must be delivered COMPLETE in a single interaction:**

1. ✅ Full implementation (all files changed)
2. ✅ Comprehensive tests (unit + integration)
3. ✅ README updates (if user-facing changes or setup required)
4. ✅ Ready to merge - no follow-up prompts needed

## Local-First Development

- **Every feature MUST be testable locally** without redeploying to Cloud Run
- Use `npm run dev` with `cloudflared` for local webhook testing
- Ensure local environment setup instructions are in README
- No "cloud-only" features - if it can't be tested locally, redesign it

## Testing Strategy

### Coverage Requirements

- **100% branch coverage** for all code (new and modified)
- Tests MUST cover:
  - Happy path (integration tests)
  - Error cases (unit tests)
  - Edge cases and boundary conditions
  - Potential bugs and race conditions

### Testing Standards

- **Integration tests**: Mock only third-party services (Drive API, Telegram API)
- **Unit tests**: Test at method level; make private methods visible for testing if needed
- Use **TestFixtures** and **ApiFixtures** consistently (create new ones following existing patterns)
- **NO `any()` or `_` in tests** - use correct, specific values
- **NO `def`** - use proper class types
- Run `npm test` and `npm run test:coverage` before considering work complete

## Code Quality Standards

### General Principles

- **Clear naming**: Variables, functions, and files should be self-documenting
- **Useful logging**: Log important state changes, errors, and user actions
- **Error handling**: Always handle errors gracefully with user-friendly messages
- **No quick hacks**: If you're tempted to add a TODO or FIXME, implement it properly now

### Before Finishing

- ✅ All tests passing
- ✅ 100% coverage maintained
- ✅ No linting errors
- ✅ No secrets in code
- ✅ README updated if needed

## Pull Request Deliverables

When completing work, always provide:

1. **List of files changed** (grouped by type: added/modified/deleted)
2. **Testing commands**:
   ```bash
   # Example
   npm test -- path/to/specific.test.js
   npm run test:coverage
   npm run dev  # for local integration testing
   ```
3. **How to verify** the feature locally (step-by-step if non-trivial)

---

## Quick Reference

### Local Development
```bash
npm run dev          # Start local server with cloudflared
npm test             # Run all tests
npm run test:coverage # Check coverage
```

### Key Files
- `src/index.js` - Entry point (bootstrap only)
- `src/handlers/` - Telegram command handlers
- `src/services/` - Business logic
- `test/` - Test files mirroring src structure

### Environment Variables Required
See `.env.example` for full list - never commit actual `.env`
