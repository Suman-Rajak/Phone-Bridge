---
name: bug-fix
description: Reproduce and fix a PhoneBridge regression, verify the fix with a failing-then-passing test, and record the result in the repository bug log.
---

# Fix a regression

1. Reproduce the symptom and identify the smallest case that shows it. Record the command, relevant environment, expected result, and observed result.
2. Add or tighten a regression test. Run it against the original code and check that it fails for the reported reason. For environment-dependent bugs, keep a reproducible fixture or command and document what the test covers.
3. Change the behavior at the source. Run the regression test again and run the affected existing suite.
4. Add the symptom, reproduction, cause, fix, and verified PR link to `docs/test/bug-log.md`. If publication is still pending, fill in the link when it exists. Record this use in the task evidence and use the `skill:bug-fix` capability trailer.
