#!/bin/bash

# DeepSeek Coder Router - cURL Examples
# Phase 0: Local Pilot

BASE_URL="http://localhost:8080"

echo "🧪 DeepSeek Coder Router - cURL Examples"
echo "========================================"

# Example 1: Editor Task
echo ""
echo "1. Editor Task (Grammar Fix)"
echo "----------------------------"
curl -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-Task-Type: editor" \
  -d '{
    "messages": [
      {"role": "user", "content": "Fix this: The code is not working good and it should be fixed."}
    ],
    "max_tokens": 100,
    "temperature": 0.2
  }' | jq '.'

# Example 2: Refactor Task
echo ""
echo "2. Refactor Task (Extract Hook)"
echo "-------------------------------"
curl -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-Task-Type: refactor_hook@v1" \
  -d '{
    "messages": [
      {"role": "user", "content": "Extract this state into a custom hook:\n\nconst [count, setCount] = useState(0);\nconst [loading, setLoading] = useState(false);\nconst [error, setError] = useState(null);\n\nconst increment = () => setCount(c => c + 1);\nconst decrement = () => setCount(c => c - 1);\nconst reset = () => setCount(0);"}
    ],
    "max_tokens": 500,
    "temperature": 0.2
  }' | jq '.'

# Example 3: Tests Task
echo ""
echo "3. Tests Task (Generate Jest Tests)"
echo "----------------------------------"
curl -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-Task-Type: explain_tests@v1" \
  -d '{
    "messages": [
      {"role": "user", "content": "Create tests for this function:\n\nfunction validateEmail(email) {\n  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n  return regex.test(email);\n}"}
    ],
    "max_tokens": 800,
    "temperature": 0.2
  }' | jq '.'

# Example 4: Chat Task
echo ""
echo "4. Chat Task (General Help)"
echo "---------------------------"
curl -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-Task-Type: chat" \
  -d '{
    "messages": [
      {"role": "user", "content": "How do I optimize React performance?"}
    ],
    "max_tokens": 300,
    "temperature": 0.2
  }' | jq '.'

# Example 5: RAG Code Task (Phase 1+)
echo ""
echo "5. RAG Code Task (With Context)"
echo "-------------------------------"
curl -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-Task-Type: rag-code" \
  -H "X-Context-Refs: carrot@main,src/components/Button.tsx" \
  -d '{
    "messages": [
      {"role": "user", "content": "How do I use the Button component?"}
    ],
    "max_tokens": 400,
    "temperature": 0.2
  }' | jq '.'

# Example 6: High Risk Task (Uses 16B Model)
echo ""
echo "6. High Risk Task (Refactoring)"
echo "-------------------------------"
curl -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-Task-Type: refactor_hook@v1" \
  -H "X-Risk-Level: high" \
  -d '{
    "messages": [
      {"role": "user", "content": "Refactor this complex component into hooks:\n\nconst ComplexForm = () => {\n  const [formData, setFormData] = useState({});\n  const [errors, setErrors] = useState({});\n  const [isSubmitting, setIsSubmitting] = useState(false);\n  const [touched, setTouched] = useState({});\n  \n  const validateField = (name, value) => {\n    // Complex validation logic\n  };\n  \n  const handleSubmit = async (e) => {\n    // Complex submit logic\n  };\n  \n  // More complex logic...\n};"}
    ],
    "max_tokens": 1000,
    "temperature": 0.2
  }' | jq '.'

# Example 7: CI Task (Quick Fixes)
echo ""
echo "7. CI Task (Quick Fixes)"
echo "------------------------"
curl -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "X-Task-Type: ci" \
  -d '{
    "messages": [
      {"role": "user", "content": "Fix this linting error: \'unused variable \'x\'\'"}
    ],
    "max_tokens": 200,
    "temperature": 0.1
  }' | jq '.'

# Example 8: Model List
echo ""
echo "8. Available Models"
echo "------------------"
curl -s "$BASE_URL/v1/models" | jq '.'

# Example 9: Health Check
echo ""
echo "9. Health Check"
echo "---------------"
curl -s "$BASE_URL/health" | jq '.'

echo ""
echo "✅ All examples completed!"
echo ""
echo "📝 Notes:"
echo "- Editor tasks use 6.7B model for speed"
echo "- Refactor/tests tasks use 16B model for quality"
echo "- High risk tasks always use 16B model"
echo "- Responses are cached for 1 hour"
echo "- Rate limit: 100 requests per 15 minutes"
