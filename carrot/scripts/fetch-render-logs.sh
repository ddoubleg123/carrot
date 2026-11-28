#!/bin/bash
# Bash script to fetch Render logs using Render CLI
# Usage: ./fetch-render-logs.sh [options]

SERVICE_NAME="carrot-app"
LINES=1000
OUTPUT_FILE=""
FILTER=""
TAIL=false
SINCE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --service)
            SERVICE_NAME="$2"
            shift 2
            ;;
        --lines)
            LINES="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --filter)
            FILTER="$2"
            shift 2
            ;;
        --tail)
            TAIL=true
            shift
            ;;
        --since)
            SINCE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if Render CLI is installed
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI is not installed."
    echo "Install it with: npm install -g render-cli"
    echo "Or visit: https://github.com/renderinc/cli"
    exit 1
fi

# Check if authenticated
echo "Checking Render CLI authentication..."
if ! render whoami &> /dev/null; then
    echo "❌ Not authenticated. Please run: render login"
    exit 1
fi
echo "✓ Authenticated"

# Generate output filename if not provided
if [ -z "$OUTPUT_FILE" ]; then
    TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
    OUTPUT_FILE="render-logs-${SERVICE_NAME}-${TIMESTAMP}.txt"
fi

# Build command
CMD="render logs --service $SERVICE_NAME"
if [ "$TAIL" = true ]; then
    CMD="$CMD --tail"
fi
if [ $LINES -gt 0 ]; then
    CMD="$CMD --lines $LINES"
fi
if [ -n "$SINCE" ]; then
    CMD="$CMD --since $SINCE"
fi

echo ""
echo "Fetching logs from service: $SERVICE_NAME"
echo "Command: $CMD"
echo "Output file: $OUTPUT_FILE"
echo ""

# Execute command
if [ "$TAIL" = true ]; then
    echo "Streaming logs (press Ctrl+C to stop)..."
    echo ""
    $CMD | tee "$OUTPUT_FILE"
else
    echo "Fetching logs..."
    $CMD > "$OUTPUT_FILE" 2>&1
    echo "✓ Logs saved to: $OUTPUT_FILE"
    
    # Filter if requested
    if [ -n "$FILTER" ]; then
        FILTERED_FILE="${OUTPUT_FILE%.txt}-filtered.txt"
        grep -i "$FILTER" "$OUTPUT_FILE" > "$FILTERED_FILE"
        echo "✓ Filtered logs saved to: $FILTERED_FILE"
        echo "  Filter pattern: $FILTER"
    fi
    
    # Show stats
    LINE_COUNT=$(wc -l < "$OUTPUT_FILE")
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo ""
    echo "Log file stats:"
    echo "  Lines: $LINE_COUNT"
    echo "  Size: $FILE_SIZE"
fi

echo ""
echo "Done!"
