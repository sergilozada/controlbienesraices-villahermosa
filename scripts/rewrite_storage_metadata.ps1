<#
rewrite_storage_metadata.ps1

Uso: desde PowerShell ejecuta (ejemplo):
  .\rewrite_storage_metadata.ps1 -Bucket "villa-hermosa-lotes.firebasestorage.app" -Prefix "clients"

Qué hace:
 - Verifica que `gsutil` esté en PATH y que estés autenticado.
 - Re-escribe metadata para objetos bajo gs://<Bucket>/<Prefix>/** usando `gsutil -m setmeta`.
 - Esto fuerza que los objetos se sirvan de nuevo por la CDN/edge y puede resolver problemas donde la respuesta no incluya cabeceras CORS (especialmente después de cambiar la configuración CORS a nivel de bucket).

Notas:
 - Este script NO ejecuta cambios destructivos; solo cambia metadatos (Cache-Control) para forzar re-emisión.
 - Requiere que tu cuenta tenga permisos suficientes (Storage Admin o similar).
 - Para reescribir todos los objetos usa Prefix '=' (o deja vacio) y se aplicará a la raíz.

#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Bucket,
    [Parameter(Mandatory=$false)][string]$Prefix = "clients"
)

function Check-Gsutil {
    $g = Get-Command gsutil -ErrorAction SilentlyContinue
    if (-not $g) {
        Write-Error "gsutil no se encuentra en PATH. Instala Google Cloud SDK y asegúrate de que gsutil esté disponible."
        exit 1
    }
}

function Confirm-Action {
    param($Message)
    Write-Host $Message -ForegroundColor Yellow
    $resp = Read-Host "¿Continuar? (s/n)"
    if ($resp -ne 's' -and $resp -ne 'S') {
        Write-Host "Operación cancelada." -ForegroundColor Cyan
        exit 0
    }
}

Check-Gsutil

# Construir ruta
if ([string]::IsNullOrWhiteSpace($Prefix) -or $Prefix -eq "=") {
    $target = "gs://$Bucket/**"
} else {
    $target = "gs://$Bucket/$Prefix/**"
}

Write-Host "Preparando para reescribir metadata en: $target" -ForegroundColor Green
Confirm-Action "Esto reescribirá metadata (Cache-Control) en los objetos indicados. Asegúrate de estar autenticado y de usar el proyecto correcto."

# Comando recomendado: set Cache-Control para forzar revalidación
$setmetaCmd = 'gsutil -m setmeta -h "Cache-Control: no-cache, max-age=0" ' + $target
Write-Host "Ejecutando: $setmetaCmd" -ForegroundColor Green

# Ejecutar
$proc = Start-Process -FilePath "gsutil" -ArgumentList "-m","setmeta","-h","`"Cache-Control: no-cache, max-age=0`"",$target -NoNewWindow -Wait -PassThru
if ($proc.ExitCode -eq 0) {
    Write-Host "Metadata reescrita correctamente (o no se detectaron objetos)." -ForegroundColor Green
    Write-Host "Espera unos minutos para la propagación y vuelve a probar la descarga en la app." -ForegroundColor Cyan
} else {
    Write-Error "gsutil retornó código de salida $($proc.ExitCode). Revisa permisos y el nombre del bucket/prefijo." 
}

# Alternativa: si prefieres usar rewrite para reencriptar/forzar otra operación, descomenta la siguiente línea y ajusta
# gsutil -m rewrite -r gs://$Bucket/$Prefix/**

Write-Host "Fin." -ForegroundColor Green
