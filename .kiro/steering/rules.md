---
inclusion: always
---

# Development Guidelines and Best Practices

## Critical Rules

### Git and File Management
- **Never commit to git** without explicit user request
- **Never create documentation files** (.md) without explicit request

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
