# Vibe 🎨✨

> **Build applications and websites through natural conversation with AI**

Vibe is an AI-powered code generation platform that transforms your ideas into functional code through simple chat interactions. Describe what you want to build, and Vibe's intelligent agents will generate, execute, and deploy your code in real-time.

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![tRPC](https://img.shields.io/badge/tRPC-11.4-2596be?style=flat&logo=trpc)](https://trpc.io/)
[![Prisma](https://img.shields.io/badge/Prisma-6.11-2d3748?style=flat&logo=prisma)](https://www.prisma.io/)

---

## 🌟 Features

### 🤖 AI-Powered Code Generation
- **Multi-Model Support**: Choose from OpenAI GPT-4/5, Google Gemini 2.5/3, DeepSeek, Qwen, Llama, and NVIDIA models
- **Natural Language Interface**: Simply describe what you want to build in plain English
- **Context-Aware Generation**: Upload images alongside prompts for visual context
- **Real-Time Execution**: Code runs in secure E2B sandboxes with instant feedback

### 🎨 HTML/Web Builder
- **Visual Editor**: Drag-and-drop interface for building web pages
- **Live Preview**: See your changes in real-time
- **Properties Panel**: Fine-tune styles and properties with an intuitive UI
- **Export & Deploy**: Generate production-ready HTML/CSS

### 💼 Project Management
- **Multiple Projects**: Create and manage unlimited projects
- **Conversation History**: Full chat history preserved for each project
- **Fragment Storage**: All generated code saved with metadata
- **Version Control**: Track changes and iterations

### 🔐 Enterprise-Ready
- **Authentication**: Secure user management with Clerk
- **Usage Tracking**: Built-in credit system with tiered plans
  - **Free Tier**: 15 credits/week
  - **Pro Tier**: 700 credits/week
- **Rate Limiting**: Fair usage policies to ensure system stability
- **Secure Execution**: Sandboxed code execution for safety

---

## 🛠️ Technology Stack

### Frontend
- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[React 19](https://react.dev/)** - UI library
- **[TypeScript 5](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS 4](https://tailwindcss.com/)** - Utility-first CSS
- **[Radix UI](https://www.radix-ui.com/)** - Accessible component primitives
- **[TanStack Query v5](https://tanstack.com/query)** - Data fetching & caching
- **[React Hook Form](https://react-hook-form.com/)** + **[Zod](https://zod.dev/)** - Form validation

### Backend
- **[tRPC 11](https://trpc.io/)** - End-to-end typesafe APIs
- **[Prisma 6](https://www.prisma.io/)** - Next-generation ORM
- **[PostgreSQL](https://www.postgresql.org/)** - Relational database
- **[Inngest](https://www.inngest.com/)** - Event-driven background jobs

### AI & Execution
- **[@inngest/agent-kit](https://www.inngest.com/docs/agent-kit)** - AI agent framework
- **[@google/generative-ai](https://ai.google.dev/)** - Gemini integration
- **[E2B Code Interpreter](https://e2b.dev/)** - Secure sandbox execution
- **[OpenAI](https://openai.com/)** - GPT models

### Infrastructure
- **[Clerk](https://clerk.com/)** - Authentication & user management
- **[UploadThing](https://uploadthing.com/)** - File uploads
- **[Vercel](https://vercel.com/)** - Hosting & deployment

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** or **pnpm** or **yarn**
- **PostgreSQL** database
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Naveen-671/vibe.git
   cd vibe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/vibe"

   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

   # Inngest
   INNGEST_EVENT_KEY=your_inngest_event_key
   INNGEST_SIGNING_KEY=your_inngest_signing_key

   # AI Models
   OPENAI_API_KEY=your_openai_api_key
   GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

   # E2B Sandbox
   E2B_API_KEY=your_e2b_api_key

   # UploadThing
   UPLOADTHING_TOKEN=your_uploadthing_token

   # Next.js
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate

   # Run migrations
   npx prisma migrate dev

   # (Optional) Seed the database
   npx prisma db seed
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the application.

6. **Start Inngest dev server** (in a separate terminal)
   ```bash
   npm run inngest:dev
   ```

---

## 📖 Usage

### Creating Your First Project

1. **Sign up** or **Sign in** using the authentication page
2. **Create a new project** from the home dashboard
3. **Enter a prompt** describing what you want to build:
   - "Create a todo list app with React"
   - "Build a landing page for a coffee shop"
   - "Make a calculator with a modern UI"
4. **Select an AI model** from the dropdown (GPT-4, Gemini, etc.)
5. **Send your message** and watch as the AI generates your code
6. **View the result** in the live preview panel
7. **Iterate and refine** by sending follow-up messages

### Using the HTML Builder

1. Navigate to the **HTML Builder** from the home page
2. Use the **visual editor** to drag and drop components
3. Customize styles in the **properties panel**
4. See changes in **real-time** in the preview
5. Export your HTML/CSS when ready

### Model Selection

Choose the right model for your task:
- **GPT-4o/GPT-5**: Best for complex logic and full applications
- **Gemini 2.5 Pro**: Great for large context and multi-modal tasks
- **DeepSeek/Qwen**: Cost-effective for simpler tasks
- **Gemini 2.5 Flash**: Fastest for quick prototypes

---

## 🗂️ Project Structure

```
vibe/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (home)/              # Home & public pages
│   │   ├── projects/[projectId]/ # Project detail pages
│   │   └── api/                 # API routes (tRPC, Inngest, etc.)
│   ├── modules/                 # Feature modules
│   │   ├── home/                # Home page components
│   │   ├── projects/            # Project management
│   │   ├── messages/            # Message handling
│   │   ├── html-builder/        # HTML builder feature
│   │   └── usage/               # Usage tracking
│   ├── components/              # Shared UI components
│   │   └── ui/                  # Radix UI components
│   ├── trpc/                    # tRPC configuration
│   ├── inngest/                 # AI agent & event handlers
│   ├── lib/                     # Utilities & database client
│   ├── hooks/                   # React hooks
│   └── server/                  # Server utilities
├── prisma/                      # Database schema & migrations
├── public/                      # Static assets
└── sandbox-templates/           # E2B sandbox templates
```

---

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run inngest:dev  # Start Inngest dev server
```

### Database Commands

```bash
npx prisma studio           # Open Prisma Studio (database GUI)
npx prisma migrate dev      # Create & apply migrations
npx prisma migrate reset    # Reset database
npx prisma db seed          # Seed database
npx prisma generate         # Generate Prisma client
```

### Code Style

This project follows standard TypeScript and React conventions:
- Use TypeScript for all new files
- Follow existing component patterns
- Use Tailwind CSS for styling
- Implement proper error handling
- Write meaningful commit messages

---

## 🏗️ Architecture

### Database Schema

**Project** → hasMany → **Message** → hasOne → **Fragment**

**Usage** → tracks user credits and quotas

### Request Flow

1. User sends message via `MessageForm`
2. tRPC mutation creates `Message` record
3. Inngest event `code-agent/run` triggered
4. AI agent processes prompt with selected model
5. Code executes in E2B sandbox
6. Result stored as `Fragment` with sandbox URL
7. UI updates via React Query cache

### AI Agent Architecture

- **Agent Kit**: Inngest agent framework
- **Model Abstraction**: Unified interface for multiple LLMs
- **Prompt Engineering**: Optimized prompts in `src/prompt.ts`
- **Error Handling**: Graceful failures with user feedback
- **Usage Tracking**: Deducts credits on each generation

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Getting Started

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Commit with descriptive messages**
   ```bash
   git commit -m "Add amazing feature"
   ```
5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Contribution Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Keep PRs focused and atomic
- Write clear commit messages
- Ensure all tests pass before submitting

### Areas for Contribution

- 🐛 Bug fixes
- ✨ New features
- 📝 Documentation improvements
- 🎨 UI/UX enhancements
- 🧪 Test coverage
- ♿ Accessibility improvements
- 🌍 Internationalization

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) team for the amazing framework
- [Vercel](https://vercel.com/) for hosting and deployment platform
- [Clerk](https://clerk.com/) for authentication infrastructure
- [E2B](https://e2b.dev/) for secure code execution
- [Inngest](https://www.inngest.com/) for event-driven architecture
- All the open-source contributors whose libraries power this project

---

## 📞 Support

Need help? Here's how to get support:

- 📧 **Email**: [Create an issue](https://github.com/Naveen-671/vibe/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Naveen-671/vibe/discussions)
- 🐛 **Bug Reports**: [Issue Tracker](https://github.com/Naveen-671/vibe/issues/new)
- 💡 **Feature Requests**: [Feature Request Form](https://github.com/Naveen-671/vibe/issues/new)

---

## 🚧 Roadmap

- [ ] **Multi-language support** - Generate code in Python, Java, Go, etc.
- [ ] **Collaborative editing** - Real-time collaboration on projects
- [ ] **Templates library** - Pre-built templates for common use cases
- [ ] **API access** - RESTful API for programmatic access
- [ ] **Mobile app** - Native iOS and Android applications
- [ ] **Plugin system** - Extensible architecture for community plugins
- [ ] **Advanced debugging** - Step-through debugging in the sandbox
- [ ] **Export to GitHub** - Direct integration with GitHub repositories

---

## 📊 Stats

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

<div align="center">

**[Website](https://vibe-app.com)** • **[Documentation](https://github.com/Naveen-671/vibe/wiki)** • **[Twitter](https://twitter.com/vibe)** • **[Discord](https://discord.gg/vibe)**

Made with ❤️ by the Vibe team

</div>
