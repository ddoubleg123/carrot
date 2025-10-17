#!/bin/bash
# Download Stable Diffusion v1.5 model to Vast.ai instance

echo "🚀 Downloading Stable Diffusion v1.5 model (4GB)..."
echo "This will take 5-10 minutes depending on connection speed..."

# Navigate to the models directory
cd /root/stable-diffusion-webui/models/Stable-diffusion || exit 1

# Remove the empty file
rm -f v1-5-pruned-emaonly.safetensors

# Download with progress
wget --progress=bar:force:noscroll \
  -O v1-5-pruned-emaonly.safetensors \
  https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors

# Check if download was successful
if [ -s v1-5-pruned-emaonly.safetensors ]; then
  FILE_SIZE=$(stat -f%z v1-5-pruned-emaonly.safetensors 2>/dev/null || stat -c%s v1-5-pruned-emaonly.safetensors)
  FILE_SIZE_GB=$(echo "scale=2; $FILE_SIZE / 1024 / 1024 / 1024" | bc)
  echo "✅ Model downloaded successfully! Size: ${FILE_SIZE_GB}GB"
  ls -lh v1-5-pruned-emaonly.safetensors
else
  echo "❌ Download failed or file is empty"
  exit 1
fi

