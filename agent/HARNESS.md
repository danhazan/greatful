# Agent Task Harness

Every agent that receives a development task on this project MUST follow this harness end-to-end. No phase may be skipped. The harness applies to all task types; phases diverge briefly at the start, then converge at Investigation.

This document is platform-agnostic. Follow it as written regardless of which AI platform or coding agent you are running in.

## Required tools

Two tools must be active throughout every task. Verify they are available before starting Phase 0.

**Superpowers** — provides workflow enforcement, subagent-driven plan and implementation review, and TDD discipline. Used explicitly in Phase 2.3 (plan review subagent) and Phase 4.3 (implementation review). If your platform supports Superpowers, use its `subagent-driven-development` and `requesting-code-review` skills at those phases. If not, replicate the subagent pattern manually by starting a fresh context with only the specified inputs.

**Ponytail** — enforces YAGNI-first, simplicity-first thinking. Used explicitly in Phase 2.2 (complexity review of the plan) and Phase 4.1 REFACTOR (complexity review of the diff). Run `/ponytail-review` at those points. If your platform does not expose Ponytail as a slash command, apply the Ponytail ladder manually as described in each phase.

Superpowers is the *structure*. Ponytail is the *attitude*. Both are required; they cover different failure modes.

---

## Phase 0 — Task Digest

Your task is defined in a task file at `agent/tasks/<task-id>.md`. Read it in full before doing anything else. If no task file exists and you received the task as a plain prompt instead, write the task file now using the template at `agent/tasks/TEMPLATE.md` — this is required before proceeding, because the task file is the single source of truth that every subsequent phase references.

Classify the task into one of two tracks, then follow the matching digest before proceeding to Phase 1.

### Track A: Bug Report

1. State the bug in one sentence in your own words. If you cannot, ask for clarification before proceeding.
2. Identify the **observable symptom** (what the user sees) and the **expected behavior** (what should happen instead).
3. Check `agent/COMMON_FIXES.md`. If a similar issue has been resolved before, note the resolution — it may inform (but not determine) your investigation.
4. List the components most likely involved: which API route, which frontend page, which utility, which model. These are hypotheses, not conclusions.
5. Write down the hypothesis: *"This bug is probably caused by X because Y."* You will validate or invalidate this during Investigation.

### Track B: Feature / Refactor

1. State the goal in one sentence: what behavior will exist after this task that does not exist now, or what structural change will be made and why.
2. Identify whether this is a **new feature** (adds behavior), a **refactor** (same behavior, different structure), or both.
3. List the areas of the codebase most likely affected: which routes, components, services, models, utilities. These are hypotheses.
4. State your open questions — things you need the codebase or docs to answer before you can plan. Write them down now so Investigation has a clear agenda.

> Both tracks converge at Phase 1.

---

## Phase 1 — Investigation

**Objective:** Build a grounded understanding of the codebase before touching a single file. The docs are a guide, not ground truth.

### 1.1 Read the documentation index

```
cat docs/README.md
```

Identify which doc files are relevant to this task. Read them. Mark any clear discrepancy between the docs and what you observe in the code — you will fix these at the end of this phase.

Key docs and their scope:
- `docs/ARCHITECTURE_AND_SETUP.md` — overall system design, stack decisions
- `docs/TEST_GUIDELINES.md` — test layer architecture, which tests belong where
- `docs/USEFUL_COMMANDS.md` — commands you will need during implementation
- `docs/KNOWN_ISSUES.md` — known problems; check for overlap with the current task
- `agent/COMMON_FIXES.md` — past bug resolutions (bug track only)

### 1.2 Locate and read the relevant code

Navigate from the hypothesis formed in Phase 0 to the actual code. Follow the data: start at the entry point (route handler or component), then trace inward through services, models, and utilities. Do not read the entire codebase — stay focused on the task's blast radius.

For bugs: find where the symptom manifests and trace backward to the likely root cause. Do not fix yet.

For features/refactors: find where the new behavior will attach, and understand the surrounding contracts — what the callers expect, what the data shape is, what the tests already cover.

### 1.3 Document findings

Write a short investigation summary in this format:

```
## Investigation Summary

**Task type:** Bug / Feature / Refactor
**Entry point:** [file + function/component]
**Affected files:** [list]
**Root cause / integration point:** [1-3 sentences]
**Relevant existing tests:** [list test files]
**Existing utilities to reuse:** [anything that avoids new code]
**Discrepancies found in docs:** [list or "none"]
```

### 1.4 Fix doc discrepancies (minimal, inline)

If you found concrete discrepancies between the docs and the actual code, fix them now. Keep edits minimal — correct the wrong fact, do not rewrite the section. This keeps docs as a reliable guide for future agents.

---

## Phase 2 — Plan Compilation + Quality Gates

**Objective:** Produce an implementation plan clear enough that a developer with no prior context could execute it without guessing.

### 2.1 Write the plan

The plan must include:

- **Summary:** one paragraph describing what will change and why
- **Task list:** numbered, each task is 2–5 minutes of work, has an exact file path, and describes *what* changes (not just "update the file")
- **Test strategy:** which tests will be written (and in which layer — see `docs/TEST_GUIDELINES.md`)
- **Risk surface:** anything that could break adjacent functionality
- **Reuse inventory:** existing utilities, helpers, and patterns that will be used instead of new code

Save the plan to `agent/plans/YYYY-MM-DD-<slug>.md`.

### 2.2 Quality Gate — Round 1: Ponytail Complexity Review

Run `/ponytail-review` against the plan. Ponytail will scan for over-engineering: unrequested abstractions, speculative flexibility, dependencies that aren't needed, implementations that a stdlib or existing utility already handles. Address every finding before proceeding.

Apply the Ponytail ladder to every task in the plan — stop at the first rung that answers the question and go no further:
1. Does this need to exist? (YAGNI — if no, remove it)
2. Does existing project code already do this? (reuse it)
3. Does the stdlib / framework / platform do this? (use it)
4. Can this be done in one line? (write one line)
5. Only then: write the minimum that works

### 2.3 Quality Gate — Round 2: Superpowers Plan Review

Using Superpowers' subagent invocation, dispatch a fresh subagent with **only** the following context (not the full conversation):

- The task file (`agent/tasks/<task-id>.md`)
- The investigation summary (Phase 1.3)
- The compiled plan
- `docs/TEST_GUIDELINES.md`
- The project code standards from `AGENTS.md`

Ask the subagent to review the plan for:

- Missing edge cases not covered by the test strategy
- Duplicated logic that already exists elsewhere
- Incorrect layer assignment (e.g. business logic in a route handler)
- Any task that is underspecified (no file path, no clear success condition)
- Anything that contradicts project patterns observed in the investigation summary

The subagent returns a severity-graded report: **Critical** (plan cannot proceed), **Important** (plan should be revised), **Minor** (optional improvement). Address all Critical and Important findings. Document any Minor findings you choose not to fix and why.

### 2.4 Finalize the plan

Update `agent/plans/YYYY-MM-DD-<slug>.md` with the reviewed, revised plan. It is now the single source of truth for implementation.

---

## Phase 3 — Human Approval

**Stop. Present the following to the human:**

1. The investigation summary (Phase 1.3)
2. A link to the plan file (Phase 2.4)
3. A plain-language summary of what each quality gate found and how findings were addressed
4. Any open questions that require a human decision before implementation can begin

**Wait for one of:**
- **Approved** → proceed to Phase 4
- **Approved with comments** → revise the plan, re-run only the affected quality gate checks, re-present
- **Rejected** → return to Phase 1 or Phase 0 if the task needs re-scoping

Do not begin implementation until explicit approval is received.

---

## Phase 4 — TDD Implementation + Quality Gates

**Objective:** Implement the plan under strict Red-Green-Refactor discipline. The Superpowers `test-driven-development` skill enforces this automatically. If any production code is written before its test fails, delete it and start over.

### 4.1 TDD Protocol

Follow this cycle **for every task in the plan**, one task at a time:

#### RED Phase

1. Write the test file (or add to an existing test file — consult `docs/TEST_GUIDELINES.md` for test layer placement).
2. Write only the tests that cover the behavior described in the current task. Do not write tests for future tasks.
3. Create a **stub** of the module/function/component being tested — just enough for the test file to import without a syntax error. The stub must *not* implement the behavior. For example:
   - Python: `raise NotImplementedError("stub")`
   - TypeScript function: `return null as any`
   - React component: `export const MyComponent = () => null`
4. Run the tests. They must fail. Verify the failure is an **assertion failure** (the behavior is absent), not an import error or syntax error. If the test fails for the wrong reason, fix the stub or the test until the failure is meaningful.
5. **Only proceed to GREEN after confirming RED for the right reason.**

#### GREEN Phase

6. Write the minimum implementation to make the failing tests pass. Not the cleanest code — the minimum that works. Resist the urge to generalize.
7. Run the full test suite (not just the new tests): `npm run lint && npm run type-check && npm test` (frontend) or `pytest` (backend). All pre-existing tests must remain passing.
8. **Only proceed to REFACTOR if all tests pass.**

#### REFACTOR Phase

9. Improve the code: naming, structure, remove duplication, clarify intent. Do not change behavior.
10. Run the full test suite again. All tests must still pass.
11. Run `/ponytail-review` on the diff. Ponytail checks for complexity that crept in during GREEN — premature abstractions, unnecessary generalization, code that could be simpler. Address every finding.

#### Edge Cases

12. Add tests for: invalid inputs, boundary conditions, error states, auth enforcement, concurrent access (if applicable).
13. Run the RED→GREEN→REFACTOR cycle for each edge case group.

#### Move to the next task

14. Repeat from step 1 for the next task in the plan.

### 4.2 Layer-specific TDD guidance

**FastAPI backend:**
- Start with the HTTP layer test (pytest + httpx TestClient): test the route, status code, and response shape
- Stub: a route handler that raises `NotImplementedError` or returns a hardcoded wrong response
- After HTTP tests pass, add service-layer unit tests for business logic in isolation
- Use the in-memory SQLite fixture from `tests/conftest.py` — never a real database

**Next.js frontend:**
- Start with a component render test (Jest + Testing Library): test that key elements appear
- Stub: a component that returns `null` (or a placeholder `<div>`)
- After render tests pass, add interaction tests (click, input, async data)
- For API integration, mock `apiClient` or `fetchPublicPost` — test the component's behavior, not the API

**Shared rules:**
- A test must fail before its implementation exists
- `normalizePostFromApi()`, `userDataMapping.ts`, and `notificationMapping.ts` are data contracts — test their consumers, not their internals, unless the task touches those utilities directly
- Never use `cache: 'no-store'` bypass in tests; test components that rely on it by mocking the fetch layer

### 4.3 Quality Gate — Superpowers Implementation Review

After completing all tasks in the plan, invoke the Superpowers `requesting-code-review` skill. This dispatches a fresh subagent with only the git diff and the original plan — no conversation history. The review is two-stage:

- **Stage 1:** Spec compliance — does the implementation match the plan?
- **Stage 2:** Code quality — naming, patterns, duplication, standards adherence

Critical issues block the task from completing. Address them and re-run the review. Important issues should be fixed; if you push back, document the technical justification. Minor issues may be deferred — mark them with a `# ponytail: <reason>` inline comment noting what could be simplified and why it was deferred.

---

## Phase 5 — Completion Report and Feedback

**Stop. Present the following to the human:**

### 5.1 What was implemented

- A plain-language description of every change made
- Files created, modified, deleted
- New behaviors introduced
- Existing behaviors that were changed (even incidentally)
- Any technical debt deferred — run `/ponytail-debt` to generate the full list from `# ponytail:` comments added during implementation

### 5.2 Affected functionality

- Which features or flows now behave differently
- Which API routes changed signature or behavior
- Which frontend components or pages are affected
- Any downstream effects on other parts of the system

### 5.3 Manual test checklist

Provide a numbered list of manual test scenarios the human should verify in the running app. Each scenario must include:
- Starting state (what is set up before the test)
- Action (what the user does)
- Expected result (what should happen)

Example format:
```
1. [Auth flow] Log in as a new user with no prior posts.
   Action: Navigate to the feed.
   Expected: Empty state is shown, not an error.
```

### 5.4 Wait for feedback

The human may:
- **Sign off** → task is complete. If this was a complex bug with added value to document, add or update an entry in `agent/COMMON_FIXES.md`.
- **Request changes** → return to Phase 4 for the specific change, then re-run quality gates and re-present Phase 5
- **Identify a new task** → create a new task file; do not extend this task's scope

---

## Harness Rules

These rules apply at all times and override any conflicting instruction:

1. **Docs are a guide, not ground truth.** Always verify against the code.
2. **No implementation before a failing test.** If you find yourself writing production code first, delete it.
3. **No scope creep.** If you find something unrelated that needs fixing, note it in `docs/KNOWN_ISSUES.md` and stay on task.
4. **Use existing code.** If something exists that does what you need, use it. Rewrite only when the existing code is broken or structurally incompatible.
5. **Security rules are never on the chopping block.** The Ponytail YAGNI ladder never applies to auth enforcement, input sanitization, or data validation at trust boundaries.
6. **Quality gates are mandatory.** A quality gate finding is not a suggestion. Critical findings block progress. There is no "I'll come back to it."
7. **Wait for approval.** Phase 3 and the feedback loop in Phase 5 are hard stops. Do not interpret silence as approval.
