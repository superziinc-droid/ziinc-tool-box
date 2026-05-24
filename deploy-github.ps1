param(
  [string]$RepoName = "ziinc-tool-box",
  [ValidateSet("public", "private")]
  [string]$Visibility = "public"
)

$ErrorActionPreference = "Stop"

function Resolve-Tool($Name, [string[]]$Fallbacks) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }
  foreach ($path in $Fallbacks) {
    if (Test-Path $path) {
      return $path
    }
  }
  throw "$Name is required. Install it and run this script again."
}

$GitExe = Resolve-Tool "git" @(
  "E:\git\Git\cmd\git.exe",
  "C:\Program Files\Git\cmd\git.exe",
  "C:\Program Files (x86)\Git\cmd\git.exe"
)
$GhExe = Resolve-Tool "gh" @(
  "E:\GitHub CLI\gh.exe",
  "C:\Program Files\GitHub CLI\gh.exe"
)

function Git {
  & $GitExe @args
}

function Gh {
  & $GhExe @args
}

Gh auth status | Out-Null

if (-not (Test-Path ".git")) {
  Git init
  Git branch -M main
}

$gitName = Git config --get user.name
$gitEmail = Git config --get user.email
if (-not $gitName -or -not $gitEmail) {
  throw "Git user.name and user.email are required. Run: git config --global user.name `"Your Name`"; git config --global user.email `"you@example.com`""
}

Git add index.html README.md .gitignore .nojekyll deploy-github.ps1

$hasChanges = Git status --porcelain
if ($hasChanges) {
  Git commit -m "Deploy Ziinc Tool Box"
}

$remote = Git remote get-url origin 2>$null
if (-not $remote) {
  if ($Visibility -eq "private") {
    Gh repo create $RepoName --private --source . --remote origin --push
  } else {
    Gh repo create $RepoName --public --source . --remote origin --push
  }
} else {
  Git push -u origin main
}

$repo = Gh repo view --json nameWithOwner --jq ".nameWithOwner"

Gh api -X POST "repos/$repo/pages" -f "source[branch]=main" -f "source[path]=/" 2>$null
if ($LASTEXITCODE -ne 0) {
  Gh api -X PUT "repos/$repo/pages" -f "source[branch]=main" -f "source[path]=/" | Out-Null
}

$url = Gh api "repos/$repo/pages" --jq ".html_url"
Write-Host "GitHub Pages URL: $url"
