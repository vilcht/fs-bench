#!/usr/bin/env python3
"""Median of measured reps (rep 0 is warmup) for every results/*/results.csv.

Resource columns come from two sources: cpu-s / kernel % from the shell's child-process accounting
(exact, per phase), and machine-wide disk / RAM / iowait from samples.csv, sliced by each phase's
start and end time.
"""
import csv
import glob
import json
import os
import statistics
import sys
from collections import defaultdict

PHASES = ["worktree_add", "install", "git_status", "remove"]
RESOURCE_PHASES = ["worktree_add", "install", "remove"]


def num(s):
    return float(s) if s not in (None, "") else None


def load_samples(path):
    if not os.path.exists(path):
        return []
    rows = []
    for r in csv.DictReader(open(path)):
        rows.append({k: num(v) for k, v in r.items()})
    return rows


def window(samples, t0, t1):
    """Machine-wide resource use during [t0, t1]; each sample covers (ts - interval_s, ts]."""
    busy = iowait = disk_mb = weight = 0.0
    peak = None
    baseline = None
    has_iowait = False
    for s in samples:
        start, end = s["ts"] - s["interval_s"], s["ts"]
        if end <= t0:
            baseline = s["mem_used_mb"]
            continue
        overlap = min(end, t1) - max(start, t0)
        if overlap <= 0:
            if start >= t1:
                break
            continue
        weight += overlap
        busy += overlap * (s["cpu_user"] + s["cpu_sys"])
        if s["cpu_iowait"] is not None:
            has_iowait = True
            iowait += overlap * s["cpu_iowait"]
        disk_mb += overlap * (s["disk_total_mb_s"] or 0)
        peak = s["mem_used_mb"] if peak is None else max(peak, s["mem_used_mb"])
    if not weight:
        return {}
    out = {"busy_pct": busy / weight, "disk_mb": disk_mb}
    if has_iowait:
        out["iowait_pct"] = iowait / weight
    if peak is not None and baseline is not None:
        out["mem_delta_mb"] = peak - baseline
    return out


root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
metrics = defaultdict(lambda: defaultdict(list))  # key -> metric -> values across reps
failures = defaultdict(int)
for path in glob.glob(os.path.join(root, "*", "results.csv")):
    samples = load_samples(os.path.join(os.path.dirname(path), "samples.csv"))
    for r in csv.DictReader(open(path)):
        if r["rep"] == "0" or r["phase"] == "store_warm":
            continue
        key = (r["label"], r["fs"], r.get("scanner") or r.get("spotlight"), r["method"], r["phase"], int(r["n"]))
        if r["ok"] != "1":
            failures[key] += 1
            continue
        m = metrics[key]
        m["seconds"].append(float(r["seconds"]))
        user, sys_ = num(r.get("cpu_user_s")), num(r.get("cpu_sys_s"))
        if user is not None and sys_ is not None:
            m["cpu_s"].append(user + sys_)
            if user + sys_ > 0:
                m["kernel_pct"].append(100 * sys_ / (user + sys_))
        t0, t1, t2 = num(r.get("t_start")), num(r.get("t_end")), num(r.get("t_flushed"))
        if samples and t0 and t1:
            for k, v in window(samples, t0, t1).items():
                if k != "disk_mb":
                    m[k].append(v)
            # Buffered writes land during the sync after the phase, so disk traffic counts until t2.
            flushed = window(samples, t0, t2 or t1)
            if "disk_mb" in flushed:
                m["disk_mb"].append(flushed["disk_mb"])
            if t2:
                m["flush_s"].append(t2 - t1)

med = {k: {name: statistics.median(vs) for name, vs in m.items()} for k, m in metrics.items()}
configs = sorted({k[:4] for k in med if k[3] != "-"})


def get(cfg, phase, n, name="seconds"):
    return med.get(cfg + (phase, n), {}).get(name)


def row(name, vals, fmt="{:>9.2f}"):
    return f"  {name:<24}" + "".join(fmt.format(v) if v is not None else f"{'-':>9}" for v in vals)


for cfg in configs:
    label, fs, spot, method = cfg
    ns = sorted({k[5] for k in med if k[:4] == cfg})
    print(f"\n{label}  fs={fs}  scanner={spot}  method={method}")
    print(f"  {'phase (seconds)':<24}" + "".join(f"{'n=' + str(n):>9}" for n in ns))
    for p in PHASES:
        print(row(p, [get(cfg, p, n) for n in ns]))
    setup = [(get(cfg, "worktree_add", n) or 0) + (get(cfg, "install", n) or 0) for n in ns]
    print(row("setup (wt+install)", setup))
    print(row("setup per agent", [s / n for s, n in zip(setup, ns)]))
    print(row("slowdown vs n=1", [s / setup[0] for s in setup]))
    cpu_cfg = (label, fs, spot, "-")
    if get(cpu_cfg, "cpu", ns[0]):
        print(row("cpu baseline", [get(cpu_cfg, "cpu", n) for n in ns]))

    resources = [
        ("cpu-s", "cpu_s", "{:>9.1f}"),
        ("kernel %", "kernel_pct", "{:>9.0f}"),
        ("busy %", "busy_pct", "{:>9.0f}"),
        ("iowait %", "iowait_pct", "{:>9.1f}"),
        ("disk MB", "disk_mb", "{:>9.0f}"),
        ("flush s", "flush_s", "{:>9.2f}"),
        ("RAM +MB", "mem_delta_mb", "{:>9.0f}"),
    ]
    if any(get(cfg, p, n, "cpu_s") is not None for p in RESOURCE_PHASES for n in ns):
        print(f"  {'resources':<24}")
        for p in RESOURCE_PHASES:
            for title, name, fmt in resources:
                vals = [get(cfg, p, n, name) for n in ns]
                if any(v is not None for v in vals):
                    print(row(f"{p} {title}", vals, fmt))

for k, c in sorted(failures.items()):
    print(f"FAILED {c}x: {k}", file=sys.stderr)

with open(os.path.join(root, "summary.json"), "w") as f:
    json.dump(
        [dict(zip(["label", "fs", "scanner", "method", "phase", "n"], k), **v) for k, v in sorted(med.items())],
        f,
        indent=1,
    )
