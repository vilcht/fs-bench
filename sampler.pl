#!/usr/bin/perl
# Machine-wide resource sampler, one CSV row per interval on stdout.
#   perl sampler.pl [linux-block-device-name]
# Linux reads /proc every 0.5s. macOS runs `iostat` (disk MB/s + CPU) and `vm_stat` about once a
# second. Rates and percentages cover the interval ending at `ts`.
use strict;
use warnings;
use Time::HiRes qw(time sleep);

$| = 1;
print "ts,interval_s,cpu_user,cpu_sys,cpu_iowait,cpu_idle,mem_used_mb,cache_mb,"
  . "disk_read_mb_s,disk_write_mb_s,disk_total_mb_s,disk_busy_pct\n";
$^O eq 'darwin' ? darwin() : linux(shift // '');

sub linux {
  my $dev = shift;
  my $interval = 0.5;
  my ($prev_t, @prev_cpu, @prev_disk);
  while (1) {
    my $t = time;
    open my $fh, '<', '/proc/stat' or die;
    my @c = (split ' ', scalar <$fh>)[1 .. 8];    # user nice system idle iowait irq softirq steal
    close $fh;
    my %mem = map { /^(\w+):\s+(\d+)/ ? ($1 => $2) : () } slurp('/proc/meminfo');
    my @d = (0, 0, 0);
    for (slurp('/proc/diskstats')) {
      my @f = split ' ';
      @d = @f[5, 9, 12] if $f[2] eq $dev;           # sectors read, sectors written, io_ticks ms
    }
    if (defined $prev_t) {
      my $dt = $t - $prev_t;
      my @dc = map { $c[$_] - $prev_cpu[$_] } 0 .. 7;
      my $total = 0;
      $total += $_ for @dc;
      $total ||= 1;
      my $pct = sub { sprintf '%.1f', 100 * shift() / $total };
      my $rd = ($d[0] - $prev_disk[0]) * 512 / 2**20 / $dt;
      my $wr = ($d[1] - $prev_disk[1]) * 512 / 2**20 / $dt;
      printf "%.3f,%.3f,%s,%s,%s,%s,%.0f,%.0f,%.1f,%.1f,%.1f,%.1f\n", $t, $dt,
        $pct->($dc[0] + $dc[1]), $pct->($dc[2] + $dc[5] + $dc[6]), $pct->($dc[4]), $pct->($dc[3]),
        ($mem{MemTotal} - $mem{MemAvailable}) / 1024, $mem{Cached} / 1024,
        $rd, $wr, $rd + $wr, 100 * ($d[2] - $prev_disk[2]) / 1000 / $dt;
    }
    $prev_t = $t;
    @prev_cpu = @c;
    @prev_disk = @d;
    sleep $interval;
  }
}

sub darwin {
  # One `iostat` call per sample: its first row averages since boot, the second covers the 1s
  # wait. Separate calls avoid depending on whether iostat flushes when writing to a pipe.
  my $prev_t = time;
  while (1) {
    my @lines = `iostat -C -c 2 -w 1 -n 16`;
    my $t = time;
    my ($header) = grep { m{KB/t} } @lines;
    my @f = split ' ', $lines[-1];
    next unless $header && @f && $f[0] =~ /^[\d.]+$/;
    my @h = split ' ', $header;
    my %col;
    for my $i (0 .. $#h) { $col{$h[$i]} //= $i }
    my $disk = 0;
    $disk += $f[$_] for grep { $h[$_] eq 'MB/s' } 0 .. $#h;
    my $vm = `vm_stat`;
    my ($page) = $vm =~ /page size of (\d+)/;
    my %p = $vm =~ /^(.+?):\s+(\d+)\./mg;
    my $used = ($p{'Anonymous pages'} + $p{'Pages wired down'} + $p{'Pages occupied by compressor'}) * $page;
    printf "%.3f,%.3f,%s,%s,,%s,%.0f,%.0f,,,%.1f,\n", $t, $t - $prev_t, $f[$col{us}], $f[$col{sy}],
      $f[$col{id}], $used / 2**20, $p{'File-backed pages'} * $page / 2**20, $disk;
    $prev_t = $t;
  }
}

sub slurp {
  open my $fh, '<', shift or die;
  return <$fh>;
}
