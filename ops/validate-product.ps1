[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PagesPath = Join-Path $RepoRoot "src\ui\pages.tsx"
$ProductPath = Join-Path $RepoRoot "src\config\product.ts"
$WranglerPath = Join-Path $RepoRoot "wrangler.jsonc"
$PublicDirectory = Join-Path $RepoRoot "public"
$Pages = Get-Content -Raw -LiteralPath $PagesPath
$Product = Get-Content -Raw -LiteralPath $ProductPath
$Wrangler = Get-Content -Raw -LiteralPath $WranglerPath

if ($Pages.Contains('data-template-surface="replace-before-release"')) {
    throw "Replace the starter workspace with the product-specific interface before release"
}

if ($Pages.Contains('class="hero"') -or $Pages.Contains('class="product-flow"')) {
    throw "Text-led hero and generic product-flow sections are not releaseable product surfaces"
}

if ($Product.Contains('"web-product-starter"') -or $Product.Contains('"Web Product Starter"')) {
    throw "Replace the starter product identity before release"
}

if (-not $Product.Contains(".yhay81.com")) {
    throw "Use a yhay81.com product subdomain as the canonical production URL"
}

if (
    -not $Wrangler.Contains('"workers_dev": false') -or
    -not $Wrangler.Contains('"custom_domain": true') -or
    -not $Wrangler.Contains(".yhay81.com")
) {
    throw "Publish through a Wrangler-managed yhay81.com Custom Domain with workers.dev disabled"
}

$KeyFiles = @(
    Get-ChildItem -LiteralPath $PublicDirectory -File |
        Where-Object { $_.Name -match "^[a-zA-Z0-9-]{8,128}\.txt$" }
)
if ($KeyFiles.Count -ne 1) {
    throw "Expected exactly one generated IndexNow key file, found $($KeyFiles.Count)"
}

$Key = (Get-Content -Raw -LiteralPath $KeyFiles[0].FullName).Trim()
if ($Key -ne $KeyFiles[0].BaseName) {
    throw "IndexNow key file name and content do not match"
}

Write-Output "Product release contract is satisfied"
