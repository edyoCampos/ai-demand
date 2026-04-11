<#
.SYNOPSIS
  Auto-commit script em PowerShell que analisa diffs, inferir tipos de commit e faz push unico.

USO
  powershell -ExecutionPolicy Bypass -File .\auto-commit.ps1

#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Say { param($m) Write-Host $m }
function Hr  { Write-Host "----------------------------------------" }

# Pré-requisitos
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Erro: git nao encontrado no PATH."
    exit 1
}

# Repositório
$repoRoot = git rev-parse --show-toplevel 2>$null
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
    Write-Error "Erro: nao está dentro de um repositório Git."
    exit 1
}
Set-Location $repoRoot.Trim()

# Se nao houver mudanças
$statusPorcelain = git status --porcelain=v1
if ([string]::IsNullOrWhiteSpace($statusPorcelain)) {
    Say "Nenhuma mudança para commitar. Saindo."
    exit 0
}

# Centralizar padroes (regex strings)
$DOC_PATH_REGEX = '(^|/)docs(/|$)'
$DOC_BASENAMES_REGEX = '^README([.]|$)'
$DOC_EXTS = 'md|rst|adoc|txt'

$TEST_PATH_REGEX = '(^|/)(test|tests|__tests__)(/|$)'
$TEST_EXT_REGEX = '\.(test|spec)\.(js|jsx|ts|tsx|py|rb|go)$'
$PLAYWRIGHT_PATH_REGEX = '(^|/)playwright(/|$)'

$CONFIG_FILES_REGEX = '(^|/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|requirements\.txt|pyproject\.toml|setup\.py|pom\.xml|build\.gradle|Dockerfile|README\.md)$'

$COMMENT_PREFIXES = '^(//|#|/\*|\*|\*/|<!--)'

# Funções de classificação
function Is-DocsFile($f) {
    $b = [System.IO.Path]::GetFileName($f)
    if ([regex]::IsMatch($f, $DOC_PATH_REGEX) -or ([regex]::IsMatch($b, $DOC_BASENAMES_REGEX)) -or ([regex]::IsMatch($f, "\.($DOC_EXTS)$"))) {
        return $true
    }
    return $false
}

function Is-TestFile($f) {
    $b = [System.IO.Path]::GetFileName($f)
    if ([regex]::IsMatch($f, $TEST_PATH_REGEX) -or [regex]::IsMatch($f, $PLAYWRIGHT_PATH_REGEX) -or [regex]::IsMatch($b, $TEST_EXT_REGEX)) {
        return $true
    }
    return $false
}

function Is-ConfigOrDeps($f) {
    if ([regex]::IsMatch($f, $CONFIG_FILES_REGEX)) { return $true }
    return $false
}

function WhitespaceOnlyChange($f) {
    $full = git diff -- $f 2>$null
    if ([string]::IsNullOrWhiteSpace($full)) { return $false }
    $now = git diff -w -- $f 2>$null
    return [string]::IsNullOrWhiteSpace($now)
}

function CommentsOnlyChange($f) {
    $diff = git diff -U0 -- $f 2>$null
    if ([string]::IsNullOrWhiteSpace($diff)) { return $false }

    $lines = $diff -split "`n"
    $payloadLines = @()
    foreach ($line in $lines) {
        if ($line -match '^(---|\+\+\+|@@)') { continue }
        if ($line -match '^[+-]') {
            $payloadLines += $line.Substring(1)
        }
    }
    if ($payloadLines.Count -eq 0) { return $false }

    foreach ($pl in $payloadLines) {
        $trimmed = $pl.TrimStart()
        if (-not ([regex]::IsMatch($trimmed, $COMMENT_PREFIXES))) {
            return $false
        }
    }
    return $true
}

function Contains-FixKeyword($f) {
    $diff = git diff -U0 -- $f 2>$null
    if ([string]::IsNullOrWhiteSpace($diff)) { return $false }
    $lower = $diff.ToLowerInvariant()
    return [regex]::IsMatch($lower, '\b(fix|bug|error|hotfix|issue)\b')
}

function Truncate-Msg($s, $max = 60) {
    if ($null -eq $s) { return "" }
    if ($s.Length -gt $max) {
        return $s.Substring(0,$max).TrimEnd()
    } else {
        return $s
    }
}

# Ler status -z (NUL separated)
$raw = git -c core.quotepath=off status --porcelain=v1 -z
$entries = $raw -split "`0"
# remover vazio final
if ($entries[-1] -eq '') { $entries = $entries[0..($entries.Count-2)] }

$FILES = @()
$STATUS = @()
$OLD_PATHS = @()

for ($i = 0; $i -lt $entries.Count; $i++) {
    $entry = $entries[$i]
    if ($entry.Length -lt 3) { continue }
    $st = $entry.Substring(0,2)
    $pth = $entry.Substring(3)
    if ($st.Substring(0,1) -in 'R','C') {
        # próximo token é o old path
        $oldp = ""
        if ($i+1 -lt $entries.Count) { $oldp = $entries[$i+1]; $i++ }
        $FILES += $pth
        $STATUS += $st
        $OLD_PATHS += $oldp
    } else {
        $FILES += $pth
        $STATUS += $st
        $OLD_PATHS += ""
    }
}

# Inferir tipo/mensagem
function Infer-TypeAndMessage($status, $f, $oldpath) {
    $base = [System.IO.Path]::GetFileName($f)
    if ($status.Substring(0,1) -eq 'D' -or $status.Substring(1,1) -eq 'D') {
        return "chore|remove $base"
    }
    if (($status.Substring(0,1) -eq 'R') -and (-not [string]::IsNullOrWhiteSpace($oldpath))) {
        $oldb = [System.IO.Path]::GetFileName($oldpath)
        return "chore|renomeia $oldb para $base"
    }
    if ($status -eq '??' -or $status.Substring(0,1) -eq 'A') {
        if (Is-DocsFile $f) { return "docs|adiciona $base" }
        elseif (Is-TestFile $f) { return "chore|adiciona testes $base" }
        elseif (Is-ConfigOrDeps $f) { return "chore|adiciona configuracao $base" }
        else { return "feat|adiciona $base" }
    }
    if (Is-DocsFile $f) { return "docs|atualiza documentacao em $base" }
    if (WhitespaceOnlyChange $f) { return "style|ajusta formatação em $base" }
    if (CommentsOnlyChange $f) { return "docs|atualiza comentarios em $base" }
    if (Contains-FixKeyword $f) { return "fix|corrige logica em $base" }
    if (Is-TestFile $f) { return "chore|atualiza testes $base" }
    if (Is-ConfigOrDeps $f) { return "chore|atualiza configuracao $base" }
    return "refactor|refatora $base"
}

# Agrupamento
$TYPES = @{}
$REASONS = @{}

$GROUP_DOCS = @()
$GROUP_STYLE = @()
$GROUP_CHORE_TESTS = @()

$SOLO_FILES = @()
$SOLO_TYPES = @()
$SOLO_MSGS = @()

for ($idx=0; $idx -lt $FILES.Count; $idx++) {
    $f = $FILES[$idx]; $st = $STATUS[$idx]; $oldp = $OLD_PATHS[$idx]
    $inf = Infer-TypeAndMessage $st $f $oldp
    $parts = $inf -split '\|',2
    $typ = $parts[0]; $msg = $parts[1]
    $short = Truncate-Msg $msg
    $TYPES[$f] = $typ
    $REASONS[$f] = $short

    if ($typ -eq 'docs')       { $GROUP_DOCS += $f }
    elseif ($typ -eq 'style')  { $GROUP_STYLE += $f }
    elseif (($typ -eq 'chore') -and (Is-TestFile $f)) { $GROUP_CHORE_TESTS += $f }
    else {
        $SOLO_FILES += $f
        $SOLO_TYPES += $typ
        $SOLO_MSGS  += $short
    }
}

# Auditoria
Hr
Say "Decisoes de tipo por arquivo (antes de executar):"
foreach ($f in $FILES) {
    Say "- ${f}: $($TYPES[$f]) - motivo: $($REASONS[$f])"
}
Hr

# Resumo do plano
Say "Resumo do plano de commits:"
if ($GROUP_DOCS.Count -gt 0) { Say "• 1 commit docs para $($GROUP_DOCS.Count) arquivo(s)." }
if ($GROUP_STYLE.Count -gt 0) { Say "• 1 commit style para $($GROUP_STYLE.Count) arquivo(s)." }
if ($GROUP_CHORE_TESTS.Count -gt 0) { Say "• 1 commit chore (testes) para $($GROUP_CHORE_TESTS.Count) arquivo(s)." }
if ($SOLO_FILES.Count -gt 0) { Say "• $($SOLO_FILES.Count) commit(s) individuais (feat/fix/refactor/chore)." }
Hr
Say "Prosseguindo em 5s. Pressione Ctrl+C para abortar."
Start-Sleep -Seconds 5

# Função de commit
function Commit-Files($typ, $msg, [string[]]$files) {
    $toAdd = @($files | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($toAdd.Count -eq 0) { return }
    git add -- $toAdd
    $staged = git diff --name-only --cached
    if ([string]::IsNullOrWhiteSpace($staged)) {
        git reset
        return
    }
    $commitMsg = Truncate-Msg ("${typ}: $msg")
    git commit -m $commitMsg
    # limpa índice
    git reset
}

# Executa commits por grupo
if ($GROUP_DOCS.Count -gt 0) { Commit-Files "docs" "atualiza documentacao" $GROUP_DOCS }
if ($GROUP_STYLE.Count -gt 0) { Commit-Files "style" "ajusta formatação" $GROUP_STYLE }
if ($GROUP_CHORE_TESTS.Count -gt 0) { Commit-Files "chore" "atualiza testes de API" $GROUP_CHORE_TESTS }

# Commits individuais
for ($i=0; $i -lt $SOLO_FILES.Count; $i++) {
    $f = $SOLO_FILES[$i]; $typ = $SOLO_TYPES[$i]; $msg = $SOLO_MSGS[$i]
    Commit-Files $typ $msg @($f)
}

Hr
Say "Commits locais concluidos. Push unico em 3s... (Ctrl+C para abortar)"
Start-Sleep -Seconds 3

$currentBranch = git rev-parse --abbrev-ref HEAD

cmd.exe /c "git fetch origin $currentBranch 2>nul"
if ($LASTEXITCODE -eq 0) {
    Say "Sincronizando branch '$currentBranch' com o GitHub..."
    $procPull = Start-Process git -ArgumentList "pull origin $currentBranch --rebase" -NoNewWindow -PassThru -Wait
    if ($procPull.ExitCode -ne 0) {
        Hr
        Write-Error "Falha de sincronizacao. Ha conflitos de codigo. Resolva manualmente."
        exit 1
    }
}

Say "Executando: git push origin $currentBranch"
$procPush = Start-Process git -ArgumentList "push origin $currentBranch" -NoNewWindow -PassThru -Wait
if ($procPush.ExitCode -ne 0) {
    Hr
    Write-Error "Falha no push final. Verifique permissoes."
    exit 1
}
Hr
Say "Push concluído com sucesso."