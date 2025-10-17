# 📚 Documentation Index

**Last Updated:** October 14, 2025

This directory contains all project documentation organized by topic.

---

## 🔄 **Session Handoffs** (Start Here for New Chats!)

📁 **Location:** `docs/handoffs/`

**If you're a new chat session, start here:**
- **`2025-10-14-START-HERE.md`** - Quick start for new sessions
- **`2025-10-14-HANDOFF.md`** - Complete handoff from previous session

These documents contain everything needed to continue where the previous session left off.

---

## 🎨 **SDXL Image Generation**

📁 **Location:** `docs/sdxl/`

Complete guides for the upgraded SDXL image generation system:

### **Feature Documentation:**
1. **`CODEFORMER-FACE-RESTORATION.md`**
   - How CodeFormer works
   - Implementation details
   - Quality improvements
   - Troubleshooting

2. **`REALESRGAN-NEURAL-UPSCALING.md`**
   - RealESRGAN neural network upscaling
   - Comparison with traditional methods
   - Integration guide
   - Performance notes

3. **`HIRES-FIX-GUIDE.md`**
   - Two-pass hires fix implementation
   - Quality comparison (768→1536)
   - Configuration options
   - Best practices

### **Quick Reference:**
- **API File:** `upgraded-sdxl-api.py` (root directory)
- **Frontend:** `carrot/src/lib/media/aiImageGenerator.ts`
- **Test Page:** http://localhost:3005/test-deepseek-images

---

## 📖 **Main Project Docs**

📁 **Location:** Project root

### **Getting Started:**
- **`START-HERE.md`** - Quick start guide (2 commands to launch)
- **`QUICK-START-UPGRADED-API.md`** - Detailed step-by-step guide
- **`CURRENT-STATUS.md`** - Complete project status

### **Reference:**
- **`SESSION-SUMMARY.md`** - Summary of what was done
- **`TEST-UPGRADED-API.md`** - Testing and troubleshooting
- **`LAUNCH-CHECKLIST.md`** - Step-by-step launch checklist
- **`QUICK-REFERENCE.md`** - One-page cheat sheet

---

## 🔍 **Finding What You Need**

### **I'm a new chat session:**
→ Read `docs/handoffs/2025-10-14-START-HERE.md`

### **I want to launch the system:**
→ Read `START-HERE.md` (root)

### **I want to understand SDXL features:**
→ Browse `docs/sdxl/` folder

### **I need to troubleshoot:**
→ Read `TEST-UPGRADED-API.md` (root)

### **I want project status:**
→ Read `CURRENT-STATUS.md` (root)

---

## 📊 **Documentation Status**

| Category | Status | Location |
|----------|--------|----------|
| Session Handoffs | ✅ Complete | `docs/handoffs/` |
| SDXL Features | ✅ Complete | `docs/sdxl/` |
| Getting Started | ✅ Complete | Root |
| Testing Guides | ✅ Complete | Root |
| Troubleshooting | ✅ Complete | Root |

---

## 🎯 **Current Project Status**

**Overall:** 80% Complete

**Completed:**
- ✅ All code written
- ✅ All documentation created
- ✅ Frontend working
- ✅ SDXL models cached

**Remaining:**
- ⚠️ Fix Python dependencies on Vast.ai
- ⏳ Final testing
- ⏳ Quality verification

**See:** `CURRENT-STATUS.md` for detailed status

---

## 📝 **Documentation Guidelines**

### **Naming Convention:**
- Session handoffs: `YYYY-MM-DD-TITLE.md`
- Feature docs: `FEATURE-NAME.md` (uppercase)
- Guides: `descriptive-name.md` (lowercase with dashes)

### **Organization:**
- `/docs/handoffs/` - Session continuity documents
- `/docs/sdxl/` - SDXL-specific technical docs
- `/docs/` - General project documentation
- Root - Quick reference and launch guides

---

## 🔗 **External Resources**

- **SDXL**: https://github.com/Stability-AI/generative-models
- **CodeFormer**: https://github.com/sczhou/CodeFormer
- **RealESRGAN**: https://github.com/xinntao/Real-ESRGAN
- **Diffusers**: https://github.com/huggingface/diffusers

---

**Questions?** Check the appropriate document above or see the handoff docs for current status.
