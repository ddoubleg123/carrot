#!/bin/bash
# SDXL Verification Script - Test SDXL deployment
# Usage: ./verify-sdxl.sh
# Run this script ON the Vast.ai instance after deployment

set -e

echo "================================================================"
echo "🔍 SDXL Verification Script"
echo "================================================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SUCCESS_COUNT=0
FAIL_COUNT=0

# Function to print test result
test_result() {
    local test_name=$1
    local result=$2
    local details=$3
    
    if [[ $result == "PASS" ]]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    if [[ -n $details ]]; then
        echo "   $details"
    fi
    echo ""
}

echo "================================================================"
echo "🔍 Test 1: Process Check"
echo "================================================================"
echo ""

if pgrep -f "upgraded-sdxl-api.py" > /dev/null; then
    PID=$(pgrep -f "upgraded-sdxl-api.py")
    UPTIME=$(ps -p $PID -o etime= | tr -d ' ')
    test_result "SDXL Process Running" "PASS" "PID: $PID, Uptime: $UPTIME"
else
    test_result "SDXL Process Running" "FAIL" "Process not found"
    echo "❌ Cannot continue verification without running process"
    exit 1
fi

echo "================================================================"
echo "🔍 Test 2: Port Check"
echo "================================================================"
echo ""

if netstat -tln 2>/dev/null | grep -q ":7860" || ss -tln 2>/dev/null | grep -q ":7860"; then
    test_result "Port 7860 Listening" "PASS" "Service is bound to port 7860"
else
    test_result "Port 7860 Listening" "FAIL" "Port 7860 not listening"
fi

echo "================================================================"
echo "🔍 Test 3: Health Endpoint"
echo "================================================================"
echo ""

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:7860/health 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [[ $HTTP_CODE == "200" ]]; then
    test_result "Health Endpoint Response" "PASS" "HTTP 200 OK"
    
    # Parse JSON response
    echo "📋 Health Check Details:"
    echo "$HEALTH_BODY" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_BODY"
    echo ""
    
    # Check specific fields
    MODEL_LOADED=$(echo "$HEALTH_BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('model_loaded', False))" 2>/dev/null)
    CUDA_AVAILABLE=$(echo "$HEALTH_BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('cuda_available', False))" 2>/dev/null)
    VRAM_INFO=$(echo "$HEALTH_BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('vram_available', 'Unknown'))" 2>/dev/null)
    
    if [[ $MODEL_LOADED == "True" ]]; then
        test_result "Models Loaded" "PASS" "SDXL models are loaded in memory"
    else
        test_result "Models Loaded" "FAIL" "Models not loaded yet (may still be downloading)"
    fi
    
    if [[ $CUDA_AVAILABLE == "True" ]]; then
        test_result "CUDA Available" "PASS" "GPU acceleration enabled"
    else
        test_result "CUDA Available" "FAIL" "CUDA not available"
    fi
    
    if [[ $VRAM_INFO != "Unknown" ]]; then
        test_result "VRAM Info" "PASS" "$VRAM_INFO"
    fi
    
else
    test_result "Health Endpoint Response" "FAIL" "HTTP $HTTP_CODE"
    echo "Response: $HEALTH_BODY"
    echo ""
fi

echo "================================================================"
echo "🔍 Test 4: GPU Status"
echo "================================================================"
echo ""

if command -v nvidia-smi &> /dev/null; then
    echo "📊 GPU Information:"
    nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader
    echo ""
    test_result "GPU Detection" "PASS" "nvidia-smi available"
else
    test_result "GPU Detection" "FAIL" "nvidia-smi not found"
fi

echo "================================================================"
echo "🔍 Test 5: Log Analysis"
echo "================================================================"
echo ""

if [[ -f /tmp/sdxl-api.log ]]; then
    LOG_SIZE=$(wc -l < /tmp/sdxl-api.log)
    test_result "Log File Exists" "PASS" "$LOG_SIZE lines"
    
    echo "📋 Recent Log Entries (last 10 lines):"
    echo "----------------------------------------------------------------"
    tail -10 /tmp/sdxl-api.log
    echo "----------------------------------------------------------------"
    echo ""
    
    # Check for errors
    ERROR_COUNT=$(grep -c "ERROR\|Failed\|Error" /tmp/sdxl-api.log || true)
    if [[ $ERROR_COUNT -gt 0 ]]; then
        test_result "Log Errors" "FAIL" "Found $ERROR_COUNT errors in log"
        echo "   Run: grep -i error /tmp/sdxl-api.log"
    else
        test_result "Log Errors" "PASS" "No errors in log"
    fi
    
else
    test_result "Log File Exists" "FAIL" "/tmp/sdxl-api.log not found"
fi

echo "================================================================"
echo "🔍 Test 6: Test Image Generation"
echo "================================================================"
echo ""

if [[ $MODEL_LOADED == "True" ]]; then
    echo "⏳ Generating test image (this will take 10-20 seconds)..."
    echo ""
    
    TEST_START=$(date +%s)
    
    GEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:7860/generate \
      -H "Content-Type: application/json" \
      -d '{
        "prompt": "a professional photograph of a red apple on a wooden table",
        "num_inference_steps": 15,
        "width": 512,
        "height": 512,
        "use_refiner": false,
        "use_face_restoration": false,
        "hires_fix": false
      }' 2>/dev/null)
    
    TEST_END=$(date +%s)
    TEST_DURATION=$((TEST_END - TEST_START))
    
    GEN_HTTP_CODE=$(echo "$GEN_RESPONSE" | tail -1)
    GEN_BODY=$(echo "$GEN_RESPONSE" | head -n -1)
    
    if [[ $GEN_HTTP_CODE == "200" ]]; then
        GEN_SUCCESS=$(echo "$GEN_BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
        IMAGE_LENGTH=$(echo "$GEN_BODY" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('image', '')))" 2>/dev/null)
        RESOLUTION=$(echo "$GEN_BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('final_resolution', 'Unknown'))" 2>/dev/null)
        
        if [[ $GEN_SUCCESS == "True" ]] && [[ $IMAGE_LENGTH -gt 1000 ]]; then
            test_result "Image Generation" "PASS" "Generated in ${TEST_DURATION}s, Size: $IMAGE_LENGTH bytes, Resolution: $RESOLUTION"
            
            # Save sample image for inspection
            echo "$GEN_BODY" | python3 -c "import sys, json, base64; img=json.load(sys.stdin)['image'].split(',')[1]; open('/tmp/sdxl-test.png', 'wb').write(base64.b64decode(img))" 2>/dev/null && \
            echo "   💾 Sample saved to: /tmp/sdxl-test.png" || true
            
        else
            test_result "Image Generation" "FAIL" "Success: $GEN_SUCCESS, Image length: $IMAGE_LENGTH"
        fi
    else
        test_result "Image Generation" "FAIL" "HTTP $GEN_HTTP_CODE"
        echo "Response: ${GEN_BODY:0:200}"
    fi
else
    echo "⏭️  Skipping image generation test (models not loaded yet)"
    echo "   Wait for models to finish downloading, then run this script again"
    echo ""
fi

echo "================================================================"
echo "🔍 Test 7: Performance Metrics"
echo "================================================================"
echo ""

if [[ -f /tmp/sdxl-test.png ]]; then
    IMAGE_FILE_SIZE=$(ls -lh /tmp/sdxl-test.png | awk '{print $5}')
    test_result "Output Image Size" "PASS" "$IMAGE_FILE_SIZE"
fi

echo "📊 Performance Summary:"
if [[ -n $TEST_DURATION ]]; then
    echo "   Generation Time: ${TEST_DURATION}s (target: < 30s)"
    if [[ $TEST_DURATION -lt 30 ]]; then
        echo -e "   ${GREEN}✅ Within target${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Slower than target${NC}"
    fi
fi
echo ""

echo "================================================================"
echo "📊 Verification Summary"
echo "================================================================"
echo ""
echo -e "${GREEN}✅ Passed: $SUCCESS_COUNT${NC}"
echo -e "${RED}❌ Failed: $FAIL_COUNT${NC}"
echo ""

if [[ $FAIL_COUNT -eq 0 ]]; then
    echo "================================================================"
    echo -e "${GREEN}🎉 All tests passed! SDXL is working correctly!${NC}"
    echo "================================================================"
    echo ""
    echo "✅ Next Steps:"
    echo "   1. Test from local machine via SSH tunnel"
    echo "   2. Test from application"
    echo "   3. Compare quality with SD v1.5"
    echo ""
    exit 0
else
    echo "================================================================"
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
    echo "================================================================"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   1. Check logs: tail -f /tmp/sdxl-api.log"
    echo "   2. Verify models finished downloading"
    echo "   3. Check disk space: df -h"
    echo "   4. Check GPU: nvidia-smi"
    echo ""
    if [[ $MODEL_LOADED != "True" ]]; then
        echo "ℹ️  Models may still be downloading. Wait and re-run this script."
        echo ""
    fi
    exit 1
fi

