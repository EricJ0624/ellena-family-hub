#Requires -Version 5.1
<#
.SYNOPSIS
  Windows 시스템 무결성 읽기 전용 감사(Audit) 스크립트

.DESCRIPTION
  - 파일 삭제/수정/실행 차단 정책 일체 없음 (읽기·분석·리포트만)
  - 주요 경로 실행형 파일 서명·타임스탬프 검사
  - 레지스트리 Run/RunOnce 및 작업 스케줄러 전수 조사
  - NTFS USN 저널에서 최근 1년 내 고위험 확장자 삭제 흔적 추적
  - 위험도(High/Medium/Low) 테이블 출력 + system_audit_report.csv 저장

.NOTES
  관리자 권장(USN 저널·일부 시스템 경로 접근). Access Denied 시 해당 항목만 건너뜀.
  사용: powershell -ExecutionPolicy Bypass -File .\scripts\system-integrity-audit.ps1
#>

[CmdletBinding()]
param(
    [string]$ReportPath = (Join-Path -Path (Get-Location) -ChildPath 'system_audit_report.csv'),
    [int]$UsnMaxRecords = 200000,
    [int]$UsnLookbackDays = 365,
    [switch]$SkipUsnJournal,
    [switch]$QuickScan
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

# 안전 정책: 이 스크립트는 검사 대상에 대해 Remove-Item / Clear-Content / 바이너리 변조를
# 호출하지 않습니다. 유일한 쓰기는 진단 리포트 CSV(및 필요 시 리포트 폴더 생성)뿐입니다.

$script:Findings = [System.Collections.Generic.List[object]]::new()
$script:ScanStart = Get-Date
$script:IsAdmin = $false

function Test-IsAdministrator {
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($id)
        return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch {
        return $false
    }
}

function Add-Finding {
    param(
        [Parameter(Mandatory)][ValidateSet('High', 'Medium', 'Low')][string]$Risk,
        [Parameter(Mandatory)][string]$Category,
        [Parameter(Mandatory)][string]$Item,
        [string]$Detail = '',
        [string]$Path = '',
        [string]$Evidence = ''
    )
    $script:Findings.Add([pscustomobject]@{
        Timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        Risk      = $Risk
        Category  = $Category
        Item      = $Item
        Path      = $Path
        Detail    = $Detail
        Evidence  = $Evidence
    })
}

function Write-AuditProgress {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor Cyan
}

# ---------------------------------------------------------------------------
# 1) 실행형 파일 서명 / 타임스탬프 스캔
# ---------------------------------------------------------------------------
function Get-AuditScanRoots {
    $roots = New-Object System.Collections.Generic.List[string]
    $candidates = @(
        (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'),
        $env:APPDATA,
        $env:LOCALAPPDATA,
        $env:ProgramData,
        (Join-Path $env:SystemRoot 'System32'),
        (Join-Path $env:SystemRoot 'SysWOW64'),
        (Join-Path $env:SystemRoot 'Temp'),
        (Join-Path $env:LOCALAPPDATA 'Temp')
    )
    foreach ($c in $candidates) {
        if ([string]::IsNullOrWhiteSpace($c)) { continue }
        try {
            if (Test-Path -LiteralPath $c -PathType Container -ErrorAction Stop) {
                [void]$roots.Add($c)
            }
        } catch { }
    }
    return $roots
}

function Get-RiskForUnsignedOrSuspiciousFile {
    param(
        [System.IO.FileInfo]$File,
        [object]$Signature,
        [datetime]$Now
    )

    $ext = $File.Extension.ToLowerInvariant()
    $name = $File.Name.ToLowerInvariant()
    $full = $File.FullName
    $ageDays = ($Now - $File.CreationTime).TotalDays
    $modDays = ($Now - $File.LastWriteTime).TotalDays
    $inUserWritable = ($full -like '*\AppData\*' -or $full -like '*\Temp\*' -or $full -like '*\ProgramData\*')
    $inStartup = ($full -match '\\Startup\\')
    $inSystem = ($full -like '*\Windows\System32\*' -or $full -like '*\Windows\SysWOW64\*')

    $status = if ($null -eq $Signature) { 'Unknown' } else { [string]$Signature.Status }
    $isSignedValid = ($status -eq 'Valid')
    $isBatOrPs1 = ($ext -in @('.bat', '.cmd', '.ps1', '.vbs', '.js'))

    # 고위험 휴리스틱
    if ($inStartup -and -not $isSignedValid) {
        return @{ Risk = 'High'; Detail = "Startup 경로 + 서명 상태: $status" }
    }
    if ($inUserWritable -and ($ext -in @('.exe', '.dll', '.scr')) -and -not $isSignedValid -and $ageDays -le 30) {
        return @{ Risk = 'High'; Detail = "사용자 쓰기 가능 경로 + 최근 생성($([int]$ageDays)일) + 서명: $status" }
    }
    if ($inSystem -and -not $isSignedValid -and ($ext -in @('.exe', '.dll'))) {
        return @{ Risk = 'High'; Detail = "시스템 경로 미서명/무효 서명: $status" }
    }
    if ($name -match '(^|[^a-z])(update|svchost|csrss|lsass|winlogon|explorer|runtimebroker)([^a-z]|$)' -and $inUserWritable -and -not $isSignedValid) {
        return @{ Risk = 'High'; Detail = "시스템 유사 파일명 + 사용자 경로 + 서명: $status" }
    }
    if ($isBatOrPs1 -and $inUserWritable -and ($modDays -le 14 -or $inStartup)) {
        return @{ Risk = 'Medium'; Detail = "최근 변경/Startup 스크립트 ($ext), 수정 $($File.LastWriteTime)" }
    }
    if (-not $isSignedValid -and $inUserWritable -and ($ext -in @('.exe', '.dll'))) {
        return @{ Risk = 'Medium'; Detail = "사용자 경로 미서명 바이너리: $status" }
    }
    if ($ageDays -le 7 -and ($ext -in @('.exe', '.dll', '.ps1', '.bat')) -and $inUserWritable) {
        return @{ Risk = 'Low'; Detail = "최근 7일 내 생성된 실행형 파일" }
    }
    if (-not $isSignedValid -and ($ext -in @('.exe', '.dll'))) {
        return @{ Risk = 'Low'; Detail = "서명 상태: $status" }
    }
    return $null
}

function Invoke-ExecutableIntegrityScan {
    Write-AuditProgress '실행형 파일 서명/타임스탬프 스캔 시작...'
    $now = Get-Date
    $extensions = @('.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.scr', '.js')
    $roots = Get-AuditScanRoots
    $maxPerRoot = if ($QuickScan) { 800 } else { 5000 }
    $recentOnlyDays = if ($QuickScan) { 90 } else { 0 } # 0 = 전체(루트별 상한 내)

    foreach ($root in $roots) {
        Write-AuditProgress "  스캔 루트: $root"
        $count = 0
        try {
            # PS 5.1 호환: Get-ChildItem + ErrorAction (접근 거부 시 중단 없음)
            $files = Get-ChildItem -LiteralPath $root -Recurse -File -Force -ErrorAction SilentlyContinue |
                Where-Object { $extensions -contains $_.Extension.ToLowerInvariant() }

            foreach ($fi in $files) {
                if ($count -ge $maxPerRoot) {
                    Add-Finding -Risk 'Low' -Category 'ScanLimit' -Item 'RootCapReached' -Path $root `
                        -Detail "루트당 최대 $maxPerRoot 개 파일만 검사 (나머지 생략)"
                    break
                }
                try {
                    if ($recentOnlyDays -gt 0) {
                        $newest = if ($fi.CreationTime -gt $fi.LastWriteTime) { $fi.CreationTime } else { $fi.LastWriteTime }
                        if (($now - $newest).TotalDays -gt $recentOnlyDays) { continue }
                    }

                    $count++
                    $path = $fi.FullName
                    $sig = $null
                    try {
                        $sig = Get-AuthenticodeSignature -LiteralPath $path -ErrorAction Stop
                    } catch {
                        $sig = $null
                    }

                    $riskInfo = Get-RiskForUnsignedOrSuspiciousFile -File $fi -Signature $sig -Now $now
                    if ($null -eq $riskInfo) { continue }

                    $sigStatus = if ($null -eq $sig) { 'N/A' } else { [string]$sig.Status }
                    $signer = ''
                    try {
                        if ($sig -and $sig.SignerCertificate) {
                            $signer = $sig.SignerCertificate.Subject
                        }
                    } catch { }

                    Add-Finding -Risk $riskInfo.Risk -Category 'FileIntegrity' -Item $fi.Name -Path $fi.FullName `
                        -Detail $riskInfo.Detail `
                        -Evidence "Created=$($fi.CreationTime.ToString('s')); Modified=$($fi.LastWriteTime.ToString('s')); Sig=$sigStatus; Signer=$signer"
                } catch {
                    # Access Denied / 점유 파일 등 — 스캔 계속
                    continue
                }
            }
        } catch {
            Add-Finding -Risk 'Low' -Category 'ScanError' -Item 'RootEnumerateFailed' -Path $root `
                -Detail $_.Exception.Message
        }
    }
}

# ---------------------------------------------------------------------------
# 2) 레지스트리 자동 실행 (Run / RunOnce)
# ---------------------------------------------------------------------------
function Invoke-AutorunRegistryAudit {
    Write-AuditProgress '레지스트리 Run/RunOnce 조사...'
    $runKeys = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer\Run',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer\Run'
    )

    foreach ($keyPath in $runKeys) {
        try {
            if (-not (Test-Path -LiteralPath $keyPath -ErrorAction SilentlyContinue)) { continue }
            $props = Get-ItemProperty -LiteralPath $keyPath -ErrorAction Stop
            $skip = @('PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider')
            foreach ($p in $props.PSObject.Properties) {
                if ($skip -contains $p.Name) { continue }
                try {
                    $val = [string]$p.Value
                    if ([string]::IsNullOrWhiteSpace($val)) { continue }

                    $risk = 'Low'
                    $detail = '자동 실행 항목'
                    $targetPath = $val

                    # 경로 추출 시도
                    if ($val -match '"([^"]+\.(exe|dll|bat|cmd|ps1|vbs|js|scr))"') {
                        $targetPath = $Matches[1]
                    } elseif ($val -match '(?i)([A-Z]:\\[^\s"]+\.(exe|dll|bat|cmd|ps1|vbs|js|scr))') {
                        $targetPath = $Matches[1]
                    }

                    $exists = $false
                    $signedOk = $false
                    try {
                        if (Test-Path -LiteralPath $targetPath -PathType Leaf -ErrorAction SilentlyContinue) {
                            $exists = $true
                            $s = Get-AuthenticodeSignature -LiteralPath $targetPath -ErrorAction SilentlyContinue
                            $signedOk = ($null -ne $s -and $s.Status -eq 'Valid')
                        }
                    } catch { }

                    if ($val -match '(?i)\\AppData\\|\\Temp\\|\\Downloads\\|powershell\s+-enc|cmd\s+/c|wscript|cscript|mshta|rundll32') {
                        $risk = 'High'
                        $detail = '사용자/임시 경로 또는 스크립트 호스트 기반 자동 실행'
                    } elseif (-not $exists) {
                        $risk = 'Medium'
                        $detail = '대상 파일 없음(깨진 자동실행) 또는 경로 파싱 실패'
                    } elseif (-not $signedOk) {
                        $risk = 'Medium'
                        $detail = '자동 실행 대상 미서명/무효 서명'
                    }

                    Add-Finding -Risk $risk -Category 'RegistryAutorun' -Item $p.Name -Path $keyPath `
                        -Detail $detail -Evidence $val
                } catch {
                    continue
                }
            }
        } catch {
            Add-Finding -Risk 'Low' -Category 'RegistryAutorun' -Item 'KeyAccessDenied' -Path $keyPath `
                -Detail $_.Exception.Message
        }
    }
}

# ---------------------------------------------------------------------------
# 3) 작업 스케줄러
# ---------------------------------------------------------------------------
function Invoke-ScheduledTaskAudit {
    Write-AuditProgress '작업 스케줄러 전수 조사...'
    try {
        $tasks = Get-ScheduledTask -ErrorAction Stop
    } catch {
        Add-Finding -Risk 'Medium' -Category 'ScheduledTask' -Item 'EnumerateFailed' `
            -Detail $_.Exception.Message
        return
    }

    foreach ($task in $tasks) {
        try {
            $info = $null
            try { $info = Get-ScheduledTaskInfo -TaskName $task.TaskName -TaskPath $task.TaskPath -ErrorAction SilentlyContinue } catch { }

            $actions = @()
            try {
                foreach ($a in @($task.Actions)) {
                    $exec = ''
                    $args = ''
                    try { $exec = [string]$a.Execute } catch { }
                    try { $args = [string]$a.Arguments } catch { }
                    if ($exec -or $args) {
                        $actions += ("$exec $args").Trim()
                    }
                }
            } catch { }

            $actionText = ($actions -join ' | ')
            if ([string]::IsNullOrWhiteSpace($actionText)) { continue }

            $risk = $null
            $detail = ''
            $state = [string]$task.State

            if ($actionText -match '(?i)\\AppData\\|\\Temp\\|\\Downloads\\|powershell\s+-enc|-encodedcommand|frombase64string|mshta|wscript|cscript|cmd\.exe\s+/c') {
                $risk = 'High'
                $detail = '의심 경로/인코딩/스크립트 호스트 작업'
            } elseif ($task.TaskPath -notmatch '(?i)\\Microsoft\\' -and $state -eq 'Ready') {
                # 비-Microsoft 경로 작업: 서명 확인
                $firstExe = $null
                if ($actionText -match '"([^"]+\.exe)"') { $firstExe = $Matches[1] }
                elseif ($actionText -match '(?i)([A-Z]:\\[^\s"]+\.exe)') { $firstExe = $Matches[1] }

                $signedOk = $false
                if ($firstExe) {
                    try {
                        if (Test-Path -LiteralPath $firstExe -PathType Leaf -ErrorAction SilentlyContinue) {
                            $s = Get-AuthenticodeSignature -LiteralPath $firstExe -ErrorAction SilentlyContinue
                            $signedOk = ($null -ne $s -and $s.Status -eq 'Valid')
                        }
                    } catch { }
                }
                if (-not $signedOk) {
                    $risk = 'Medium'
                    $detail = '비-Microsoft 작업 + 미서명/경로 불명'
                } else {
                    $risk = 'Low'
                    $detail = '비-Microsoft 작업(서명 유효)'
                }
            }

            if ($null -ne $risk) {
                Add-Finding -Risk $risk -Category 'ScheduledTask' `
                    -Item ($task.TaskPath + $task.TaskName) -Path $actionText `
                    -Detail $detail `
                    -Evidence "State=$state; LastRun=$(if ($info) { $info.LastRunTime } else { 'N/A' })"
            }
        } catch {
            continue
        }
    }
}

# ---------------------------------------------------------------------------
# 4) NTFS USN Journal — 최근 1년 고위험 생성 후 삭제 흔적
# ---------------------------------------------------------------------------
function Invoke-UsnJournalAudit {
    if ($SkipUsnJournal) {
        Write-AuditProgress 'USN 저널 스캔 생략 (-SkipUsnJournal)'
        return
    }
    if (-not $script:IsAdmin) {
        Add-Finding -Risk 'Medium' -Category 'UsnJournal' -Item 'AdminRequired' `
            -Detail 'USN 저널 조회는 관리자 권한이 필요합니다. 관리자 PowerShell로 재실행하세요.'
        return
    }

    Write-AuditProgress 'NTFS USN 저널 조회 (고위험 삭제 흔적, 최대 레코드 제한 적용)...'

    $usnType = @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public static class UsnJournalReader
{
    private const uint GENERIC_READ = 0x80000000;
    private const uint FILE_SHARE_READ = 0x00000001;
    private const uint FILE_SHARE_WRITE = 0x00000002;
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
    private const int FSCTL_QUERY_USN_JOURNAL = unchecked((int)0x000900f4);
    private const int FSCTL_READ_USN_JOURNAL = unchecked((int)0x000900bb);

    private const uint USN_REASON_FILE_CREATE = 0x00000100;
    private const uint USN_REASON_FILE_DELETE = 0x00000200;
    private const uint USN_REASON_RENAME_OLD_NAME = 0x00001000;
    private const uint USN_REASON_CLOSE = 0x80000000;

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateFile(
        string lpFileName, uint dwDesiredAccess, uint dwShareMode,
        IntPtr lpSecurityAttributes, uint dwCreationDisposition,
        uint dwFlagsAndAttributes, IntPtr hTemplateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DeviceIoControl(
        IntPtr hDevice, int dwIoControlCode, IntPtr lpInBuffer, int nInBufferSize,
        byte[] lpOutBuffer, int nOutBufferSize, out int lpBytesReturned, IntPtr lpOverlapped);

    [StructLayout(LayoutKind.Sequential)]
    private struct USN_JOURNAL_DATA_V0
    {
        public ulong UsnJournalID;
        public long FirstUsn;
        public long NextUsn;
        public long LowestValidUsn;
        public long MaxUsn;
        public ulong MaximumSize;
        public ulong AllocationDelta;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct READ_USN_JOURNAL_DATA_V0
    {
        public long StartUsn;
        public uint ReasonMask;
        public uint ReturnOnlyOnClose;
        public ulong Timeout;
        public ulong BytesToWaitFor;
        public ulong UsnJournalID;
    }

    public class UsnHit
    {
        public string FileName;
        public string Reason;
        public long Usn;
        public ulong FileRef;
        public DateTime Timestamp;
        public uint ReasonCode;
    }

    public static List<UsnHit> ReadDeletedHighRisk(string driveLetter, int lookbackDays, int maxRecords, out string error)
    {
        error = null;
        var results = new List<UsnHit>();
        var createSeen = new Dictionary<ulong, string>();
        var deleted = new List<UsnHit>();

        char dl = char.ToUpperInvariant(driveLetter.TrimEnd('\\', ':')[0]);
        string vol = @"\\.\" + dl + ":";
        IntPtr handle = CreateFile(vol, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
            IntPtr.Zero, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, IntPtr.Zero);
        if (handle == IntPtr.Zero || handle == new IntPtr(-1))
        {
            error = "CreateFile failed: " + new Win32Exception(Marshal.GetLastWin32Error()).Message;
            return results;
        }

        try
        {
            byte[] qBuf = new byte[Marshal.SizeOf(typeof(USN_JOURNAL_DATA_V0))];
            int br;
            if (!DeviceIoControl(handle, FSCTL_QUERY_USN_JOURNAL, IntPtr.Zero, 0, qBuf, qBuf.Length, out br, IntPtr.Zero))
            {
                error = "QUERY_USN_JOURNAL failed: " + new Win32Exception(Marshal.GetLastWin32Error()).Message;
                return results;
            }

            GCHandle qh = GCHandle.Alloc(qBuf, GCHandleType.Pinned);
            USN_JOURNAL_DATA_V0 jd;
            try { jd = (USN_JOURNAL_DATA_V0)Marshal.PtrToStructure(qh.AddrOfPinnedObject(), typeof(USN_JOURNAL_DATA_V0)); }
            finally { qh.Free(); }

            DateTime cutoff = DateTime.UtcNow.AddDays(-lookbackDays);
            long startUsn = jd.FirstUsn;
            int read = 0;
            byte[] buffer = new byte[64 * 1024];

            while (read < maxRecords)
            {
                READ_USN_JOURNAL_DATA_V0 ruj = new READ_USN_JOURNAL_DATA_V0();
                ruj.StartUsn = startUsn;
                ruj.ReasonMask = USN_REASON_FILE_CREATE | USN_REASON_FILE_DELETE | USN_REASON_RENAME_OLD_NAME | USN_REASON_CLOSE;
                ruj.ReturnOnlyOnClose = 0;
                ruj.Timeout = 0;
                ruj.BytesToWaitFor = 0;
                ruj.UsnJournalID = jd.UsnJournalID;

                int inSize = Marshal.SizeOf(typeof(READ_USN_JOURNAL_DATA_V0));
                IntPtr inPtr = Marshal.AllocHGlobal(inSize);
                try
                {
                    Marshal.StructureToPtr(ruj, inPtr, false);
                    if (!DeviceIoControl(handle, FSCTL_READ_USN_JOURNAL, inPtr, inSize, buffer, buffer.Length, out br, IntPtr.Zero))
                    {
                        int err = Marshal.GetLastWin32Error();
                        // ERROR_HANDLE_EOF = 38
                        if (err == 38) break;
                        error = "READ_USN_JOURNAL failed: " + new Win32Exception(err).Message;
                        break;
                    }
                }
                finally { Marshal.FreeHGlobal(inPtr); }

                if (br <= sizeof(long)) break;

                long nextUsn = BitConverter.ToInt64(buffer, 0);
                int offset = sizeof(long);

                while (offset + 60 < br && read < maxRecords)
                {
                    uint recordLen = BitConverter.ToUInt32(buffer, offset);
                    if (recordLen < 60 || offset + (int)recordLen > br) break;

                    ulong fileRef = BitConverter.ToUInt64(buffer, offset + 8);
                    long usn = BitConverter.ToInt64(buffer, offset + 16);
                    ulong fileTime = BitConverter.ToUInt64(buffer, offset + 24);
                    uint reason = BitConverter.ToUInt32(buffer, offset + 40);
                    ushort nameLen = BitConverter.ToUInt16(buffer, offset + 56);
                    ushort nameOffset = BitConverter.ToUInt16(buffer, offset + 58);

                    DateTime ts = DateTime.FromFileTimeUtc((long)fileTime);
                    string name = "";
                    try
                    {
                        if (nameLen > 0 && nameOffset + nameLen <= recordLen)
                            name = Encoding.Unicode.GetString(buffer, offset + nameOffset, nameLen);
                    }
                    catch { name = ""; }

                    read++;
                    bool interesting = IsHighRiskName(name);
                    if (interesting && ts >= cutoff)
                    {
                        if ((reason & USN_REASON_FILE_CREATE) != 0)
                        {
                            createSeen[fileRef] = name;
                        }
                        if ((reason & USN_REASON_FILE_DELETE) != 0 || (reason & USN_REASON_RENAME_OLD_NAME) != 0)
                        {
                            string reasonLabel = ((reason & USN_REASON_FILE_DELETE) != 0) ? "FILE_DELETE" : "RENAME_OLD_NAME";
                            bool hadCreate = createSeen.ContainsKey(fileRef);
                            deleted.Add(new UsnHit
                            {
                                FileName = name,
                                Reason = reasonLabel + (hadCreate ? "+PRIOR_CREATE" : ""),
                                Usn = usn,
                                FileRef = fileRef,
                                Timestamp = ts.ToLocalTime(),
                                ReasonCode = reason
                            });
                        }
                    }

                    offset += (int)recordLen;
                }

                if (nextUsn <= startUsn) break;
                startUsn = nextUsn;
            }

            // 생성 후 삭제 우선, 없으면 고위험 삭제만
            foreach (var d in deleted)
            {
                if (d.Reason.Contains("PRIOR_CREATE") || IsHighRiskName(d.FileName))
                    results.Add(d);
                if (results.Count >= 500) break;
            }
        }
        catch (Exception ex)
        {
            error = ex.Message;
        }
        finally
        {
            CloseHandle(handle);
        }
        return results;
    }

    private static bool IsHighRiskName(string name)
    {
        if (string.IsNullOrEmpty(name)) return false;
        string n = name.ToLowerInvariant();
        return n.EndsWith(".exe") || n.EndsWith(".dll") || n.EndsWith(".bat") ||
               n.EndsWith(".cmd") || n.EndsWith(".ps1") || n.EndsWith(".vbs") ||
               n.EndsWith(".js") || n.EndsWith(".scr") || n.EndsWith(".com") ||
               n.EndsWith(".msi") || n.EndsWith(".hta");
    }
}
'@

    try {
        if (-not ('UsnJournalReader' -as [type])) {
            Add-Type -TypeDefinition $usnType -Language CSharp -ErrorAction Stop
        }
    } catch {
        Add-Finding -Risk 'Medium' -Category 'UsnJournal' -Item 'AddTypeFailed' -Detail $_.Exception.Message
        return
    }

    $systemDrive = $env:SystemDrive
    if ([string]::IsNullOrWhiteSpace($systemDrive)) { $systemDrive = 'C:' }

    $errorMsg = ''
    try {
        $hits = [UsnJournalReader]::ReadDeletedHighRisk($systemDrive, $UsnLookbackDays, $UsnMaxRecords, [ref]$errorMsg)
        if ($errorMsg) {
            Add-Finding -Risk 'Medium' -Category 'UsnJournal' -Item 'ReadWarning' -Detail $errorMsg -Path $systemDrive
        }
        if ($null -eq $hits) { return }

        foreach ($h in $hits) {
            try {
                $risk = if ($h.Reason -match 'PRIOR_CREATE') { 'High' } else { 'Medium' }
                Add-Finding -Risk $risk -Category 'UsnJournal' -Item $h.FileName `
                    -Path $systemDrive `
                    -Detail "USN 삭제/이름변경 흔적 ($($h.Reason))" `
                    -Evidence "Time=$($h.Timestamp.ToString('s')); FileRef=$($h.FileRef); Usn=$($h.Usn); ReasonCode=0x$($h.ReasonCode.ToString('X8'))"
            } catch { continue }
        }

        if ($hits.Count -eq 0 -and -not $errorMsg) {
            Add-Finding -Risk 'Low' -Category 'UsnJournal' -Item 'NoHighRiskDeletes' `
                -Detail "조회 범위($UsnLookbackDays일, max=$UsnMaxRecords)에서 고위험 삭제 흔적 없음" -Path $systemDrive
        }
    } catch {
        Add-Finding -Risk 'Medium' -Category 'UsnJournal' -Item 'Exception' -Detail $_.Exception.Message
    }
}

# ---------------------------------------------------------------------------
# 리포트 출력 / CSV 저장 (리포트 파일만 쓰기 — 검사 대상 파일은 읽기만)
# ---------------------------------------------------------------------------
function Export-AuditReport {
    param([string]$Path)

    Write-AuditProgress "리포트 저장: $Path"
    try {
        $dir = Split-Path -Parent $Path
        if ($dir -and -not (Test-Path -LiteralPath $dir)) {
            # 디렉터리 생성은 리포트 출력을 위한 최소 쓰기 (검사 대상 변조 아님)
            New-Item -ItemType Directory -Path $dir -Force -ErrorAction Stop | Out-Null
        }

        # Export-Csv는 리포트 전용 쓰기
        $script:Findings |
            Sort-Object @{ Expression = { switch ($_.Risk) { 'High' { 0 } 'Medium' { 1 } default { 2 } } } }, Category, Item |
            Export-Csv -Path $Path -NoTypeInformation -Encoding UTF8 -ErrorAction Stop

        Write-Host "CSV 저장 완료: $Path ($($script:Findings.Count) rows)" -ForegroundColor Green
    } catch {
        Write-Host "CSV 저장 실패: $($_.Exception.Message)" -ForegroundColor Red
        Add-Finding -Risk 'Low' -Category 'Report' -Item 'CsvSaveFailed' -Detail $_.Exception.Message
    }
}

function Show-AuditSummaryTable {
    Write-Host ''
    Write-Host '========== 의심 항목 요약 (Risk 순) ==========' -ForegroundColor Yellow

    $ordered = $script:Findings |
        Where-Object { $_.Category -notin @('ScanLimit', 'ScanError') -or $_.Risk -ne 'Low' } |
        Sort-Object @{ Expression = { switch ($_.Risk) { 'High' { 0 } 'Medium' { 1 } default { 2 } } } }, Category

    if (-not $ordered -or $ordered.Count -eq 0) {
        Write-Host '표시할 항목이 없습니다.' -ForegroundColor DarkGray
    } else {
        $ordered |
            Select-Object Risk, Category, Item, Path, Detail |
            Format-Table -AutoSize -Wrap | Out-Host
    }

    $high = @($script:Findings | Where-Object Risk -eq 'High').Count
    $med  = @($script:Findings | Where-Object Risk -eq 'Medium').Count
    $low  = @($script:Findings | Where-Object Risk -eq 'Low').Count
    Write-Host ("집계: High={0}  Medium={1}  Low={2}  Total={3}" -f $high, $med, $low, $script:Findings.Count)
    Write-Host ("소요: {0:N1}초" -f ((Get-Date) - $script:ScanStart).TotalSeconds)
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
Write-Host '=== Windows System Integrity Audit (READ-ONLY) ===' -ForegroundColor Green
Write-Host '파일 삭제/수정 로직 없음. 스캔·분석·리포트만 수행합니다.' -ForegroundColor DarkGray

$script:IsAdmin = Test-IsAdministrator
if (-not $script:IsAdmin) {
    Write-Host '경고: 관리자 권한이 아닙니다. USN 저널 및 일부 시스템 경로가 제한될 수 있습니다.' -ForegroundColor Yellow
}

Add-Finding -Risk 'Low' -Category 'Meta' -Item 'AuditStart' `
    -Detail "Admin=$($script:IsAdmin); QuickScan=$QuickScan; UsnMax=$UsnMaxRecords; LookbackDays=$UsnLookbackDays" `
    -Path $env:COMPUTERNAME

try { Invoke-ExecutableIntegrityScan } catch {
    Add-Finding -Risk 'Medium' -Category 'FileIntegrity' -Item 'Fatal' -Detail $_.Exception.Message
}
try { Invoke-AutorunRegistryAudit } catch {
    Add-Finding -Risk 'Medium' -Category 'RegistryAutorun' -Item 'Fatal' -Detail $_.Exception.Message
}
try { Invoke-ScheduledTaskAudit } catch {
    Add-Finding -Risk 'Medium' -Category 'ScheduledTask' -Item 'Fatal' -Detail $_.Exception.Message
}
try { Invoke-UsnJournalAudit } catch {
    Add-Finding -Risk 'Medium' -Category 'UsnJournal' -Item 'Fatal' -Detail $_.Exception.Message
}

Show-AuditSummaryTable
Export-AuditReport -Path $ReportPath

Write-Host ''
Write-Host '감사 완료. 위 결과는 휴리스틱 기반이므로 오탐 가능 — 수동 검증을 권장합니다.' -ForegroundColor DarkGray
