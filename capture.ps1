Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
try {
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  $bitmap.Save("C:\Users\user\Downloads\stella-coder-3-9\test_screen.png")
  $graphics.Dispose()
  $bitmap.Dispose()
  Write-Output "OK"
} catch {
  Write-Output "FAIL:$($_.Exception.Message)"
}
