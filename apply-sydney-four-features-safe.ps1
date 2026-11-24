# 시드니 앱 4기능 패치: TSX는 원본 패치 그대로 적용하고, CSS는 기존 파일 맨 끝에 안전하게 추가.
# 프로젝트 루트(package.json이 있는 폴더)에서 실행.
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath '.\package.json')) {
    throw 'package.json이 있는 프로젝트 루트에서 실행해 줘.'
}
if (-not (Test-Path -LiteralPath '.\sydney-four-features.patch')) {
    throw 'sydney-four-features.patch 파일을 프로젝트 루트에 놓아 줘.'
}

$patchPath = (Resolve-Path -LiteralPath '.\sydney-four-features.patch').Path
$patch = [System.IO.File]::ReadAllText($patchPath)
$cssFiles = @('src/expense-tracker.css', 'src/index.css')

# 사전에 CSS 두 블록을 모두 확인; 본문 코드부터 적용한 후 CSS가 빠지는 상황 방지.
$cssAdditions = @{}
foreach ($file in $cssFiles) {
    $header = "diff --git a/$file b/$file"
    $start = $patch.IndexOf($header, [System.StringComparison]::Ordinal)
    if ($start -lt 0) { throw "패치에서 $file 항목을 찾지 못했어." }
    $next = $patch.IndexOf("diff --git a/", $start + $header.Length, [System.StringComparison]::Ordinal)
    if ($next -lt 0) { $next = $patch.Length }
    $section = $patch.Substring($start, $next - $start)

    $insideHunk = $false
    $addedLines = New-Object 'System.Collections.Generic.List[string]'
    foreach ($line in ($section -split '\r?\n')) {
        if ($line -match '^@@ ') { $insideHunk = $true; continue }
        if ($insideHunk -and $line.StartsWith('+') -and -not $line.StartsWith('+++')) {
            [void]$addedLines.Add($line.Substring(1))
        }
    }
    if ($addedLines.Count -eq 0) { throw "$file 의 CSS 추가 내용이 비어 있어." }
    $cssAdditions[$file] = $addedLines.ToArray()
}

# --exclude를 사용하므로 변경된 CSS 마지막 줄에 의존하지 않음.
Write-Host '[1/3] App.tsx, ExpenseTracker.tsx, MapCollection.tsx 패치 확인 중...'
& git apply --check --exclude=src/expense-tracker.css --exclude=src/index.css $patchPath
if ($LASTEXITCODE -ne 0) {
    # 이미 적용된 상태인지 확인해 중복 적용 방지
    & git apply --reverse --check --exclude=src/expense-tracker.css --exclude=src/index.css $patchPath 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'TSX 파일도 기준 코드와 달라서 중단했어. git apply 오류를 확인해 줘.'
    }
    Write-Host 'TSX 패치는 이미 적용된 것으로 확인. 재적용을 건너뜀.'
} else {
    Write-Host '[2/3] TSX 변경 적용 중...'
    & git apply --exclude=src/expense-tracker.css --exclude=src/index.css $patchPath
    if ($LASTEXITCODE -ne 0) { throw 'TSX 패치 적용에 실패했어.' }
}

Write-Host '[3/3] 기존 CSS를 유지하면서 새 스타일 추가 중...'
$utf8 = New-Object System.Text.UTF8Encoding -ArgumentList $false
foreach ($file in $cssFiles) {
    $nativePath = Join-Path (Get-Location).Path ($file.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $nativePath)) { throw "$file 파일이 없어." }
    $current = [System.IO.File]::ReadAllText($nativePath)
    $marker = ($cssAdditions[$file] | Where-Object { $_ -match '^/\* ===== FOUR FEATURES:' } | Select-Object -First 1)
    if (-not $marker) { throw "$file 의 시작 주석을 찾지 못했어." }
    if ($current.Contains($marker)) {
        Write-Host "이미 추가됨: $file (중복 추가 생략)"
        continue
    }
    $appendText = [Environment]::NewLine + (($cssAdditions[$file] -join [Environment]::NewLine).TrimEnd()) + [Environment]::NewLine
    [System.IO.File]::AppendAllText($nativePath, $appendText, $utf8)
    Write-Host "추가 완료: $file"
}
Write-Host '완료. 이제 npm run build 실행 후 localhost에서 확인해 줘.'
