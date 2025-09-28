---
inclusion: always
---

# Development Guidelines and Best Practices

## Critical Rules

### Git and File Management
- **Never commit to git** without explicit user request
- **ABSOLUTELY NEVER create documentation files** (.md) without explicit user request
- **CRITICAL**: This includes README files, deployment guides, API documentation, fix summaries, completion reports, checklists, setup guides, or ANY .md files
- **NO EXCEPTIONS**: Documentation creation is STRICTLY FORBIDDEN unless the user explicitly requests it
- **FORBIDDEN DOCUMENTATION TYPES**: 
  - Implementation summaries
  - Deployment guides  
  - Production checklists
  - Setup instructions
  - Configuration guides
  - Task completion reports
  - Feature documentation
  - API documentation
  - Any standalone .md files
- **If you need to document something**: 
  1. FIRST: Update existing documentation files in the `docs/` directory
  2. SECOND: Ask the user for explicit permission before creating new files
  3. NEVER create standalone documentation files in the project root
- **Documentation Integration**: Always merge new information into existing documentation structure

### Test File Management
- **NEVER create test files in the root API directory** (`apps/api/`)
- **ALL test files MUST go in the proper test directory structure**:
  - Unit tests: `apps/api/tests/unit/`
  - Integration tests: `apps/api/tests/integration/`
  - Security tests: `apps/api/tests/security/`
  - Load tests: `apps/api/tests/load/`
  - Contract tests: `apps/api/tests/contract/`
- **Test file naming**: Follow existing patterns (`test_*.py`)
- **No standalone test scripts**: All tests must be proper pytest tests

### Command Execution - CRITICAL RULES
- **NEVER use command chaining** (`&&`, `||`, `;`) - these operators are NOT supported and will cause failures
- **NEVER use pipes** (`|`) except for the specific cases listed below - pipes cause whitelist bugs
- **ONLY allowed pipes**: Interactive git commands that must be piped to `| cat` (git log, git show, git diff, git blame)
- **Use separate executeBash calls** instead of chaining - execute each command individually
- **Use path parameter** instead of `cd` commands
- **Examples of FORBIDDEN commands**:
  - `pytest --collect-only -q | grep -E "(SKIPPED|skipped)" | wc -l` ❌
  - `ps aux | grep uvicorn` ❌  
  - `find . -name "*.py" | wc -l` ❌
  - `cat file.txt | grep pattern` ❌
- **Correct alternatives**:
  - Use separate commands: `pytest --collect-only -q` then process output
  - Use grepSearch tool instead of grep with pipes
  - Use listDirectory and readFile tools instead of find with pipes
