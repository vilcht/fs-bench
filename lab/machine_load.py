# machine_load.py <results-dir>: whole-machine CPU load for 16 agents (worktree add + install + remove, auto).
# Integrates machine-wide busy % (samples.csv) over each phase; median of measured reps (Windows: warmup, its
# sampler stopped early). "busy-equiv" = seconds of the whole computer at 100%.
import csv, glob, os, sys
R = sys.argv[1]
RUNS = {'huawei:ext4': 'intel-core-ultra-5-125h-linux-ext4-*', 'huawei:home-btrfs': 'intel-core-ultra-5-125h-linux-btrfs-20261031-222102',
        'macbook:apfs': 'apple-m4-macos-apfs-20261031-164029', 'huawei-win:ntfs': 'ntfs-NTFS-*'}
def num(v):
    try: return float(v)
    except: return None
for cid, pat in RUNS.items():
    d = glob.glob(os.path.join(R, pat))[0]
    S = [{k: num(v) for k, v in r.items()} for r in csv.DictReader(open(d + '/samples.csv'))]
    S = [s for s in S if s['ts'] and s['interval_s']]
    rows = list(csv.DictReader(open(d + '/results.csv')))
    win = cid.startswith('huawei-win')
    reps = sorted({r['rep'] for r in rows if r['method'] == 'auto' and r['rep'] != '0'}) if not win else ['0']
    out = []
    for rep in reps:
        tot = {'wall': 0, 'busy': 0, 'sys': 0, 'peak': 0}
        for ph in ('worktree_add', 'install', 'remove'):
            r = next((r for r in rows if r['method'] == 'auto' and r['phase'] == ph and r['n'] == '16' and r['rep'] == rep), None)
            if not r or not r['t_start']: break
            t0, t1 = float(r['t_start']), float(r['t_end'])
            for s in S:
                a, b = s['ts'] - s['interval_s'], s['ts']
                ov = min(b, t1) - max(a, t0)
                if ov <= 0: continue
                busy = (s['cpu_user'] or 0) + (s['cpu_sys'] or 0)
                tot['busy'] += ov * busy / 100; tot['sys'] += ov * (s['cpu_sys'] or 0) / 100
                tot['peak'] = max(tot['peak'], busy)
            tot['wall'] += t1 - t0
        else:
            out.append(tot)
    if not out: print(cid, 'no data'); continue
    out.sort(key=lambda t: t['busy']); m = out[len(out) // 2]
    print(f"{cid:20} wall {m['wall']:6.1f}s  whole-machine-busy-equiv {m['busy']:6.1f}s  avg busy {100*m['busy']/m['wall']:3.0f}%  kernel share of busy {100*m['sys']/max(m['busy'],1e-9):3.0f}%  peak {m['peak']:3.0f}%  (reps {len(out)})")
