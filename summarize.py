#!/usr/bin/env python3
"""Median of measured reps (rep 0 is warmup) for every results/*/results.csv."""
import csv
import glob
import json
import os
import statistics
import sys
from collections import defaultdict

PHASES = ["worktree_add", "install", "git_status", "remove"]

root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "results")
times = defaultdict(list)
failures = defaultdict(int)
for path in glob.glob(os.path.join(root, "*", "results.csv")):
    for r in csv.DictReader(open(path)):
        if r["rep"] == "0" or r["phase"] == "store_warm":
            continue
        key = (r["label"], r["fs"], r["spotlight"], r["method"], r["phase"], int(r["n"]))
        if r["ok"] != "1":
            failures[key] += 1
            continue
        times[key].append(float(r["seconds"]))

med = {k: statistics.median(v) for k, v in times.items()}
configs = sorted({k[:4] for k in med if k[3] != "-"})

def row(name, vals):
    return f"  {name:<22}" + "".join(f"{v:>9.2f}" if v is not None else f"{'-':>9}" for v in vals)

for label, fs, spot, method in configs:
    ns = sorted({k[5] for k in med if k[:4] == (label, fs, spot, method)})
    print(f"\n{label}  fs={fs}  spotlight={spot}  method={method}")
    print(f"  {'phase (seconds)':<22}" + "".join(f"{'n=' + str(n):>9}" for n in ns))
    for p in PHASES:
        print(row(p, [med.get((label, fs, spot, method, p, n)) for n in ns]))
    setup = [
        med.get((label, fs, spot, method, "worktree_add", n), 0) + med.get((label, fs, spot, method, "install", n), 0)
        for n in ns
    ]
    print(row("setup (wt+install)", setup))
    print(row("setup per agent", [s / n for s, n in zip(setup, ns)]))
    print(row("slowdown vs n=1", [s / setup[0] for s in setup]))
    cpu = [med.get((label, fs, spot, "-", "cpu", n)) for n in ns]
    if cpu[0]:
        print(row("cpu baseline", cpu))

for k, c in sorted(failures.items()):
    print(f"FAILED {c}x: {k}", file=sys.stderr)

with open(os.path.join(root, "summary.json"), "w") as f:
    json.dump([dict(zip(["label", "fs", "spotlight", "method", "phase", "n"], k), seconds=v) for k, v in sorted(med.items())], f, indent=1)
