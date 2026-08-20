# Ponytail Guidelines — Pragmatic & Efficient Engineering

1. **YAGNI (You Ain't Gonna Need It)**: Do not add speculative features, unused abstractions, or premature complexity.
2. **Standard Library & Framework First**: Leverage native language, FastAPI, and standard library features before introducing new packages.
3. **Use Existing Dependencies**: Check `pyproject.toml` / `requirements.txt` and reuse installed tools before adding new ones.
4. **Keep It Simple & Lean**: Write concise, clear, and direct code. Prefer readable inline implementations over deep class hierarchies when simple functions suffice.
5. **Zero Compromises on Security**: Always maintain strict security, proper input validation, and robust error handling while keeping code lean.
