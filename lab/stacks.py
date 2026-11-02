# stacks.py <out/tag>: summarize bpftrace on-CPU and off-CPU stacks per phase.
import re, sys, collections, os
D = sys.argv[1]
SCHED = re.compile(r'^(__schedule|schedule|schedule_\w+|io_schedule\w*|preempt_schedule\w*|__cond_resched|rwsem_down_\w+|__mutex_lock\w*|mutex_lock\w*|__down\w*|down_read\w*|down_write\w*|percpu_rwsem_\w+|__percpu_down\w*|folio_wait\w*|wait_for_completion\w*|__wait_on_bit\w*|out_of_line_wait\w*|bit_wait\w*|__rt_mutex\w*|rt_mutex\w*|__btrfs_tree_\w*lock|btrfs_tree_\w*lock\w*|rwsem_\w+|osq_lock|xlog_grant_head_wait|xfs_buf_lock|__xfs_buf_\w+|xfs_ilock\w*|xfs_log_reserve|xfs_trans_reserve|xfs_trans_alloc\w*|down|up_\w+)$')
IDLE = ('futex_', 'do_epoll_wait', 'ep_poll', 'do_nanosleep', 'hrtimer_nanosleep', 'pipe_read', 'pipe_write', 'do_wait', 'kernel_wait4', 'unix_stream', 'sock_', 'do_sys_poll', 'do_select', 'wait_woken', 'anon_pipe', 'n_tty')
def parse(path):
    txt = open(path).read()
    maps = {}
    for m in re.finditer(r'^@(on|off)\[(.*?)\]: (\d+)$', txt, re.S | re.M):
        frames = [l.strip().split('+')[0] for l in m.group(2).split('\n') if l.strip()]
        frames = [f for f in frames if not f.startswith('perf_trace_sched')]
        maps.setdefault(m.group(1), []).append((frames, int(m.group(3))))
    return maps
def syscall(fr):
    for f in reversed(fr):
        m = re.match(r'^__(?:x64|se)_sys_(\w+)|^__do_sys_(\w+)|^do_sys_(\w+)', f)
        if m: return next(g for g in m.groups() if g)
    for f in fr:
        if f in ('do_unlinkat', 'do_rmdir', 'do_mkdirat', 'do_linkat', 'do_symlinkat', 'vfs_unlink', 'vfs_link'): return f
    return '?'
def fsfuncs(fr):
    return [f for f in fr if re.match(r'^(ext4|jbd2|btrfs|xfs|xlog)_', f)]
for phase in ('worktree_add', 'install', 'remove'):
    p = f'{D}/{phase}.bt.txt'
    if not os.path.exists(p): continue
    m = parse(p)
    on = m.get('on', []); off = m.get('off', [])
    ontot = sum(c for _, c in on); kern = sum(c for f, c in on if f)
    print(f'\n## {os.path.basename(D)} {phase}: on-CPU samples {ontot}, in kernel {100*kern/max(1,ontot):.0f}%')
    sc = collections.Counter(); leaf = collections.Counter(); fsinc = collections.Counter(); spin = 0
    for fr, c in on:
        if not fr: continue
        sc[syscall(fr)] += c; leaf[fr[0]] += c
        if any(re.search(r'spin|osq_lock|queued_\w*lock', f) for f in fr[:3]): spin += c
        for f in set(fsfuncs(fr)): fsinc[f] += c
    print(f'  kernel time by syscall: ' + ', '.join(f'{k} {100*v/kern:.0f}%' for k, v in sc.most_common(6)))
    print(f'  hottest kernel functions (self): ' + ', '.join(f'{k} {100*v/kern:.0f}%' for k, v in leaf.most_common(7)))
    print(f'  spinning on locks (top-3 frames): {100*spin/max(1,kern):.0f}% of kernel samples')
    print(f'  fs functions (inclusive): ' + ', '.join(f'{k} {100*v/kern:.0f}%' for k, v in fsinc.most_common(9)))
    # off-CPU: drop idle waits (futex/epoll: thread pools waiting for work)
    real = [(fr, us) for fr, us in off if fr and not any(any(f.startswith(x) for x in IDLE) for f in fr)]
    tot = sum(us for _, us in real)
    print(f'  off-CPU (non-idle) thread-seconds asleep: {tot/1e6:.1f}')
    why = collections.Counter(); scs = collections.Counter()
    for fr, us in real:
        key = [f for f in fr if not SCHED.match(f)][:2]
        lockish = [f for f in fr[:8] if SCHED.match(f) and not f.startswith(('__schedule', 'schedule'))][:2]
        why[(' > '.join(lockish) or 'sleep') + '  in  ' + ' < '.join(key)] += us
        scs[syscall(fr)] += us
    print(f'  asleep by syscall: ' + ', '.join(f'{k} {100*v/max(1,tot):.0f}%' for k, v in scs.most_common(6)))
    for k, v in why.most_common(7):
        print(f'    {100*v/max(1,tot):4.0f}%  {k}')
