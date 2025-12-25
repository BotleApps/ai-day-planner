# AI Day Planner

A modern, cross-platform day planner application built with React, Next.js, and TypeScript. Features a beautiful UI with light/dark mode support and MongoDB integration.

## Features

- 🎨 **Beautiful Modern UI** - Clean, intuitive interface with smooth animations
- 🌓 **Light & Dark Modes** - Seamless theme switching
- 📱 **Cross-Platform** - Works on Web, iOS, and Android
- ☁️ **Cloud-Ready** - Deployed on Vercel with MongoDB Atlas
- ⚡ **Fast & Responsive** - Built with Next.js 16 and TypeScript
- ✅ **Task Management** - Create, complete, and delete tasks with ease

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **Deployment**: Vercel
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MongoDB Atlas account (or local MongoDB instance)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/BotleApps/ai-day-planner.git
cd ai-day-planner
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Update `MONGODB_URI` with your MongoDB connection string

```bash
cp .env.example .env.local
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
MONGODB_URI=your_mongodb_connection_string
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add the `MONGODB_URI` environment variable in Vercel project settings
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### MongoDB Setup

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a database user
3. Get your connection string
4. Add it to your environment variables

## Building for Mobile

This app is built with Next.js and can be wrapped with Capacitor or similar tools for iOS and Android:

### Option 1: Using Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add ios
npx cap add android
npm run build
npx cap sync
```

### Option 2: Progressive Web App (PWA)

The app can also be installed as a PWA on mobile devices directly from the browser.

## Project Structure

```
ai-day-planner/
├── app/
│   ├── api/
│   │   └── tasks/
│   │       └── route.ts      # Task API endpoints
│   ├── layout.tsx            # Root layout with theme provider
│   ├── page.tsx              # Main page component
│   └── globals.css           # Global styles
├── components/
│   ├── task-form.tsx         # Task creation form
│   ├── task-item.tsx         # Individual task component
│   ├── theme-provider.tsx    # Theme context provider
│   └── theme-toggle.tsx      # Dark/light mode toggle
├── lib/
│   └── mongodb.ts            # MongoDB connection utility
└── public/                   # Static assets
```

## API Routes

### GET /api/tasks
Fetch all tasks

### POST /api/tasks
Create a new task
```json
{
  "title": "Task title",
  "description": "Task description",
  "time": "14:30"
}
```

### PUT /api/tasks
Update a task
```json
{
  "id": "task_id",
  "completed": true
}
```

### DELETE /api/tasks?id=task_id
Delete a task

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For support, please open an issue in the GitHub repository.
