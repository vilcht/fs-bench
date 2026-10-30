#!/usr/bin/env python3
"""Builds shared/data/results.json for the slides from ../results/*/.

Real runs are matched to machines via machines.json. Every expected config without a real run
gets mock numbers, flagged `mock: true`; the slides badge anything drawn from mock data.
"""
import csv
import glob
import json
import os
import random
import re
import statistics
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
TALK = os.path.dirname(HERE)
RESULTS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(TALK), "results")
OUT = os.path.join(TALK, "shared", "data", "results.json")
PHASES = ["worktree_add", "install", "git_status", "remove"]
METHOD = "auto"

STACKS = {
    # stack id: (display name, color family)
    "apfs": ("APFS", "apfs"),
    "apfs-noindex": ("APFS, Spotlight off", "apfs"),
    "ntfs": ("NTFS + Defender", "ntfs"),
    "ntfs-nodefender": ("NTFS, Defender off", "ntfs"),
    "devdrive": ("Dev Drive (ReFS)", "refs"),
}


def stack_of(os_name, fs, scanner, site):
    fs_l = fs.lower()
    if os_name == "Darwin":
        return "apfs-noindex" if scanner == "spotlight-off" else "apfs"
    if os_name == "Windows":
        if fs_l == "refs":
            return "devdrive"
        return "ntfs-nodefender" if scanner == "defender-off" else "ntfs"
    return f"home-{fs_l}" if site == "home" else fs_l


def stack_meta(machine_key, stack):
    if stack in STACKS:
        return STACKS[stack]
    fs = stack.removeprefix("home-")
    if machine_key.endswith("-wsl"):
        return (f"WSL2 {fs}", "wsl")
    return (f"{fs} (home)" if stack.startswith("home-") else fs, fs)


def parse_machine_txt(path):
    info = {}
    if os.path.exists(path):
        for line in open(path, errors="replace"):
            if ":" in line:
                k, v = line.split(":", 1)
                info.setdefault(k.strip(), v.strip())
    return info


def median(xs):
    return statistics.median(xs) if xs else None


def load_run(run_dir):
    info = parse_machine_txt(os.path.join(run_dir, "machine.txt"))
    rows = list(csv.DictReader(open(os.path.join(run_dir, "results.csv"))))
    if not rows:
        return None
    first = rows[0]
    scanner = first.get("scanner") or first.get("spotlight") or "none"
    if scanner == "n/a":
        scanner = "none"
    site = "volume" if info.get("bench_dir", "").startswith("/mnt/fsbench-") else "home"

    times = defaultdict(list)
    cpu = defaultdict(list)
    batches = {}
    failures = defaultdict(int)
    for r in rows:
        if r["rep"] == "0" or r["phase"] == "store_warm":
            continue
        n = int(r["n"])
        if r["ok"] != "1":
            failures[(r["phase"], n)] += 1
            continue
        if r["method"] == "-" and r["phase"] == "cpu":
            cpu[n].append(float(r["seconds"]))
        elif r["method"] == METHOD:
            times[(r["phase"], n)].append(float(r["seconds"]))
            if r.get("t_start"):
                batches[(r["phase"], n, int(r["rep"]))] = (float(r["t_start"]), float(r["t_end"]))

    ns = sorted({n for _, n in times})
    phases = {p: {str(n): median(times[(p, n)]) for n in ns if times[(p, n)]} for p in PHASES}

    retries = defaultdict(int)
    for log in glob.glob(os.path.join(run_dir, "logs", f"{METHOD}-worktree_add-n*-r*-*.log")):
        m = re.search(r"-n(\d+)-r(\d+)-", os.path.basename(log))
        if m and m.group(2) != "0":
            retries[m.group(1)] += sum(1 for line in open(log, errors="replace") if line.startswith("fsbench-retry"))

    return {
        "label": first["label"],
        "os": first["os"],
        "fs": first["fs"],
        "scanner": scanner,
        "site": site,
        "info": info,
        "ns": ns,
        "phases": phases,
        "cpu": {str(n): median(v) for n, v in sorted(cpu.items())},
        "retries": dict(retries),
        "failures": {f"{p}@{n}": c for (p, n), c in failures.items()},
        "race": load_race(run_dir, batches, times, ns),
    }


def load_race(run_dir, batches, times, ns):
    """Per-agent timeline at the highest n, for the rep whose setup time is the median."""
    path = os.path.join(run_dir, "agents.csv")
    if not ns or not os.path.exists(path):
        return None
    n = ns[-1]
    reps = sorted({rep for (p, bn, rep) in batches if p == "worktree_add" and bn == n})
    totals = []
    for rep in reps:
        wt, inst = batches.get(("worktree_add", n, rep)), batches.get(("install", n, rep))
        if wt and inst:
            totals.append(((wt[1] - wt[0]) + (inst[1] - inst[0]), rep))
    if not totals:
        return None
    totals.sort()
    rep = totals[len(totals) // 2][1]
    agents = defaultdict(list)
    for r in csv.DictReader(open(path)):
        if r["method"] == METHOD and int(r["n"]) == n and int(r["rep"]) == rep:
            agents[r["phase"]].append((int(r["agent"]), float(r["t_start"]), float(r["t_end"]), r["ok"] == "1"))
    t0 = batches[("worktree_add", n, rep)][0]
    out = {"n": n, "rep": rep, "phases": {}}
    for phase in ["worktree_add", "install", "remove"]:
        b = batches.get((phase, n, rep))
        if not b:
            continue
        base = t0 if phase != "remove" else b[0]
        out["phases"][phase] = {
            "start": round(b[0] - base, 3),
            "end": round(b[1] - base, 3),
            "agents": [[a, round(s - base, 3), round(e - base, 3), ok] for a, s, e, ok in sorted(agents[phase])],
        }
    return out


# Rough per-family shapes for mock data: (n=1 seconds, exponent) per phase, batch time = a * n^b.
# b = 1 means flat cost per agent. "default" is fitted to the real desktop xfs/btrfs runs;
# the others are guesses. Placeholders only: every slide badges mock data.
MOCK_PROFILES = {
    "default": {"worktree_add": (0.9, 0.45), "install": (0.8, 1.2), "git_status": (0.5, 0.15), "remove": (1.6, 0.85)},
    "apfs": {"worktree_add": (1.5, 0.7), "install": (1.5, 1.35), "git_status": (0.4, 0.3), "remove": (3.0, 1.0)},
    "ntfs": {"worktree_add": (4.0, 0.8), "install": (4.0, 1.2), "git_status": (1.2, 0.4), "remove": (5.0, 1.0)},
    "refs": {"worktree_add": (2.5, 0.7), "install": (2.5, 1.2), "git_status": (0.8, 0.3), "remove": (3.0, 0.9)},
}


def mock_config(cid, rng):
    machine_key, stack = cid.split(":", 1)
    _, family = stack_meta(machine_key, stack)
    profile = MOCK_PROFILES.get(family, MOCK_PROFILES["default"])
    if stack == "apfs-noindex":
        profile = {p: (a * 0.8, b - 0.05) for p, (a, b) in profile.items()}
    speed = 0.9 if machine_key == "macmini" else 1.0
    ns = [1, 2, 4, 8, 16]
    phases = {
        p: {str(n): round(a * speed * n**b, 3) for n in ns}
        for p, (a, b) in profile.items()
    }
    race = {"n": 16, "rep": 0, "phases": {}}
    t = 0.0
    for p in ["worktree_add", "install", "remove"]:
        total = phases[p]["16"]
        base = 0.0 if p == "remove" else t
        agents = []
        for i in range(1, 17):
            s = base + rng.uniform(0, 0.15)
            e = base + total * rng.uniform(0.55, 1.0)
            agents.append([i, round(s, 3), round(e, 3), True])
        end = max(a[2] for a in agents)
        race["phases"][p] = {"start": round(base, 3), "end": round(end, 3), "agents": agents}
        if p != "remove":
            t = end + 0.3
    return {
        "ns": ns,
        "phases": phases,
        "cpu": {str(n): round(4.0 * speed * max(1, n / 6) ** 0.9, 3) for n in ns},
        "retries": {"16": 6} if family in ("apfs", "ntfs") else {},
        "failures": {},
        "race": race,
    }


def main():
    cfg = json.load(open(os.path.join(TALK, "machines.json")))
    by_label = {label: m for m in cfg["machines"] for label in m["labels"]}
    machines = {m["key"]: m for m in cfg["machines"]}

    real = {}
    for results_csv in sorted(glob.glob(os.path.join(RESULTS, "*", "results.csv"))):
        run_dir = os.path.dirname(results_csv)
        run = load_run(run_dir)
        if not run:
            continue
        m = by_label.get(run["label"])
        if not m:
            print(f"skip {os.path.basename(run_dir)}: label '{run['label']}' not in machines.json", file=sys.stderr)
            continue
        cid = f"{m['key']}:{stack_of(run['os'], run['fs'], run['scanner'], run['site'])}"
        if cid in real:
            print(f"note {cid}: newer run {os.path.basename(run_dir)} replaces an older one", file=sys.stderr)
        run["dir"] = os.path.basename(run_dir)
        real[cid] = run  # sorted by dir name, so the newest run wins

    rng = random.Random(7)
    configs = []
    for cid in list(cfg["expected"]) + sorted(set(real) - set(cfg["expected"])):
        machine_key, stack = cid.split(":", 1)
        m = machines[machine_key]
        stack_name, family = stack_meta(machine_key, stack)
        run = real.get(cid)
        if run:
            data = {k: run[k] for k in ["ns", "phases", "cpu", "retries", "failures", "race"]}
            mock = False
            race_mock = run["race"] is None
            if race_mock:
                data["race"] = mock_config(cid, rng)["race"]
        else:
            data = mock_config(cid, rng)
            mock = race_mock = True
        info = run["info"] if run else {}
        configs.append({
            "id": cid,
            "machine": machine_key,
            "machineName": m["name"],
            "machineDetail": m["detail"],
            "stack": stack,
            "stackName": stack_name,
            "family": family,
            "name": f"{m['name']} · {stack_name}",
            "mock": mock,
            "raceMock": race_mock,
            "source": run["dir"] if run else None,
            "cpuModel": info.get("cpu"),
            "cores": info.get("cores"),
            **data,
        })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({"method": METHOD, "configs": configs}, f, indent=1)
    n_real = sum(not c["mock"] for c in configs)
    print(f"wrote {OUT}: {n_real} real, {len(configs) - n_real} mock")
    for c in configs:
        print(f"  {'REAL' if not c['mock'] else 'mock'}{' (race mock)' if c['raceMock'] and not c['mock'] else ''}  {c['id']}  {c['source'] or ''}")


main()
