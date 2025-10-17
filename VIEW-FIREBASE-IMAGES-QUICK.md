# View Firebase Storage Images - Quick Reference

## 🎯 Easiest Method (30 seconds)

### Firebase Console
1. Go to: https://console.firebase.google.com/
2. Select your project
3. Click **Storage** → **Files**
4. Browse: `users/{userId}/posts/` for generated images

✅ **No setup required!**

---

## 📊 Script Method (Full Report)

### Step 1: Create `.env.local` in carrot folder
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

**Get these from:** Firebase Console → Settings → Service Accounts → Generate Private Key

### Step 2: Run the Script
```bash
cd carrot
node scripts/list-all-images.mjs
```

### Step 3: View Results
Opens two files:
- `firebase-storage-report.json` - Full details with download URLs
- `firebase-storage-summary.txt` - Human-readable summary

Shows:
- ✅ Total files and storage used
- ✅ Files per user
- ✅ Largest files
- ✅ Download URLs for each image

---

## 📁 Where Images Are Stored

```
users/
  └── {userId}/
      ├── posts/              ← SDXL generated images
      ├── staged/             ← Onboarding photos
      └── profile/            ← Profile pictures
```

---

## 🆘 Quick Help

**Can't find images?**
- Check Firebase Console Storage tab
- Verify images were actually uploaded (check browser console)
- Run the list script to see all files

**Script won't run?**
- Missing `.env.local` file
- Wrong Firebase credentials
- Not in `carrot/` directory

**Want to download images?**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Download
firebase storage:download gs://your-bucket.appspot.com/path/to/image.png
```

---

## 💰 Check Storage Usage

Firebase Console → Storage → Usage tab
- See total storage used
- Compare to your plan limit
- Free tier: 5GB

---

**Recommendation:** Start with Firebase Console (easiest), then use the script if you need detailed reports!

