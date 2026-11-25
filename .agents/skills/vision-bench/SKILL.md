---
name: vision-bench
description: Run the PhoneBridge SmartDoc document detector benchmark, compare the measured mean IoU with the baseline, and summarize changes or missing dataset access.
---

# Benchmark document detection

1. Read `docs/understand/datasets.md`. Use the documented SmartDoc sample and record whether the baseline exists before running.
2. Run `pnpm bench:vision` from the repository root. Use the command’s measured mean IoU and frame count. If the official sample is unavailable, report H5 and the exact download failure. A generated clip can verify the runner, and its result must be labelled separately.
3. When the existing baseline and run use the same dataset and mode, report their mean IoUs and the signed difference. Apply the CI tolerance from the roadmap when that gate is active. If the baseline is missing, report that there is no prior result to compare.
4. Preserve an existing baseline. Only the roadmap’s initial baseline task or an authorized baseline update can change it. Record this use in the task evidence and use the `skill:vision-bench` capability trailer.
