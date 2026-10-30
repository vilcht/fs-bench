# Windows counterpart of sampler.pl: machine-wide CPU / RAM / disk, one CSV row about every second.
#   powershell -NoProfile -File sampler.ps1 <stop-file>
# Stops when <stop-file> exists. Uses CIM performance classes, whose names are not localized
# (perfmon counter paths are, e.g. on a Polish Windows).
param([string]$StopFile)
$ErrorActionPreference = 'SilentlyContinue'
$inv = [Globalization.CultureInfo]::InvariantCulture
function N($v) { ([double]$v).ToString('0.###', $inv) }

'ts,interval_s,cpu_user,cpu_sys,cpu_iowait,cpu_idle,mem_used_mb,cache_mb,disk_read_mb_s,disk_write_mb_s,disk_total_mb_s,disk_busy_pct'
$prev = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() / 1000
while (-not (Test-Path $StopFile)) {
  Start-Sleep -Milliseconds 800
  $cpu = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'"
  $disk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'"
  $mem = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
  $os = Get-CimInstance Win32_OperatingSystem
  $t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() / 1000
  $read = $disk.DiskReadBytesPersec / 1MB
  $write = $disk.DiskWriteBytesPersec / 1MB
  $used = ($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1KB
  @(
    (N $t), (N ($t - $prev)),
    (N $cpu.PercentUserTime), (N $cpu.PercentPrivilegedTime), '', (N $cpu.PercentIdleTime),
    (N $used), (N ($mem.CacheBytes / 1MB)),
    (N $read), (N $write), (N ($read + $write)), (N ([Math]::Min(100, $disk.PercentDiskTime)))
  ) -join ','
  $prev = $t
}
