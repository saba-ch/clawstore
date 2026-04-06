---
name: Verify before committing
description: Always test changes locally before committing — never commit and push untested code
type: feedback
---

Always verify changes work locally before committing and pushing. Run the actual API, hit the endpoints, check the DB — don't just type-check and assume it works.

**Why:** Multiple commits in a row had bugs (FK ordering, wrong field names, missing profile hook) that would have been caught by actually running the code. The user had to be the tester repeatedly.

**How to apply:** After making changes to API routes or DB-touching code, restart the dev server and test the actual endpoint (curl, or run the CLI command) before committing. Type-checking is not enough.
