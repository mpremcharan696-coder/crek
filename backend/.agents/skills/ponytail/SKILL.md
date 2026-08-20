---
name: ponytail
description: Anti-over-engineering guidelines prioritizing simplicity, standard library features, and pragmatic software design.
---

# Ponytail Skill — Lean Engineering

Ponytail ensures all code produced is lean, pragmatic, and free of over-engineered bloat.

## The Ponytail Decision Ladder

Before writing any new code or introducing new dependencies, evaluate:
1. **Necessity Check (YAGNI)**: Does this code/feature actually need to exist right now?
2. **Native Platform Capability**: Can FastAPI, Python standard library, or native browser features accomplish this?
3. **Dependency Reuse**: Is there an already-installed library in the project that handles this?
4. **Minimal Workable Implementation**: Write the cleanest, simplest code that completely satisfies the requirements without extra fluff.
5. **Safety**: Never sacrifice security, error handling, or performance for brevity.
