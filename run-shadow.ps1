$env:DISCOVERY_V2='true'
$env:DISCOVERY_V2_SHADOW_MODE='true'
$env:DISCOVERY_V2_WRITE_MODE='false'
$env:DISCOVERY_V2_MAX_ATTEMPTS_PER_RUN='120'
$env:DISCOVERY_V2_MAX_PER_HOST_PER_RUN='20'
$env:DISCOVERY_V2_QPS_PER_HOST='0.5'
$env:NODE_ENV='production'
$env:REDIS_URL='rediss://red-d48gppur433s73a2mjlg:mc6N6wp4hW7rHSdNStw054K7EdI6Kes9@singapore-keyvalue.render.com:6379'
Set-Location C:\Users\danie\CascadeProjects\windsurf-project\carrot
npx tsx scripts/run-shadow.ts chicago-bulls *>&1 | Tee-Object -FilePath C:\Users\danie\CascadeProjects\windsurf-project\shadow-run.log
