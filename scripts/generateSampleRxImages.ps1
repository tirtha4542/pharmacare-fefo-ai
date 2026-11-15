Add-Type -AssemblyName System.Drawing

function Generate-PrescriptionImage {
    param(
        [string]$FilePath,
        [string]$Format, # "Jpeg" or "Png"
        [string]$DoctorName,
        [string]$PatientName,
        [string]$RxDate,
        [string[]]$Medicines,
        [string]$StatusStamp,
        [System.Drawing.Color]$StampColor
    )

    $width = 700
    $height = 920
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background paper
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(254, 254, 254))
    $graphics.FillRectangle($bgBrush, 0, 0, $width, $height)

    # Decorative header banner
    $primaryBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 118, 110)) # Teal
    $graphics.FillRectangle($primaryBrush, 0, 0, $width, 8)

    # Clinic title
    $titleFont = New-Object System.Drawing.Font("Arial", 18, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 41, 59))
    $graphics.DrawString("CITY HEALTH CLINIC & DIAGNOSTICS", $titleFont, $textBrush, 40, 28)

    $subFont = New-Object System.Drawing.Font("Arial", 9, [System.Drawing.FontStyle]::Regular)
    $grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(100, 116, 139))
    $graphics.DrawString("124 Healthcare Boulevard, Medical District • Tel: +1 (800) 555-0199", $subFont, $grayBrush, 40, 58)
    $graphics.DrawString("Licensed Pharmaceutical Practice • Reg # MED-884920", $subFont, $grayBrush, 40, 74)

    # Divider line
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(226, 232, 240), 2)
    $graphics.DrawLine($pen, 40, 98, $width - 40, 98)

    # Doctor Info (Left) and Date/Rx# (Right)
    $docFont = New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)
    $graphics.DrawString($DoctorName, $docFont, $primaryBrush, 40, 115)
    $graphics.DrawString("MBBS, MD (Internal Medicine), FCPS", $subFont, $grayBrush, 40, 135)
    $graphics.DrawString("Senior Consultant Physician", $subFont, $grayBrush, 40, 150)

    $graphics.DrawString("Date: $RxDate", $subFont, $textBrush, 500, 115)
    $graphics.DrawString("Rx ID: RX-" + (Get-Random -Minimum 100000 -Maximum 999999), $subFont, $textBrush, 500, 135)

    # Patient Details Box
    $boxBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252))
    $graphics.FillRectangle($boxBrush, 40, 180, $width - 80, 60)
    $boxBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(226, 232, 240), 1)
    $graphics.DrawRectangle($boxBorder, 40, 180, $width - 80, 60)

    $boldFont = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Bold)
    $graphics.DrawString("Patient Name: $PatientName", $boldFont, $textBrush, 55, 192)
    $graphics.DrawString("Age: 35 yrs   |   Gender: Male   |   Weight: 72 kg", $subFont, $grayBrush, 55, 214)

    # Rx Symbol
    $rxFont = New-Object System.Drawing.Font("Georgia", 34, [System.Drawing.FontStyle]::Bold)
    $graphics.DrawString("℞", $rxFont, $primaryBrush, 40, 255)

    # Medicine List
    $y = 330
    $medNum = 1
    $medNameFont = New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Bold)
    $medDosageFont = New-Object System.Drawing.Font("Arial", 9.5, [System.Drawing.FontStyle]::Italic)

    foreach ($item in $Medicines) {
        $graphics.DrawString("$medNum. $item", $medNameFont, $textBrush, 60, $y)
        $y += 24
        $graphics.DrawString("   Take with a full glass of water after food. Complete full prescribed course.", $medDosageFont, $grayBrush, 60, $y)
        $y += 42
        $medNum++
    }

    # Doctor Advice
    $adviceBoxY = 620
    $graphics.DrawString("Clinical Advice & Instructions:", $boldFont, $textBrush, 40, $adviceBoxY)
    $graphics.DrawString("- Avoid alcohol during antibiotic medication course.`n- Report immediately if rash or adverse reaction develops.`n- Follow up after 7 days if symptoms persist.", $subFont, $grayBrush, 40, $adviceBoxY + 22)

    # Doctor Signature Area
    $sigPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(30, 41, 59), 2)
    $graphics.DrawLine($sigPen, 460, 780, 640, 780)
    $graphics.DrawString("Physician's Signature", $subFont, $grayBrush, 490, 788)
    
    # Stylized script signature
    $sigFont = New-Object System.Drawing.Font("Monotype Corsiva", 20, [System.Drawing.FontStyle]::Italic)
    if (-not $sigFont) { $sigFont = New-Object System.Drawing.Font("Georgia", 16, [System.Drawing.FontStyle]::Italic) }
    $graphics.DrawString("S. Khan, MD", $sigFont, [System.Drawing.Brushes]::Navy, 480, 750)

    # Verification / Status Stamp
    if ($StatusStamp) {
        $stampPen = New-Object System.Drawing.Pen($StampColor, 3)
        $stampBrush = New-Object System.Drawing.SolidBrush($StampColor)
        $stampFont = New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Bold)
        
        $graphics.TranslateTransform(140, 740)
        $graphics.RotateTransform(-14)
        $graphics.DrawRectangle($stampPen, -100, -25, 200, 50)
        $graphics.DrawString($StatusStamp, $stampFont, $stampBrush, -85, -10)
        $graphics.ResetTransform()
    }

    # Footer
    $footerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
    $footerFont = New-Object System.Drawing.Font("Arial", 8, [System.Drawing.FontStyle]::Regular)
    $graphics.DrawString("PharmaCare Pro • Secure Digital Prescription Audit Trail • Validated Electronic Record", $footerFont, $footerBrush, 130, 890)

    # Save
    if ($Format -eq "Jpeg") {
        $bitmap.Save($FilePath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    } else {
        $bitmap.Save($FilePath, [System.Drawing.Imaging.ImageFormat]::Png)
    }

    $graphics.Dispose()
    $bitmap.Dispose()
    Write-Host "Generated: $FilePath"
}

# 1. rx_sample_approved.jpg
Generate-PrescriptionImage `
    -FilePath "c:\Users\Tirtha Bepary\Desktop\Jim_project\uploads\rx_sample_approved.jpg" `
    -Format "Jpeg" `
    -DoctorName "Dr. Sarah Khan, MD" `
    -PatientName "John Doe" `
    -RxDate "Nov 01, 2026" `
    -Medicines @("Amoxicillin 500mg (1 capsule 3x daily)", "Azithromycin 500mg (1 tablet once daily)", "Paracetamol 500mg (1 tablet as needed)") `
    -StatusStamp "CLINICALLY APPROVED" `
    -StampColor ([System.Drawing.Color]::FromArgb(5, 150, 105)) # Green

# 2. rx_sample_pending.png
Generate-PrescriptionImage `
    -FilePath "c:\Users\Tirtha Bepary\Desktop\Jim_project\uploads\rx_sample_pending.png" `
    -Format "Png" `
    -DoctorName "Dr. Sarah Khan, MD" `
    -PatientName "Jane Smith" `
    -RxDate "Nov 10, 2026" `
    -Medicines @("Losartan Potassium 50mg (1 tablet daily)", "Metformin 500mg (1 tablet twice daily)") `
    -StatusStamp "PENDING AUDIT" `
    -StampColor ([System.Drawing.Color]::FromArgb(217, 119, 6)) # Amber

# 3. 1794541081314-c26cd2b0b8c3e40fd5670906c7050433.jpg
Generate-PrescriptionImage `
    -FilePath "c:\Users\Tirtha Bepary\Desktop\Jim_project\uploads\1794541081314-c26cd2b0b8c3e40fd5670906c7050433.jpg" `
    -Format "Jpeg" `
    -DoctorName "Dr. Sarah Khan, MD" `
    -PatientName "John Doe" `
    -RxDate "Nov 13, 2026" `
    -Medicines @("Tramadol 50mg (1 capsule every 8 hours PRN)", "Ibuprofen 400mg (1 tablet twice daily)") `
    -StatusStamp "CLINICALLY APPROVED" `
    -StampColor ([System.Drawing.Color]::FromArgb(5, 150, 105)) # Green

