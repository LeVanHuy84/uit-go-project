Param(
  [string[]]$Args
)
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location (Join-Path $PSScriptRoot '..')
node ./scripts/run-full-load-test.js @Args
