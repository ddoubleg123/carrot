# Discovery System Setup Guide

## 🚨 Current Issue: Discovery Error

The "Discovery Error" on the group level page is caused by missing environment configuration.

## 🔧 Required Environment Variables

Create a `.env.local` file in the carrot directory with:

```bash
# DeepSeek API Configuration (REQUIRED)
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/carrot_db"

# NextAuth Configuration
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000
```

## 🔑 Getting DeepSeek API Key

1. Go to [DeepSeek Platform](https://platform.deepseek.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and add it to your `.env.local` file

## 🧪 Testing the Fix

After setting up the environment variables:

1. Restart your development server
2. Go to a patch page (e.g., `/patch/israel-14`)
3. Click "Start Content Discovery" button
4. The system should now successfully search for content

## 🔄 What the Discovery System Does

1. **AI Search**: Uses DeepSeek to find relevant content about the patch topic
2. **Content Enrichment**: Extracts summaries, key points, and metadata
3. **Source Validation**: Ranks sources by relevance and authority
4. **Real-time Updates**: Continuously polls for new content

## 🚀 Expected Behavior After Fix

- ✅ No more "Discovery Error" messages
- ✅ AI-powered content discovery working
- ✅ Rich content cards with summaries and key points
- ✅ Real-time content updates
- ✅ Proper source attribution and ranking

## 🔍 Troubleshooting

If you still see errors after setup:

1. Check that `DEEPSEEK_API_KEY` is correctly set
2. Verify the API key has sufficient credits
3. Check browser console for detailed error messages
4. Ensure the patch exists in the database
