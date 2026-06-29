# Deployment Guide

This guide will help you deploy the AI Day Planner to production.

## Prerequisites

- GitHub account
- Vercel account (free tier available)
- MongoDB Atlas account (free tier available)

## Step 1: Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account or sign in
3. Create a new cluster (free tier is fine)
4. Click "Connect" on your cluster
5. Add a connection IP address:
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add Vercel's IP addresses
6. Create a database user:
   - Click "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create a username and strong password
   - Set privileges to "Read and write to any database"
7. Get your connection string:
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `ai-day-planner`

Your connection string should look like:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/ai-day-planner?retryWrites=true&w=majority
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Sign in with your GitHub account
4. Click "Add New Project"
5. Import your `ai-day-planner` repository
6. Configure project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `.next`
7. Add environment variables:
   - Click "Environment Variables"
   - Add `MONGODB_URI` with your MongoDB connection string
8. Click "Deploy"

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
cd /path/to/ai-day-planner
vercel
```

4. Follow the prompts:
   - Set up and deploy? Yes
   - Which scope? (choose your account)
   - Link to existing project? No
   - What's your project's name? ai-day-planner
   - In which directory is your code located? ./
   - Want to override settings? No

5. Add environment variable:
```bash
vercel env add MONGODB_URI
```
Paste your MongoDB connection string when prompted.

6. Deploy to production:
```bash
vercel --prod
```

## Step 3: Verify Deployment

1. Visit your deployment URL (e.g., `ai-day-planner.vercel.app`)
2. Test the application:
   - Toggle between light and dark mode
   - Create a new task
   - Mark a task as complete
   - Delete a task
3. Check the browser console for any errors
4. Test on mobile devices

## Step 4: Custom Domain (Optional)

1. In Vercel dashboard, go to your project
2. Click "Settings" > "Domains"
3. Add your custom domain
4. Follow the instructions to configure DNS
5. Wait for DNS propagation (usually 5-60 minutes)

## Environment Variables

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/ai-day-planner` |

## Troubleshooting

### Build Fails

**Problem**: Build fails with "Cannot find module"
**Solution**: Ensure all dependencies are in `package.json`. Run `npm install` locally first.

**Problem**: Build fails with TypeScript errors
**Solution**: Run `npm run build` locally to see errors. Fix TypeScript issues.

### Database Connection Issues

**Problem**: "MongoServerError: Authentication failed"
**Solution**: 
- Verify username and password in connection string
- Ensure database user has correct permissions

**Problem**: "querySrv EREFUSED"
**Solution**:
- Check network access in MongoDB Atlas
- Verify connection string format
- Ensure MongoDB cluster is running

### Runtime Errors

**Problem**: "Failed to fetch tasks"
**Solution**:
- Check browser console for detailed errors
- Verify `MONGODB_URI` is set in Vercel
- Check MongoDB Atlas logs

**Problem**: Theme toggle not working
**Solution**:
- Clear browser cache
- Check browser console for errors
- Verify JavaScript is enabled

## Production Best Practices

1. **Security**
   - Never commit `.env.local` to git
   - Use strong database passwords
   - Restrict MongoDB network access to Vercel IPs only
   - Enable MongoDB authentication

2. **Performance**
   - Enable Vercel Edge Caching
   - Monitor Vercel Analytics
   - Use MongoDB indexes for better query performance

3. **Monitoring**
   - Set up Vercel monitoring
   - Monitor MongoDB Atlas metrics
   - Set up error tracking (e.g., Sentry)

4. **Backups**
   - Enable MongoDB Atlas automated backups
   - Regularly export data
   - Version control all code changes

## Updating the Application

1. Make changes locally
2. Test thoroughly with `npm run dev`
3. Commit and push to GitHub:
```bash
git add .
git commit -m "Description of changes"
git push
```
4. Vercel will automatically deploy the new version

## Rollback

If something goes wrong:

1. Go to Vercel dashboard
2. Select your project
3. Go to "Deployments"
4. Find the last working deployment
5. Click "..." > "Promote to Production"

## Cost Estimates

**Free Tier (Hobby)**
- Vercel: Free for personal projects
- MongoDB Atlas: 512 MB storage, free forever
- Total: $0/month

**Scaling Up**
- Vercel Pro: $20/month (more bandwidth, analytics)
- MongoDB Atlas M10: ~$57/month (2GB RAM, 10GB storage)
- Custom domain: ~$10-15/year (from domain registrar)

## Support

- Vercel Documentation: https://vercel.com/docs
- MongoDB Atlas Documentation: https://docs.atlas.mongodb.com
- Next.js Documentation: https://nextjs.org/docs
- Project Issues: https://github.com/BotleApps/ai-day-planner/issues

## Next Steps

After successful deployment:

1. ✅ Test all features in production
2. 📱 Set up mobile apps (see MOBILE_DEPLOYMENT.md)
3. 📊 Enable analytics
4. 🔒 Set up custom domain with HTTPS
5. 🎨 Customize branding and colors
6. 🤖 Add AI features (future enhancement)
