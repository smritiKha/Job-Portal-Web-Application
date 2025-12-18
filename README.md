# 🚀 Modern Job Portal

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A modern, full-stack job portal application built with Next.js, TypeScript, and MongoDB, featuring a clean, professional interface with dark mode support.

## ✨ Features

### 👨‍💼 Job Seekers
- 🔍 Advanced job search with filters
- 📄 Resume and cover letter management
- 🎯 AI-powered skill gap analysis
- 📊 Application tracking dashboard
- 🎓 Training and certification recommendations

### 👔 Employers
- 📢 Create and manage job postings
- 🔍 Find and filter candidates
- 💬 Built-in messaging system
- 📅 Interview scheduling
- 📊 Analytics dashboard

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI, Shadcn UI
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with secure HTTP-only cookies
- **File Storage**: Local filesystem (S3 compatible)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB instance
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone [https://github.com/yourusername/job-portal-system.git](https://github.com/yourusername/job-portal-system.git)
cd job-portal-system

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
pnpm dev
