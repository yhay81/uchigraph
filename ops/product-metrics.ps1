[CmdletBinding()]
param(
    [switch]$Local
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SqlPath = Join-Path $PSScriptRoot "product-metrics.sql"
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Target = if ($Local) { "--local" } else { "--remote" }
$Sql = (Get-Content $SqlPath) -join " "

$Output = & $Wrangler d1 execute uchigraph $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) {
    throw "D1 metrics query failed with exit code $LASTEXITCODE"
}

$Payload = ($Output -join [Environment]::NewLine) | ConvertFrom-Json
$Row = $Payload[0].results[0]
if (-not $Row) {
    throw "D1 metrics query returned no result"
}

function Get-Percent {
    param([int]$Numerator, [int]$Denominator)
    if ($Denominator -eq 0) { return $null }
    return [Math]::Round(($Numerator / $Denominator) * 100, 1)
}

$Users = [int]$Row.users
$Creators = [int]$Row.creators
$Sharers = [int]$Row.sharers
$LessonVisitors = [int]$Row.lesson_visitors
$Starters = [int]$Row.starters
$Completers = [int]$Row.completers

[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    service = "uchigraph"
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        users = $Users
        creators = $Creators
        practices_created = [int]$Row.practices_created
        active_practices = [int]$Row.active_practices
        sharers = $Sharers
        lesson_visitors = $LessonVisitors
        starters = $Starters
        completers = $Completers
        attempts = [int]$Row.attempts
        learner_codes = [int]$Row.learner_codes
        completed_practices = [int]$Row.completed_practices
        owners_checked = [int]$Row.owners_checked
        closed_practices = [int]$Row.closed_practices
        returned_users = [int]$Row.returned_users
        users_7d = [int]$Row.users_7d
        creators_7d = [int]$Row.creators_7d
        completers_7d = [int]$Row.completers_7d
    }
    rates = [ordered]@{
        exposure_to_creator_percent = Get-Percent $Creators $Users
        creator_to_share_percent = Get-Percent $Sharers $Creators
        lesson_to_start_percent = Get-Percent $Starters $LessonVisitors
        start_to_complete_percent = Get-Percent $Completers $Starters
        practice_to_completion_percent = Get-Percent ([int]$Row.completed_practices) ([int]$Row.practices_created)
        return_percent = Get-Percent ([int]$Row.returned_users) $Users
    }
    safety = [ordered]@{
        reports = [int]$Row.reports
        hidden_practices = [int]$Row.hidden_practices
    }
} | ConvertTo-Json -Depth 4
