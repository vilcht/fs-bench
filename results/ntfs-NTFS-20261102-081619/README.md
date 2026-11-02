# Partial Windows NTFS run

This run was stopped early. The auto method has one measured repetition (rep 1) at each concurrency level; hardlink has one measured repetition at concurrency 1 only. Rep 0 is a warmup, not a measured repetition. The CPU baseline has three measured repetitions. Treat single-repetition results as preliminary.

The auto removal at concurrency 8 failed and must not be used as a timing. Hardlink installation failed at concurrency 8 and 16 during warmup; those are not measured timings. See the `ok` column for each phase.

The Windows removal implementation for this run removes each worktree with Node's recursive removal before unregistering it with Git. Its timings therefore measure a different removal procedure from the original Git-only phase. Real-time Defender protection was enabled. See machine.txt for the machine details.
