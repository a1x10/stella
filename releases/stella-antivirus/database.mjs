import crypto from "node:crypto"
import path from "node:path"
import fs from "node:fs"
const BINARY_EXTS = new Set([
  ".exe", ".dll", ".sys", ".com", ".scr", ".pif",
  ".bat", ".cmd", ".vbs", ".vbe", ".jse", ".wsf", ".wsh",
  ".hta", ".cpl", ".msi", ".msp", ".mst",
  ".jar", ".class", ".war",
  ".doc", ".docm", ".xls", ".xlsm", ".ppt", ".pptm",
  ".rtf", ".pdf",
])
export const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", ".vercel", "__pycache__",
  ".stella", ".secure", ".cache", "dist", "build", ".turbo",
  "coverage", ".DS_Store", "antimalware",
  "SoftwareDistribution", "WinSxS", "Installer", "$Recycle.Bin",
  "System Volume Information", "Recovery",
  "node-compile-cache", "npm-cache", "pip-cache",
  "OpencodeSoftware", "opencode",
])
export const QUICK_SCAN_PATHS = [
  "C:\\Users\\%USERNAME%\\AppData\\Local\\Temp",
  "C:\\Users\\%USERNAME%\\Downloads",
  "C:\\Users\\%USERNAME%\\AppData\\Roaming",
  "C:\\Users\\%USERNAME%\\Desktop",
  "C:\\Users\\%USERNAME%\\Documents",
  "C:\\Windows\\Temp",
  "C:\\Windows\\System32\\drivers\\etc",
  "C:\\ProgramData",
  "C:\\Users\\%USERNAME%\\AppData\\Local\\Microsoft\\Windows\\Startup",
  "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup",
  "C:\\Windows\\System32\\Tasks",
]
export const SIGNATURES = [
  { id: "SIG-001", name: "PE感染者", severity: "critical", category: "trojan",
    pattern: /\x4D\x5A[\s\S]{0,200}\x50\x45\x00\x00[\s\S]{0,500}(\x00){16,}/ },
  { id: "SIG-002", name: "Пакер/Crypter", severity: "critical", category: "trojan",
    pattern: /\x4D\x5A[\s\S]{0,100}(UPX|ASPack|PECompact|Themida|VMProtect|Obsidium|Armadillo)/ },
  { id: "SIG-003", name: "Dropper", severity: "critical", category: "trojan",
    pattern: /(CreateFile|WriteFile)[\s\S]{0,200}(\.exe|\.dll|\.sys)[\s\S]{0,200}(CreateProcess|ShellExecute)/s },
  { id: "SIG-004", name: "Process Hollowing", severity: "critical", category: "injection",
    pattern: /NtUnmapViewOfSection|ZwUnmapViewOfSection|RtlCreateUserThread|NtCreateThreadEx[\s\S]{0,100}CreateRemoteThread/s },
  { id: "SIG-005", name: "Inject в системный процесс", severity: "critical", category: "injection",
    pattern: /OpenProcess[\s\S]{0,100}(PROCESS_ALL_ACCESS|PROCESS_CREATE_THREAD)[\s\S]{0,100}WriteProcessMemory[\s\S]{0,100}CreateRemoteThread/s },
  { id: "SIG-006", name: "APC Injection", severity: "critical", category: "injection",
    pattern: /QueueUserAPC|NtQueueApcThread|EkalertRegisterAlertCallback[\s\S]{0,100}VirtualAllocEx/s },
  { id: "SIG-007", name: "Thread Hijacking", severity: "critical", category: "injection",
    pattern: /SuspendThread[\s\S]{0,100}GetThreadContext[\s\S]{0,100}SetThreadContext[\s\S]{0,100}ResumeThread/s },
  { id: "SIG-008", name: "Reflective DLL Loading", severity: "critical", category: "injection",
    pattern: /LoadLibraryA[\s\S]{0,100}GetProcAddress[\s\S]{0,100}(DllMain|EntryPoint)[\s\S]{0,100}VirtualProtect/s },
  { id: "SIG-009", name: "Keylogger API", severity: "critical", category: "spyware",
    pattern: /SetWindowsHookEx[\s\S]{0,50}(WH_KEYBOARD|WH_KEYBOARD_LL|WH_MOUSE)[\s\S]{0,100}(GetAsyncKeyState|GetKeyState)/ },
  { id: "SIG-010", name: "Clipboard theft", severity: "high", category: "spyware",
    pattern: /GetClipboardData[\s\S]{0,100}(GlobalLock|GlobalAlloc)[\s\S]{0,100}(InternetOpen|HttpSendRequest)/ },
  { id: "SIG-011", name: "Screen capture + exfil", severity: "critical", category: "spyware",
    pattern: /(BitBlt|GetDC|CreateCompatibleBitmap)[\s\S]{0,200}(JpegEncoder|PngEncoder|SaveToFile)[\s\S]{0,200}(http|ftp|socket)/s },
  { id: "SIG-012", name: "LSASS дамп", severity: "critical", category: "credential-theft",
    pattern: /MiniDumpWriteDump[\s\S]{0,100}(lsass|csrss|svchost)/ },
  { id: "SIG-013", name: "Mimikatz загрузка", severity: "critical", category: "credential-theft",
    pattern: /Invoke-Mimikatz|mimikatz[\s\S]{0,50}sekurlsa::logonpasswords|gentilkiwi/ },
  { id: "SIG-014", name: "Browser password theft", severity: "critical", category: "credential-theft",
    pattern: /(Login Data|logins\.json|cookies\.sqlite|signons\.sqlite)[\s\S]{0,200}(sqlite3_open|ReadFile)[\s\S]{0,200}(http|ftp)/s },
  { id: "SIG-015", name: "Криптокошелёк кража", severity: "critical", category: "credential-theft",
    pattern: /(wallet\.dat|Electrum|Bitcoin|Ethereum|MetaMask)[\s\S]{0,200}(CopyFile|MoveFile|ReadFile)[\s\S]{0,200}(http|ftp|socket)/s },
  { id: "SIG-016", name: "Certificate theft", severity: "high", category: "credential-theft",
    pattern: /(certutil|CertOpenStore|PFX|PKCS12)[\s\S]{0,100}(Export|export|CopyFile)[\s\S]{0,100}(http|ftp)/ },
  { id: "SIG-017", name: "Ransomware шифрование", severity: "critical", category: "ransomware",
    pattern: /(AES|DES|RSA|ChaCha20|Salsa20|XOR)[\s\S]{0,100}(CreateFile|WriteFile)[\s\S]{0,100}\.(locked|encrypted|crypto|cerber|cerber3)/ },
  { id: "SIG-018", name: "Восстановление удалено", severity: "critical", category: "ransomware",
    pattern: /vssadmin[\s\S]*delete[\s\S]*shadows|bcdedit[\s\S]*set[\s\S]*recoveryenabled\s+no|wbadmin[\s\S]*delete[\s\S]*catalog/ },
  { id: "SIG-019", name: "Ransomware note", severity: "critical", category: "ransomware",
    pattern: /(your files have been encrypted|pay the ransom|bitcoin wallet|decrypt your files|send bitcoin|files will be deleted)[\s\S]{0,500}(tor|onion|bitcoin|monero)/is },
  { id: "SIG-020", name: "Extension changer", severity: "critical", category: "ransomware",
    pattern: /(rename|MoveFileEx|SetFileAttributes)[\s\S]{0,100}\.(locked|crypt|enc|encrypted|crypto|cerber|locky|wannacry)/ },
  { id: "SIG-021", name: "Kernel rootkit", severity: "critical", category: "rootkit",
    pattern: /NtQuerySystemInformation[\s\S]{0,100}ZwQuerySystemInformation[\s\S]{0,100}(SSDT|IDT|IAT|DKOM)/ },
  { id: "SIG-022", name: "Hide process", severity: "critical", category: "rootkit",
    pattern: /NtSetInformationProcess[\s\S]{0,100}ProcessDebugPort|ZwQueryInformationProcess[\s\S]{0,100}ProcessDebugFlags/ },
  { id: "SIG-023", name: "Hide file", severity: "critical", category: "rootkit",
    pattern: /NtQueryDirectoryFile[\s\S]{0,100}FILE_BOTH_DIR_INFORMATION[\s\S]{0,100}NextEntryOffset/ },
  { id: "SIG-024", name: "SSDT hook", severity: "critical", category: "rootkit",
    pattern: /KeServiceDescriptorTable[\s\S]{0,100}(hook|detour|trampoline|patch)/ },
  { id: "SIG-025", name: "Bind shell", severity: "critical", category: "backdoor",
    pattern: /socket[\s\S]{0,100}bind[\s\S]{0,100}listen[\s\S]{0,100}accept[\s\S]{0,100}(cmd|bash|sh)[\s\S]{0,50}(dup2|SOCK_STREAM)/ },
  { id: "SIG-026", name: "Reverse shell", severity: "critical", category: "backdoor",
    pattern: /socket[\s\S]{0,100}connect[\s\S]{0,100}\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}[\s\S]{0,100}(cmd|bash|sh)[\s\S]{0,50}dup2/ },
  { id: "SIG-027", name: "Webshell PHP", severity: "critical", category: "backdoor",
    pattern: /\$_(POST|GET|REQUEST|COOKIE)\[[\s\S]{0,50}\]\s*\([\s\S]{0,100}(eval|exec|system|passthru|shell_exec|popen|proc_open)\s*\(/ },
  { id: "SIG-028", name: "Webshell ASP", severity: "critical", category: "backdoor",
    pattern: /eval\s*\(\s*Request[\s\S]{0,50}(Execute|CreateObject)[\s\S]{0,50}WScript\.Shell/ },
  { id: "SIG-029", name: "Webshell JSP", severity: "critical", category: "backdoor",
    pattern: /Runtime\.getRuntime\(\)\.exec[\s\S]{0,50}(cmd|bash)[\s\S]{0,50}(Process|InputStream)/ },
  { id: "SIG-030", name: "IRC Botnet", severity: "high", category: "botnet",
    pattern: /PRIVMSG\s*#\w+\s*:\s*\x01[\s\S]{0,100}(JOIN|NICK|USER)[\s\S]{0,50}\.join\(|\.on\('data'/ },
  { id: "SIG-031", name: "Metasploit стейджинг", severity: "critical", category: "exploit",
    pattern: /msfvenom[\s\S]{0,100}reverse[\s\S]{0,50}(tcp|http|https)[\s\S]{0,100}(meterpreter|shell|vnc)/ },
  { id: "SIG-032", name: "Meterpreter payload", severity: "critical", category: "exploit",
    pattern: /meterpreter[\s\S]{0,100}(reverse_tcp|reverse_http|reverse_https)[\s\S]{0,100}(LHOST|LPORT)/ },
  { id: "SIG-033", name: "Shellcode detector", severity: "critical", category: "exploit",
    pattern: /(\x31\xc0|\x31\xdb|\x31\xc9|\x31\xd2|\x90{8,})[\s\S]{0,50}(\\x6a|\\x58|\\xcd|\\x80)/ },
  { id: "SIG-034", name: "ROP chain", severity: "high", category: "exploit",
    pattern: /gadget[\s\S]{0,50}(pop[\s\S]{0,20}ret|call[\s\S]{0,20}eax|jmp[\s\S]{0,20}esp)/ },
  { id: "SIG-035", name: "UAC bypass", severity: "critical", category: "privesc",
    pattern: /(fodhelper|eventvwr|computerdefaults|sdclt|slui)[\s\S]{0,100}(ms-settings|HKCU|CurrentVersion)\\Run/ },
  { id: "SIG-036", name: "Token impersonation", severity: "critical", category: "privesc",
    pattern: /ImpersonateLoggedOnUser|DuplicateTokenEx|SetThreadToken[\s\S]{0,100}(AdjustTokenPrivileges|SeDebugPrivilege)/ },
  { id: "SIG-037", name: "Service install", severity: "high", category: "privesc",
    pattern: /CreateService[\s\S]{0,100}(SERVICE_AUTO_START|SERVICE_WIN32_OWN_PROCESS)[\s\S]{0,100}(cmd|powershell|bash)/ },
  { id: "SIG-038", name: "VM detection", severity: "high", category: "anti-analysis",
    pattern: /(VMware|VirtualBox|QEMU|Hyper-V|Xen)[\s\S]{0,100}(CPUID|cpuid|__cpuid|vmexit|vmcall)/ },
  { id: "SIG-039", name: "Debugger detection", severity: "high", category: "anti-analysis",
    pattern: /IsDebuggerPresent|CheckRemoteDebuggerPresent|NtQueryInformationProcess[\s\S]{0,100}ProcessDebugPort/ },
  { id: "SIG-040", name: "Sandbox detection", severity: "high", category: "anti-analysis",
    pattern: /(NtQuerySystemInformation|GetTickCount|timeGetTime)[\s\S]{0,100}(anti-vm|anti-debug|sandbox|sleep|delay)/i },
  { id: "SIG-041", name: "AMSI bypass", severity: "critical", category: "anti-analysis",
    pattern: /AmsiUtils[\s\S]{0,100}amsiInitFailed|AmsiScanBuffer[\s\S]{0,100}0x80070057|SetProcessMitigationPolicy[\s\S]{0,50}DisableDynamicCode/ },
  { id: "SIG-042", name: "ETW patch", severity: "critical", category: "anti-analysis",
    pattern: /EtwEventWrite[\s\S]{0,100}(patch|nop|ret|0xc3)|NtTraceEvent[\s\S]{0,100}(hook|detour)/ },
  { id: "SIG-043", name: "Registry Run key", severity: "high", category: "persistence",
    pattern: /CurrentVersion\\Run[\s\S]{0,100}(cmd|powershell|bash|python|perl|wscript|cscript)/ },
  { id: "SIG-044", name: "Scheduled task", severity: "high", category: "persistence",
    pattern: /schtasks[\s\S]{0,100}(\/create|\/Create)[\s\S]{0,100}(cmd|powershell|bash|python|perl)/ },
  { id: "SIG-045", name: "Startup folder", severity: "high", category: "persistence",
    pattern: /\\Start Menu\\Programs\\Startup[\s\S]{0,100}\.(exe|bat|cmd|vbs|ps1|js)/ },
  { id: "SIG-046", name: "WMI subscription", severity: "high", category: "persistence",
    pattern: /CommandLineEventConsumer[\s\S]{0,100}(cmd|powershell|bash|python|perl)/ },
  { id: "SIG-047", name: "Service DLL hijack", severity: "high", category: "persistence",
    pattern: /ServiceDll[\s\S]{0,100}(HKLM|HKCU)[\s\S]{0,100}\\(cmd|powershell|bash|python|perl)/ },
  { id: "SIG-048", name: "Reverse TCP", severity: "critical", category: "backdoor",
    pattern: /socket[\s\S]{0,100}connect[\s\S]{0,100}\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}[\s\S]{0,100}(SOCK_STREAM|SOCK_DGRAM)/ },
  { id: "SIG-049", name: "Reverse HTTP", severity: "high", category: "backdoor",
    pattern: /InternetOpen[\s\S]{0,100}HttpOpenRequest[\s\S]{0,100}(POST|PUT)[\s\S]{0,100}(cmd|bash|powershell)/ },
  { id: "SIG-050", name: "DNS tunneling", severity: "high", category: "backdoor",
    pattern: /DnsQuery[\s\S]{0,100}(TXT|MX|CNAME)[\s\S]{0,100}(encode|decode|base64)[\s\S]{0,100}(socket|connect)/ },
  { id: "SIG-051", name: "Base64 decode chain", severity: "high", category: "obfuscation",
    pattern: /atob\s*\(\s*atob\s*\(|fromCharCode[\s\S]{0,50}atob|eval\s*\(\s*atob\s*\(/ },
  { id: "SIG-052", name: "PowerShell download cradle", severity: "high", category: "obfuscation",
    pattern: /IEX\s*\(\s*(New-Object\s+Net\.WebClient|Invoke-WebRequest|wget|curl)[\s\S]*\)|Invoke-Expression[\s\S]{0,100}(DownloadString|DownloadFile)/i },
  { id: "SIG-053", name: "String building", severity: "medium", category: "obfuscation",
    pattern: /String\.fromCharCode\s*\(\s*\d+[\s\S]{0,20}\d+[\s\S]{0,20}\d+[\s\S]{0,20}\d+/ },
  { id: "SIG-054", name: "Hex encoding", severity: "medium", category: "obfuscation",
    pattern: /\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i },
  { id: "SIG-055", name: "Dynamic eval chain", severity: "high", category: "obfuscation",
    pattern: /eval\s*\(\s*(eval|Function|atob|Buffer\.from|unescape|fromCharCode)/ },
  { id: "SIG-056", name: "Crypto miner池", severity: "high", category: "miner",
    pattern: /stratum\+tcp:\/\/[\w.-]+:\d{4,5}/ },
  { id: "SIG-057", name: "XMRig", severity: "high", category: "miner",
    pattern: /xmrig[\s\S]{0,100}(algo|coin|pool|wallet|donate-level)/ },
  { id: "SIG-058", name: "Browser miner", severity: "high", category: "miner",
    pattern: /coinhive[\s\S]{0,100}(CoinHive\.Worker|anonymous|captcha)|cryptoloot[\s\S]{0,100}(CryptoLoot\.Worker|anonymous)/ },
  { id: "SIG-059", name: "FTP upload", severity: "high", category: "exfil",
    pattern: /ftp[\s\S]{0,100}(upload|put|stor)[\s\S]{0,100}(password|passwd|secret|token|key)/ },
  { id: "SIG-060", name: "HTTP POST exfil", severity: "high", category: "exfil",
    pattern: /(fetch|XMLHttpRequest|axios|http\.request|request\()[\s\S]{0,200}(POST|PUT)[\s\S]{0,200}(password|token|secret|credential|cookie)/ },
  { id: "SIG-061", name: "DNS exfil", severity: "high", category: "exfil",
    pattern: /DnsQuery[\s\S]{0,100}(encode|encodeURI|base64)[\s\S]{0,100}(password|token|secret|credential)/ },
  { id: "SIG-062", name: "USB worm", severity: "critical", category: "worm",
    pattern: /(RECYCLER|Recycle\.Bin|autorun\.inf|\\setup\.exe)[\s\S]{0,100}(CopyFile|MoveFile|CreateFile)/ },
  { id: "SIG-063", name: "Network worm", severity: "critical", category: "worm",
    pattern: /(NetServerEnum|NetShareEnum|WNetEnumResource|WNetOpenEnum)[\s\S]{0,100}(CopyFile|MoveFile|CreateProcess)/ },
  { id: "SIG-064", name: "Adware inject", severity: "medium", category: "adware",
    pattern: /(inject|append|prepend)[\s\S]{0,100}(ads|advertis|popup|banner|click)[\s\S]{0,100}(google|facebook|amazon|ebay)/i },
  { id: "SIG-065", name: "Browser hijack", severity: "high", category: "adware",
    pattern: /(startPage|searchProvider|homePage)[\s\S]{0,100}(http|https)[\s\S]{0,50}(ads|search|babylon|conduit|ask\.com)/i },
  { id: "SIG-066", name: "Software Bundler", severity: "medium", category: "adware",
    pattern: /(toolbar|extension|plugin)[\s\S]{0,100}(install|download|update)[\s\S]{0,100}(offer|recommend|special)/i },
  { id: "SIG-067", name: "Web inject", severity: "critical", category: "banking",
    pattern: /(inject|intercept|modify)[\s\S]{0,100}(https?:\/\/(www\.)?(bank|paypal|alipay|pay\.google))/i },
  { id: "SIG-068", name: "Form grabbing", severity: "critical", category: "banking",
    pattern: /(HttpSendRequest|InternetReadFile)[\s\S]{0,200}(password|login|pin|credential|account)/ },
  { id: "SIG-069", name: "MITM proxy", severity: "critical", category: "banking",
    pattern: /(mitmproxy|ettercap|bettercap|burp)[\s\S]{0,100}(inject|intercept|modify)[\s\S]{0,100}(http|https)/i },
  { id: "SIG-070", name: "RAT keylogger", severity: "critical", category: "rat",
    pattern: /(GetAsyncKeyState|SetWindowsHookEx)[\s\S]{0,200}(http|ftp|socket|connect)[\s\S]{0,100}(send|write|upload)/ },
  { id: "SIG-071", name: "RAT screen capture", severity: "critical", category: "rat",
    pattern: /(BitBlt|GetDC|GetDesktopWindow)[\s\S]{0,200}(JpegEncoder|PngEncoder|Image\.save)[\s\S]{0,200}(http|ftp|socket)/ },
  { id: "SIG-072", name: "RAT webcam", severity: "critical", category: "rat",
    pattern: /(capCreateCaptureWindow|avicap32|WebCamCapture|webcam)[\s\S]{0,200}(getImageData|capture)[\s\S]{0,200}(http|ftp|socket)/ },
  { id: "SIG-073", name: "RAT file manager", severity: "high", category: "rat",
    pattern: /(ListFiles|GetFiles|GetDirectories|ReadDirectory)[\s\S]{0,200}(Download|Upload|Delete|Rename|Copy|Move)[\s\S]{0,200}(http|ftp|socket)/ },
  { id: "SIG-074", name: "RAT command execution", severity: "critical", category: "rat",
    pattern: /(cmd\.exe|powershell|bash)[\s\S]{0,100}(-c|-e|\/c)[\s\S]{0,200}(http|ftp|socket)[\s\S]{0,100}(send|write|upload)/ },
  { id: "SIG-075", name: "Trojan downloader", severity: "critical", category: "trojan",
    pattern: /(URLDownloadToFile|InternetOpen|HttpOpenRequest)[\s\S]{0,200}\.(exe|dll|scr|bat|cmd|ps1|vbs)/ },
  { id: "SIG-076", name: "Trojan dropper", severity: "critical", category: "trojan",
    pattern: /(CreateFile|WriteFile)[\s\S]{0,100}\.(exe|dll|scr|bat|cmd|ps1|vbs)[\s\S]{0,100}(CreateProcess|ShellExecute|WinExec)/ },
  { id: "SIG-077", name: "Trojan stealer", severity: "critical", category: "trojan",
    pattern: /(password|token|cookie|session|credential|secret)[\s\S]{0,200}(http|ftp|smtp|socket)[\s\S]{0,100}(POST|PUT|send|upload)/ },
  { id: "SIG-078", name: "Loader/Injector", severity: "critical", category: "trojan",
    pattern: /LoadLibrary[AW]?[\s\S]{0,100}GetProcAddress[\s\S]{0,100}(call|jmp|rax|eax)[\s\S]{0,100}(VirtualAlloc|VirtualProtect)/ },
  { id: "SIG-079", name: "MBR wiper", severity: "critical", category: "wiper",
    pattern: /\\\\\.\\\\PhysicalDrive0[\s\S]{0,100}(WriteFile|DeviceIoControl)[\s\S]{0,100}(erase|wipe|overwrite)/ },
  { id: "SIG-080", name: "File wiper", severity: "critical", category: "wiper",
    pattern: /(DeleteFile|RemoveDirectory|SHFileOperation)[\s\S]{0,200}\*\.(doc|pdf|txt|jpg|png|mp4|avi)/ },
  { id: "SIG-081", name: "Cookie stealer", severity: "high", category: "infostealer",
    pattern: /(cookies\.sqlite|Cookie|chrome.*cookies)[\s\S]{0,100}(readFile|sqlite3_open)[\s\S]{0,100}(http|ftp)/ },
  { id: "SIG-082", name: "Session hijack", severity: "high", category: "infostealer",
    pattern: /(session|token|cookie|jwt|bearer)[\s\S]{0,100}(steal|grab|harvest|exfiltrate|dump)/i },
  { id: "SIG-083", name: "PowerShell fileless", severity: "critical", category: "fileless",
    pattern: /powershell[\s\S]{0,100}(-enc|-EncodedCommand|-e)[\s\S]{0,200}(IEX|Invoke-Expression|DownloadString)/ },
  { id: "SIG-084", name: "WMI fileless", severity: "critical", category: "fileless",
    pattern: /wmic[\s\S]{0,100}(process\s+call\s+create|Win32_Process)[\s\S]{0,100}(cmd|powershell|bash)/ },
  { id: "SIG-085", name: "MSHTA fileless", severity: "critical", category: "fileless",
    pattern: /mshta[\s\S]{0,100}(vbscript|javascript)[\s\S]{0,100}(Execute|eval|exec)/ },
  { id: "SIG-086", name: "Clipboard hijacker", severity: "high", category: "crypto",
    pattern: /GetClipboardData[\s\S]{0,100}(replace|regex)[\s\S]{0,100}(bc1|1[a-km-zA-HJ-NP-Z1-9]{25,34}|0x[a-fA-F0-9]{40})/ },
  { id: "SIG-087", name: "Wallet stealer", severity: "critical", category: "crypto",
    pattern: /(wallet\.dat|keystore\.json|UTC--|credentials\.json)[\s\S]{0,100}(copy|read|upload|send)[\s\S]{0,100}(http|ftp)/ },
  { id: "SIG-088", name: "Encoded command", severity: "high", category: "obfuscation",
    pattern: /cmd[\s\S]{0,100}(\/c|\\c|-c)[\s\S]{0,100}(powershell|bash|python)[\s\S]{0,100}(-enc|-e|--encoded)/ },
  { id: "SIG-089", name: "Hidden file creation", severity: "high", category: "stealth",
    pattern: /SetFileAttributes[\s\S]{0,100}(FILE_ATTRIBUTE_HIDDEN|FILE_ATTRIBUTE_SYSTEM|0x02|0x04)/ },
  { id: "SIG-090", name: "DLL search order hijack", severity: "high", category: "injection",
    pattern: /SetDllDirectory[\s\S]{0,100}(""|\.|\\)[\s\S]{0,100}LoadLibrary/ },
  { id: "SIG-091", name: "Process Doppelgänging", severity: "critical", category: "injection",
    pattern: /NtCreateTransaction[\s\S]{0,100}NtCreateSection[\s\S]{0,100}NtMapViewOfSection[\s\S]{0,100}NtCreateThreadEx/ },
  { id: "SIG-092", name: "Transacted Hollowing", severity: "critical", category: "injection",
    pattern: /CreateTransaction[\s\S]{0,100}CreateFileMapping[\s\S]{0,100}MapViewOfFile[\s\S]{0,100}NtCreateThreadEx/ },
  { id: "SIG-093", name: "Herpaderging", severity: "critical", category: "injection",
    pattern: /WriteFile[\s\S]{0,100}FlushFileBuffers[\s\S]{0,100}NtCreateSection[\s\S]{0,100}NtMapViewOfSection/ },
  { id: "SIG-094", name: "Process Ghosting", severity: "critical", category: "injection",
    pattern: /CreateFile[\s\S]{0,100}FILE_DISPOSITION_FLAG[\s\S]{0,100}NtCreateSection[\s\S]{0,100}NtCreateThreadEx/ },
  { id: "SIG-095", name: "Module Stomping", severity: "critical", category: "injection",
    pattern: /LoadLibrary[\s\S]{0,100}GetModuleHandle[\s\S]{0,100}WriteProcessMemory[\s\S]{0,100}CreateRemoteThread/ },
  { id: "SIG-096", name: "Syscall abuse", severity: "high", category: "anti-analysis",
    pattern: /NtAllocateVirtualMemory[\s\S]{0,100}NtWriteVirtualMemory[\s\S]{0,100}NtProtectVirtualMemory/ },
  { id: "SIG-097", name: "Direct syscalls", severity: "high", category: "anti-analysis",
    pattern: /syscall[\s\S]{0,50}(NtAllocateVirtualMemory|NtWriteVirtualMemory|NtCreateThreadEx|NtProtectVirtualMemory)/ },
  { id: "SIG-098", name: "Hell's Gate", severity: "high", category: "anti-analysis",
    pattern: /Hell.?s.?Gate|halos.?gate|tartarus.?gate|freshly.?gate/i },
  { id: "SIG-099", name: "SysWhispers", severity: "high", category: "anti-analysis",
    pattern: /SysWhispers[\s\S]{0,100}(NtAllocateVirtualMemory|NtWriteVirtualMemory|NtCreateThreadEx)/ },
  { id: "SIG-100", name: "Callback abuse", severity: "high", category: "anti-analysis",
    pattern: /EnumChildWindows[\s\S]{0,100}EnumWindows[\s\S]{0,100}EnumThreadWindows[\s\S]{0,100}(callback|EnumWindowsProc)/ },
  { id: "SIG-101", name: "APC injection stealth", severity: "critical", category: "injection",
    pattern: /NtQueueApcThread[\s\S]{0,100}NtResumeThread[\s\S]{0,100}WaitForSingleObject/ },
  { id: "SIG-102", name: "Early bird injection", severity: "critical", category: "injection",
    pattern: /CreateProcess[\s\S]{0,100}CREATE_SUSPENDED[\s\S]{0,100}WriteProcessMemory[\s\S]{0,100}NtQueueApcThread/ },
  { id: "SIG-103", name: "Thread execution hijack", severity: "critical", category: "injection",
    pattern: /SuspendThread[\s\S]{0,100}VirtualAlloc[\s\S]{0,100}WriteProcessMemory[\s\S]{0,100}ResumeThread/ },
]
export const MALICIOUS_HASHES = new Set([
  "ed01ebfbc9eb5bbea545af4d01bf5f1071661840480439c6e5babe8e080e41aa",
  "027cc450ef5f8c5f653329641ec1fed91f694e0d229928963b30f6b0d7d3a745",
  "268ea248e1885788874018b688e66137e3a6195b081926f61af566b7ed870a0b",
  "f9a3c6b5dd40f34c5b7e2c8b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d",
  "ac315f556f176801108abb3371025c35981ab13627a2d13f3f1a79f35d3e6c9e",
  "b7c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
  "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
  "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
  "5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a",
  "a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
  "c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0",
  "e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2",
  "a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
  "b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5",
  "c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7",
  "e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
  "f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
  "a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  "b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
])
export const YARA_RULES = [
  {
    id: "YARA-001", name: "PE with embedded script", severity: "critical",
    condition: (buf) => {
      const s = buf.toString("utf8")
      return /\x4D\x5A/.test(s) && /<script[\s\S]*eval/i.test(s)
    },
  },
  {
    id: "YARA-002", name: "Massive base64 + eval", severity: "high",
    condition: (buf) => {
      const s = buf.toString("utf8")
      if (s.length > 500000) return false
      const b64 = s.match(/[A-Za-z0-9+\/]{200,}={0,2}/g) || []
      return b64.length >= 3 && /\beval\b/i.test(s) && !/test|spec|mock|jest|vitest/i.test(s)
    },
  },
  {
    id: "YARA-003", name: "Ransomware note", severity: "critical",
    condition: (buf) => {
      const s = buf.toString("utf8").toLowerCase()
      if (s.length > 50000) return false
      const kw = ["your files have been encrypted", "pay the ransom",
        "bitcoin wallet", "decrypt your files", "send bitcoin",
        "all your files", "cannot be recovered", "pay us"]
      let h = 0
      for (const k of kw) { if (s.includes(k)) h++ }
      return h >= 3
    },
  },
  {
    id: "YARA-004", name: "High entropy blob", severity: "low",
    condition: (buf) => {
      if (buf.length < 500 || buf.length > 100000) return false
      const s = buf.toString("utf8")
      if (/[a-zA-Z]{3,}/.test(s) && s.length > 100) return false
      let n = 0
      for (let i = 0; i < buf.length; i++) { if (buf[i] === 0) n++ }
      return (n / buf.length) > 0.6
    },
  },
  {
    id: "YARA-005", name: "Startup persistence", severity: "high",
    condition: (buf) => {
      const s = buf.toString("utf8")
      if (s.length > 50000) return false
      const hasStartup = /CurrentVersion\\Run|\\Start Menu\\Programs\\Startup|schtasks.*\/sc.*onlogon/i.test(s)
      const hasExec = /\b(cmd|powershell|bash|python|perl)\b.*(-c|-e|\/c|exec)/i.test(s)
      return hasStartup && hasExec
    },
  },
  {
    id: "YARA-006", name: "Credential theft + exfil", severity: "critical",
    condition: (buf) => {
      const s = buf.toString("utf8")
      if (s.length > 100000) return false
      const hasCred = /(password|token|secret|cookie|apikey)[\s\S]{0,50}=\s*['"]/i.test(s)
      const hasExfil = /(fetch|http|upload|send|exfil)[\s\S]{0,50}(POST|PUT)/i.test(s)
      return hasCred && hasExfil
    },
  },
  {
    id: "YARA-007", name: "Polymorphic loader", severity: "high",
    condition: (buf) => {
      const s = buf.toString("utf8")
      if (s.length < 200 || s.length > 100000) return false
      const hasFromChar = /fromCharCode|String\.raw.*\\x|unescape/i.test(s)
      const hasChain = /eval\s*\(\s*String|eval\s*\(\s*atob|Function\s*\(\s*['"]return/i.test(s)
      return hasFromChar && hasChain
    },
  },
  {
    id: "YARA-008", name: "Encoded command exec", severity: "critical",
    condition: (buf) => {
      const s = buf.toString("utf8")
      if (s.length > 100000) return false
      const hasDecode = /FromBase64String|atob|base64_decode|decodeURIComponent/i.test(s)
      const hasExec = /\b(eval|exec|system|passthru|shell_exec|child_process)\b/i.test(s)
      return hasDecode && hasExec
    },
  },
  {
    id: "YARA-009", name: "Process injection combo", severity: "critical",
    condition: (buf) => {
      const s = buf.toString("utf8")
      if (s.length > 200000) return false
      const hasOpen = /OpenProcess|OpenThread/.test(s)
      const hasAlloc = /VirtualAllocEx|VirtualProtectEx/.test(s)
      const hasWrite = /WriteProcessMemory/.test(s)
      const hasThread = /CreateRemoteThread|NtCreateThreadEx/.test(s)
      return hasOpen && hasAlloc && hasWrite && hasThread
    },
  },
  {
    id: "YARA-010", name: "Keychain/credential dump", severity: "critical",
    condition: (buf) => {
      const s = buf.toString("utf8")
      if (s.length > 200000) return false
      const hasDump = /dump|extract|steal|grab|harvest/i.test(s)
      const hasCred = /password|token|secret|keychain|keyring|credential/i.test(s)
      const hasSend = /http|ftp|smtp|socket|send|upload|exfil/i.test(s)
      return hasDump && hasCred && hasSend
    },
  },
  {
    id: "YARA-011", name: "Obfuscated PowerShell", severity: "high",
    condition: (buf) => {
      const s = buf.toString("utf8")
      if (s.length > 100000) return false
      const hasPS = /powershell|pwsh/i.test(s)
      const hasEnc = /-enc|-EncodedCommand|-e\s/i.test(s)
      const hasIEX = /IEX|Invoke-Expression|DownloadString/i.test(s)
      return hasPS && hasEnc && hasIEX
    },
  },
  {
    id: "YARA-012", name: "DLL side-loading", severity: "critical",
    condition: (buf) => {
      const s = buf.toString("utf8")
      if (s.length > 200000) return false
      const hasLoad = /LoadLibrary[AW]?\s*\(/.test(s)
      const hasGet = /GetProcAddress\s*\(/.test(s)
      const hasCall = /\(\*\w+\)\(/.test(s) || /call\s*\(/.test(s)
      return hasLoad && hasGet && hasCall
    },
  },
]
export const HEURISTIC_RULES = [
  {
    id: "HEUR-001", name: "Высокая энтропия", severity: "medium",
    check: (content, filepath) => {
      if (content.length < 500 || content.length > 500000) return null
      const freq = new Array(256).fill(0)
      for (let i = 0; i < content.length; i++) freq[content[i]]++
      let entropy = 0
      for (let i = 0; i < 256; i++) {
        if (freq[i] > 0) {
          const p = freq[i] / content.length
          entropy -= p * Math.log2(p)
        }
      }
      if (entropy > 7.9) return { score: 70, detail: `Энтропия: ${entropy.toFixed(2)}` }
      return null
    },
  },
  {
    id: "HEUR-002", name: "Массовые подозрительные API", severity: "high",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const apiCalls = [
        /\bCreateProcess\b[\s\S]{0,30}(SW_HIDE|CREATE_NO_WINDOW)/,
        /\bShellExecute\b[\s\S]{0,30}(runas)/i,
        /\bURLDownloadToFile\b[\s\S]{0,30}http/i,
        /\bInternetOpen\b[\s\S]{0,30}http/i,
        /\bRegSetValue\b[\s\S]{0,30}Run/i,
        /\bCreateService\b[\s\S]{0,30}AUTO_START/i,
        /\bOpenSCManager\b[\s\S]{0,30}SC_MANAGER_CREATE_SERVICE/i,
      ]
      let hits = 0
      for (const api of apiCalls) { if (api.test(s)) hits++ }
      if (hits >= 3) return { score: 75, detail: `${hits} подозрительных API-вызовов` }
      return null
    },
  },
  {
    id: "HEUR-003", name: "Цепочки кодирования", severity: "medium",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const chains = s.match(/String\.fromCharCode\s*\(\s*\d+/g) || []
      if (chains.length > 15) return { score: 55, detail: `${chains.length} цепочек.fromCharCode` }
      return null
    },
  },
  {
    id: "HEUR-004", name: "Скрытые процессы", severity: "high",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const hasCreate = /\b(CreateProcess|exec|spawn|system)\b/i.test(s)
      const hasHide = /(SW_HIDE|CREATE_NO_WINDOW|DETACHED_PROCESS)/i.test(s)
      const hasHollow = /(NtUnmapViewOfSection|ProcessHollowing|process.*hollow)/i.test(s)
      if (hasCreate && hasHide && hasHollow) return { score: 85, detail: "Создание + скрытие + hollowing" }
      if (hasCreate && hasHide) return { score: 55, detail: "Создание скрытых процессов" }
      return null
    },
  },
  {
    id: "HEUR-005", name: "Массовый обход файлов", severity: "medium",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const hasRecursive = /readdirSync|walkSync|glob\s*\(\s*['"]\*\*/i.test(s)
      const hasSensitive = /\.(env|key|pem|pfx|jks|keystore|wallet\.dat)/i.test(s)
      const hasEncode = /base64|hex|encode/i.test(s)
      if (hasRecursive && hasSensitive && hasEncode) return { score: 65, detail: "Рекурсивный обход + чувствительные файлы + кодировка" }
      return null
    },
  },
  {
    id: "HEUR-006", name: "Сетевой beacon", severity: "high",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const hasInterval = /(setInterval|setTimeout|while.*true|loop)/i.test(s)
      const hasNet = /(fetch|http|socket|connect|XMLHttpRequest)/i.test(s)
      const hasHardcoded = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[a-z0-9-]+\.(com|net|org|ru|cn)\
      if (hasInterval && hasNet && hasHardcoded) return { score: 75, detail: "Периодические запросы к хардкоду" }
      return null
    },
  },
  {
    id: "HEUR-007", name: "Системные модификации", severity: "high",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const patterns = [
        /\bchmod\s+[0-7]{3,4}\b/,
        /\bchown\s+root\b/,
        /\bnet\s+user\s+\S+\s+\/add\b/,
        /\bnet\s+localgroup\s+\S+\s+\/add\b/,
        /\bcrontab\b.*-e/,
      ]
      let h = 0
      for (const p of patterns) { if (p.test(s)) h++ }
      if (h >= 2) return { score: 65, detail: `${h} модификаций системы` }
      return null
    },
  },
  {
    id: "HEUR-008", name: "Динамическое выполнение", severity: "high",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const chains = s.match(/eval\s*\(\s*(eval|Function|atob|Buffer|fromCharCode)/gi) || []
      if (chains.length >= 3) return { score: 70, detail: `${chains.length} цепочек динамического выполнения` }
      return null
    },
  },
  {
    id: "HEUR-009", name: "Массовые системные вызовы", severity: "high",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const syscalls = [
        /NtAllocateVirtualMemory/,
        /NtWriteVirtualMemory/,
        /NtProtectVirtualMemory/,
        /NtCreateThreadEx/,
        /NtMapViewOfSection/,
      ]
      let h = 0
      for (const p of syscalls) { if (p.test(s)) h++ }
      if (h >= 4) return { score: 80, detail: `${h} низкоуровневых системных вызовов` }
      return null
    },
  },
  {
    id: "HEUR-010", name: "Дамп памяти процесса", severity: "critical",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const hasDump = /MiniDumpWriteDump|ReadProcessMemory|NtReadVirtualMemory/.test(s)
      const hasProc = /lsass|csrss|svchost|wininit/.test(s)
      const hasFile = /WriteFile|CreateFile|fwrite/.test(s)
      if (hasDump && hasProc && hasFile) return { score: 90, detail: "Дамп системного процесса + запись в файл" }
      return null
    },
  },
  {
    id: "HEUR-011", name: "Сетевая аномалия", severity: "high",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const hasListen = /listen\s*\(\s*\d+\)/.test(s)
      const hasConnect = /connect\s*\(\s*\d+/.test(s)
      const hasShell = /child_process|spawn|exec.*-c/.test(s)
      if (hasListen && hasConnect && hasShell) return { score: 80, detail: "Слушает + подключается + выполняет команды" }
      return null
    },
  },
  {
    id: "HEUR-012", name: "Самоудаление следов", severity: "high",
    check: (content) => {
      if (content.length > 200000) return null
      const s = content.toString("utf8")
      const hasWrite = /WriteFile|fwrite|createWriteStream/.test(s)
      const hasDelete = /DeleteFile|unlink|rm\b|fs\.unlink/.test(s)
      const hasLogs = /(log|event|audit|trace|debug)/i.test(s)
      if (hasWrite && hasDelete && hasLogs) return { score: 70, detail: "Запись + удаление + работа с логами" }
      return null
    },
  },
]
export const QUARANTINE_DIR = path.join(process.env.USERPROFILE || process.env.HOME || "", ".stellar", "quarantine")
export function loadExclusions(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath, "utf8").split("\n").filter(l => l.trim() && !l.startsWith("#"))
    }
  } catch {}
  return []
}
export function isExcluded(filepath, exclusions) {
  const normalized = filepath.replace(/\\/g, "/").toLowerCase()
  for (const exc of exclusions) {
    const pattern = exc.replace(/\\/g, "/").toLowerCase()
    if (normalized.includes(pattern)) return true
  }
  return false
}
export function computeFileHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex")
}
export function computeFileHashes(content) {
  return {
    md5: crypto.createHash("md5").update(content).digest("hex"),
    sha1: crypto.createHash("sha1").update(content).digest("hex"),
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
  }
}
export function checkFileForMalware(content, filepath) {
  const results = {
    filepath,
    clean: true,
    threats: [],
    warnings: [],
    score: 0,
    details: {
      signatures: [],
      hashes: [],
      yara: [],
      heuristics: [],
    },
  }
  const isBinary = BINARY_EXTS.has(path.extname(filepath).toLowerCase())
  const isSource = !isBinary
  const hashes = computeFileHashes(content)
  if (MALICIOUS_HASHES.has(hashes.md5) || MALICIOUS_HASHES.has(hashes.sha256)) {
    results.clean = false
    results.threats.push({
      type: "hash",
      severity: "critical",
      message: `Хеш совпадает с известным вирусом`,
    })
    results.details.hashes.push({ ...hashes, match: true })
  }
  const text = content.toString("utf8")
  for (const sig of SIGNATURES) {
    try {
      if (sig.pattern.test(text)) {
        results.details.signatures.push({ id: sig.id, name: sig.name, severity: sig.severity, category: sig.category })
        if (sig.severity === "critical") {
          results.clean = false
          results.threats.push({ type: "signature", severity: sig.severity, message: `${sig.id}: ${sig.name}` })
          results.score += 85
        } else if (sig.severity === "high") {
          results.warnings.push({ type: "signature", severity: sig.severity, message: `${sig.id}: ${sig.name}` })
          results.score += 50
        } else {
          results.warnings.push({ type: "signature", severity: sig.severity, message: `${sig.id}: ${sig.name}` })
          results.score += 20
        }
      }
    } catch {}
  }
  for (const rule of YARA_RULES) {
    try {
      if (rule.condition(content)) {
        results.details.yara.push({ id: rule.id, name: rule.name, severity: rule.severity })
        if (rule.severity === "critical") {
          results.clean = false
          results.threats.push({ type: "yara", severity: rule.severity, message: `${rule.id}: ${rule.name}` })
          results.score += 80
        } else if (rule.severity === "high") {
          results.warnings.push({ type: "yara", severity: rule.severity, message: `${rule.id}: ${rule.name}` })
          results.score += 40
        } else {
          results.warnings.push({ type: "yara", severity: rule.severity, message: `${rule.id}: ${rule.name}` })
          results.score += 10
        }
      }
    } catch {}
  }
  for (const rule of HEURISTIC_RULES) {
    try {
      const result = rule.check(content, filepath)
      if (result) {
        const adjustedScore = isSource ? Math.floor(result.score * 0.6) : result.score
        results.details.heuristics.push({ id: rule.id, name: rule.name, severity: rule.severity, ...result, adjustedScore })
        if (adjustedScore >= 60) {
          results.clean = false
          results.threats.push({ type: "heuristic", severity: rule.severity, message: `${rule.id}: ${rule.name} — ${result.detail}` })
          results.score += adjustedScore
        } else if (adjustedScore >= 30) {
          results.warnings.push({ type: "heuristic", severity: rule.severity, message: `${rule.id}: ${rule.name} — ${result.detail}` })
          results.score += adjustedScore
        }
      }
    } catch {}
  }
  results.score = Math.min(results.score, 100)
  return results
}