# Migration numbering note

Migration file numbers are **not strictly sequential** and contain duplicates:

- `0029` appears twice (`0029_overrated_scrambler.sql`, `0029_provider_registry_reindex_flags.sql`)
- `0030` appears twice (`0030_fierce_thunder.sql`, `0030_vengeful_goblin_queen.sql`)
- `0027` is missing

This happened because migrations were generated in parallel branches. The files
were **not renamed** to fix the numbering: some of these may already be applied
in deployed environments, and Drizzle tracks applied migrations by filename in
the journal — renaming would break those environments.

Do not rename existing migration files. New migrations should continue from the
highest number (`0039` onwards). Drizzle applies migrations in journal order,
so the duplicate numbers are harmless at runtime.
