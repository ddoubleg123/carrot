const { PrismaClient } = require('@prisma/client');

async function getLatestThumbnail() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Connecting to database...');
    
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');
    
    // Get total posts
    const totalPosts = await prisma.post.count();
    console.log(`📊 Total posts: ${totalPosts}`);
    
    // Get posts with thumbnails
    const postsWithThumbnails = await prisma.post.count({
      where: {
        thumbnailUrl: {
          not: null
        }
      }
    });
    console.log(`🖼️ Posts with thumbnails: ${postsWithThumbnails}`);
    
    if (postsWithThumbnails === 0) {
      console.log('❌ No posts with thumbnails found');
      return;
    }
    
    // Get the latest post with thumbnail
    const latestPost = await prisma.post.findFirst({
      where: {
        thumbnailUrl: {
          not: null
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (latestPost) {
      console.log('\n🎯 LATEST THUMBNAIL FOUND:');
      console.log('=====================================');
      console.log(`Post ID: ${latestPost.id}`);
      console.log(`User ID: ${latestPost.userId}`);
      console.log(`Created: ${latestPost.createdAt}`);
      console.log(`Content: ${latestPost.content?.substring(0, 100)}...`);
      console.log(`Video URL: ${latestPost.videoUrl}`);
      console.log(`Thumbnail URL: ${latestPost.thumbnailUrl}`);
      
      // Parse Firebase Storage URL
      if (latestPost.thumbnailUrl) {
        try {
          const url = new URL(latestPost.thumbnailUrl);
          const pathMatch = url.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
          if (pathMatch) {
            console.log(`Firebase Bucket: ${pathMatch[1]}`);
            console.log(`Storage Path: ${decodeURIComponent(pathMatch[2])}`);
          }
        } catch (e) {
          console.log('Could not parse Firebase URL');
        }
      }
      
      // Check MediaAsset table for any thumbnails
      const mediaAsset = await prisma.mediaAsset.findFirst({
        where: {
          thumbUrl: {
            not: null
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (mediaAsset) {
        console.log(`MediaAsset Thumb URL: ${mediaAsset.thumbUrl}`);
        console.log(`MediaAsset Thumb Path: ${mediaAsset.thumbPath}`);
      }
      
    } else {
      console.log('❌ No latest post found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getLatestThumbnail();
