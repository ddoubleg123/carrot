# Check Vast.ai server status
$VAST_HOST = "ssh4.vast.ai"
$VAST_PORT = "14688"
$VAST_USER = "root"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "VAST.AI SERVER STATUS CHECK" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣  Checking disk space..." -ForegroundColor Yellow
ssh -p $VAST_PORT "${VAST_USER}@${VAST_HOST}" "df -h / && echo ''"

Write-Host "2️⃣  Checking installed Python packages..." -ForegroundColor Yellow
ssh -p $VAST_PORT "${VAST_USER}@${VAST_HOST}" "pip list | grep -E '(torch|diffusers|transformers|fastapi|basicsr|realesrgan)' && echo ''"

Write-Host "3️⃣  Checking for model files..." -ForegroundColor Yellow
ssh -p $VAST_PORT "${VAST_USER}@${VAST_HOST}" "du -sh /root/.cache/huggingface 2>/dev/null && echo ''"
ssh -p $VAST_PORT "${VAST_USER}@${VAST_HOST}" "ls -la /root/.cache/huggingface/hub/ 2>/dev/null | grep -E '(sdxl|stable-diffusion)' | head -10 && echo ''"

Write-Host "4️⃣  Checking running processes..." -ForegroundColor Yellow
ssh -p $VAST_PORT "${VAST_USER}@${VAST_HOST}" "ps aux | grep -E '(python|api)' | grep -v grep && echo ''"

Write-Host "5️⃣  Checking GPU status..." -ForegroundColor Yellow
ssh -p $VAST_PORT "${VAST_USER}@${VAST_HOST}" "nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader && echo ''"

Write-Host "6️⃣  Checking uploaded files..." -ForegroundColor Yellow
ssh -p $VAST_PORT "${VAST_USER}@${VAST_HOST}" "ls -lh /root/*.py /root/*.sh 2>/dev/null && echo ''"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "STATUS CHECK COMPLETE" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan


