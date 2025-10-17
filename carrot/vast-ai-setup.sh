#!/bin/bash

# Vast.ai Stable Diffusion WebUI Setup Script
# Run this script on your Vast.ai instance

echo "🚀 Starting AUTOMATIC1111 Stable Diffusion WebUI setup..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install dependencies
echo "📦 Installing dependencies..."
apt install -y git python3 python3-pip python3-venv wget

# Install NVIDIA drivers if not present
echo "🎮 Checking NVIDIA drivers..."
nvidia-smi || echo "⚠️  NVIDIA drivers not found, please install them manually"

# Clone AUTOMATIC1111 WebUI
echo "📥 Cloning AUTOMATIC1111 Stable Diffusion WebUI..."
cd /root
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui

# Download Stable Diffusion model
echo "📥 Downloading Stable Diffusion v1.5 model..."
mkdir -p models/Stable-diffusion
wget -O models/Stable-diffusion/v1-5-pruned-emaonly.safetensors \
  https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors

# Create launch script with API enabled
echo "⚙️  Creating launch script..."
cat > webui-user.sh << 'EOF'
#!/bin/bash

export COMMANDLINE_ARGS="--api --listen --port 7860 --xformers --enable-insecure-extension-access --no-half-vae"
export PYTHON=python3
export VENV_DIR=venv

# Launch WebUI
bash webui.sh
EOF

chmod +x webui-user.sh

# Install WebUI (this will take a while)
echo "🔧 Installing WebUI dependencies..."
bash webui.sh --skip-torch-cuda-test --exit

# Create systemd service for auto-restart
echo "🔧 Creating systemd service..."
cat > /etc/systemd/system/stable-diffusion.service << EOF
[Unit]
Description=Stable Diffusion WebUI
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/stable-diffusion-webui
ExecStart=/root/stable-diffusion-webui/webui-user.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "🚀 Starting Stable Diffusion WebUI service..."
systemctl daemon-reload
systemctl enable stable-diffusion.service
systemctl start stable-diffusion.service

echo "✅ Setup complete!"
echo ""
echo "📊 Service status:"
systemctl status stable-diffusion.service --no-pager
echo ""
echo "🌐 WebUI should be accessible at: http://83.10.113.244:7860"
echo "🔌 API endpoint: http://83.10.113.244:7860/sdapi/v1/txt2img"
echo ""
echo "📝 Useful commands:"
echo "  - Check status: systemctl status stable-diffusion"
echo "  - View logs: journalctl -u stable-diffusion -f"
echo "  - Restart: systemctl restart stable-diffusion"
echo "  - Stop: systemctl stop stable-diffusion"

