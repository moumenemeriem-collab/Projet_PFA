param([string]$File, [int]$Start, [int]$End)
$c = Get-Content $File
for ($i = $Start; $i -le $End; $i++) {
  if ($i -le $c.Length) {
    Write-Output ("{0}: {1}" -f $i, $c[$i-1])
  }
}