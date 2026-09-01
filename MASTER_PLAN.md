# Coding Harness: Master Project Plan & Workflow

> [!NOTE]
> This master document outlines the full workflow, system architecture, technology stack, and a highly detailed phase-wise implementation plan for the **Coding Harness** project.

## 1. Project Overview & Objective
**Coding Harness** is an automated platform where an AI agent acts as a controlled developer within an isolated environment. The main objective is for a user to submit a task and a repository, and the system autonomously produces a tested, working code change with full logs and a Git diff. 
It differs from standard chatbots by actually executing plans—cloning repositories, running real commands and tests inside Docker, observing real output, and iterating until successful.

---

## 2. Complete Project Workflow
The following represents the end-to-end lifecycle of a coding task within the harness:

1. **User Task & Repository Input:** User submits a task description and a repository (URL or ZIP upload) via the Frontend.
2. **Repository Setup & Cloning:** The Git & Repository Manager on the Backend clones the repository into an isolated, temporary workspace.
3. **Project Analysis:** The system scans the file structure, dependencies, and language/framework to build context for the AI.
4. **AI Agent Planning:** The LLM generates a step-by-step plan of files to inspect and edit.
5. **File & Tool Operations:** The AI Agent calls read/write/search tools exposed by the Tool Execution Layer.
6. **Code Modification:** The Agent applies exact code edits to the working copy of the repository.
7. **Sandbox/Docker Execution:** The Tool Execution Layer passes commands to the Sandbox Environment. All builds, tests, and commands run inside this isolated, resource-limited Docker container.
8. **Build & Test:** The project is built, and its test suite (or task-specific checks) is executed.
9. **Error Detection:** Output and logs are parsed to detect build or test failures.
10. **AI Fix & Iteration:** On failure, the agent receives the error context, revises the code, and loops back to Build & Test.
11. **Validation:** On success, results are validated against the original task requirements.
12. **Git Diff & Commit:** A Git diff is generated and optionally committed to a new branch.
13. **Final Result:** The user receives the modified code, the diff, execution logs, and a final status report.

---

## 3. System Architecture & Technology Stack

### Overall Technology Stack
| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js, TypeScript, Tailwind CSS | Web UI, task submission, live progress viewing |
| **Backend** | Node.js (Express) | API server, orchestration, session management |
| **AI** | OpenAI API / Gemini API | Coding agent reasoning and planning |
| **Execution** | Docker Engine API | Isolated sandboxed code execution |
| **Database** | PostgreSQL | Persistent data storage (users, tasks, sessions) |
| **Queue** | Redis + BullMQ | Background job/task processing |
| **Version Control**| Git + GitHub API | Cloning, diffing, branching |
| **Auth** | JWT / OAuth | User authentication |

### Security & Isolation
- **Docker Sandboxing:** Code strictly runs inside containers, completely isolated from the host.
- **Resource Limits:** CPU, memory, and execution-time limits prevent runaway processes.
- **Restricted Permissions:** Containers run as non-root users.
- **Controlled Command Execution:** Agents can only access a whitelisted set of tools.
- **Secret Protection:** API keys and credentials are never exposed inside the sandbox.

---

## 4. Phase-Wise Implementation Plan

The project will be built in **6 distinct phases**. Each phase is detailed with specific tasks, dependencies, and deliverables.

### Phase 1: Foundation & Project Setup
**Objective:** Initialize the project monorepo structure, set up the database schema, and create the basic server skeleton.

- **Tech Stack & Libraries:** Node.js, Express, TypeScript, PostgreSQL, Prisma (ORM), `dotenv`, `cors`, `helmet`.
- **Detailed Tasks:**
  1. **Monorepo Initialization:**
     - Initialize a monorepo using npm workspaces or Turborepo.
     - Set up ESLint and Prettier configs for uniform code formatting across all packages.
     - Create `/frontend`, `/backend`, and `/shared` packages.
  2. **Database Setup (PostgreSQL):**
     - Spin up a local PostgreSQL instance (via Docker Compose).
     - Initialize Prisma in the backend (`npx prisma init`).
     - Define Database Schema in `schema.prisma`:
       - `User`: id, email, passwordHash, createdAt.
       - `Task`: id, userId, repoUrl, status (PENDING, RUNNING, COMPLETED, FAILED), prompt, createdAt.
       - `Session`: id, taskId, logs, resultDiff, startedAt, finishedAt.
     - Run initial Prisma migrations (`npx prisma migrate dev`).
  3. **Backend Server Skeleton:**
     - Setup Express with global middlewares (`cors`, `express.json()`, `helmet`).
     - Create a `/health` endpoint to verify the server is running.
     - Setup structured logging using `winston` or `pino`.
  4. **Shared Types:**
     - Define shared TypeScript interfaces in the `/shared` package for Tasks, Users, and API payloads to ensure frontend/backend consistency.

- **Proposed File Structure:**
  ```text
  /coding-harness
  ├── /backend
  │   ├── /src
  │   │   ├── /config       # Environment variables, DB config
  │   │   ├── /controllers  # Route controllers (health, auth stubs)
  │   │   ├── /routes       # Express routes
  │   │   ├── /prisma       # Prisma schema and migrations
  │   │   └── server.ts     # Express entry point
  │   ├── package.json
  │   └── tsconfig.json
  ├── /frontend             # Placeholder for Next.js app
  ├── /shared               # Shared TypeScript types/interfaces
  │   ├── src/types.ts
  │   └── package.json
  ├── package.json          # Monorepo root
  └── turbo.json            # (Optional) Turborepo config
  ```

### Phase 2: Core Backend, Git Manager & Queue System
**Objective:** Build task orchestration, handle asynchronous background jobs, and manage Git operations like cloning and diffing.

- **Tech Stack & Libraries:** Redis, BullMQ, Node.js `child_process`, `simple-git`, `jsonwebtoken`, `bcrypt`.
- **Detailed Tasks:**
  1. **Queue System Setup (Redis + BullMQ):**
     - Set up Redis locally (Docker Compose).
     - Initialize a BullMQ `Queue` for handling tasks (`TaskQueue`).
     - Create a `Worker` to process items from `TaskQueue`.
  2. **Git & Repository Manager (`gitService.ts`):**
     - Write logic to securely clone a repository to a temporary workspace `/tmp/workspaces/{taskId}`.
     - Handle authentication for private repositories (using OAuth tokens).
     - Implement zip file upload and extraction capabilities (using `multer` and `unzipper`).
     - Write functions to generate Git diffs (`git diff`) and checkout branches.
  3. **Authentication System:**
     - Implement User Registration and Login endpoints.
     - Hash passwords using `bcrypt`.
     - Issue JWT tokens and create an auth middleware to protect routes.
  4. **Task REST APIs:**
     - `POST /api/tasks` - Submit a new coding task. Adds a job to BullMQ.
     - `GET /api/tasks/:id` - Fetch task status and details.
     - `GET /api/tasks` - List user's tasks.

- **Proposed File Structure (Backend Additions):**
  ```text
  /backend/src
  ├── /jobs
  │   ├── queue.ts            # BullMQ initialization
  │   └── taskWorker.ts       # Worker process for executing tasks
  ├── /services
  │   ├── gitService.ts       # git clone, git diff wrappers
  │   └── storageService.ts   # Zip upload handling
  ├── /middlewares
  │   └── auth.ts             # JWT verification
  └── /controllers
      ├── taskController.ts   # Submit task, get status
      └── authController.ts
  ```

### Phase 3: Tool Execution Layer & Docker Sandbox
**Objective:** Create a secure, isolated environment for code execution and expose safe tools for the AI agent to interact with the codebase.

- **Tech Stack & Libraries:** `dockerode` (Docker API for Node.js), shell scripting, Node.js `fs/promises`.
- **Detailed Tasks:**
  1. **Docker Sandbox Manager (`dockerManager.ts`):**
     - Initialize `dockerode` client.
     - Implement logic to start a container (e.g., `node:18-alpine` or `python:3.9`) attached to the task's temporary workspace (using volume mounts).
     - Configure strict limits: `Memory` (e.g., 512MB), `NanoCPUs`, and network isolation if necessary.
     - Implement a cleanup function to forcefully stop and remove containers after task completion.
  2. **Tool Execution Registry (`toolRegistry.ts`):**
     - Define standard input/output schemas for all tools.
     - Implement local file system tools:
       - `view_file(path, lines)`
       - `write_file(path, content)`
       - `replace_file_content(path, target, replacement)`
       - `list_dir(path)`
       - `grep_search(query, path)`
  3. **Docker Command Routing (`commandRunner.ts`):**
     - Implement `run_command(cmd)`: This tool specifically routes commands (like `npm test`, `tsc`, `python script.py`) to execute *inside* the active Docker sandbox via `docker exec`.
     - Capture `stdout` and `stderr` streams and return them.
     - Enforce timeouts (e.g., kill command if it runs > 60s).

- **Proposed File Structure (Backend Additions):**
  ```text
  /backend/src
  ├── /sandbox
  │   ├── dockerManager.ts    # Dockerode logic, container lifecycle
  │   └── sandboxConfig.ts    # Resource limits, security profiles
  ├── /tools
  │   ├── fileSystem.ts       # Read/Write/Search logic
  │   ├── commandRunner.ts    # Routes commands to Docker
  │   └── toolRegistry.ts     # Whitelist of allowed tools
  ```

### Phase 4: AI Agent Orchestration & Iteration Loop
**Objective:** Integrate the LLM, provide it with the defined tools, and implement the autonomous loop of planning, executing, and testing.

- **Tech Stack & Libraries:** `@langchain/openai`, `openai` SDK, structured output parsers.
- **Detailed Tasks:**
  1. **Prompt Engineering & Context Building:**
     - Develop the System Prompt describing the agent's role, rules, and tool access.
     - Implement a "Project Analysis" step that gathers context (e.g., reading `package.json`, listing root directory) to feed the LLM initially.
  2. **The Agent Loop (`agentLoop.ts`):**
     - Implement the core state machine (Analyze -> Plan -> Tool Execution -> Verification).
     - Parse LLM responses to extract tool calls.
     - Route tool calls to the Tool Execution Registry (Phase 3) and return results to the LLM.
  3. **Verification & Iteration:**
     - Instruct the LLM to run verification commands (e.g., `npm run test`) after making edits.
     - If the command fails, the `stderr` is fed back as a new user message: "The test failed with this error. Fix it."
     - Implement a hard limit on iterations (e.g., max 10 loops) to prevent infinite loops.
  4. **Diff Generation & Result Saving:**
     - On successful task completion, use `gitService.ts` to capture the final `git diff`.
     - Update the database `Task` status to COMPLETED and save logs/diff.

- **Proposed File Structure (Backend Additions):**
  ```text
  /backend/src
  ├── /agent
  │   ├── prompts.ts          # System instructions & context building
  │   ├── llmClient.ts        # OpenAI API wrapper
  │   ├── agentLoop.ts        # The core while-loop (Plan -> Execute -> Test)
  │   └── parser.ts           # Parses LLM tool calls and maps to Tool Execution Layer
  ```

### Phase 5: Frontend Interface
**Objective:** Build a responsive, real-time web interface for users to submit tasks and monitor the agent's progress.

- **Tech Stack & Libraries:** Next.js, React, Tailwind CSS, `socket.io-client`, `react-diff-viewer`, `lucide-react` (icons).
- **Detailed Tasks:**
  1. **WebSocket Integration (Backend & Frontend):**
     - Add `socket.io` to the backend Node server.
     - Emit live log events from the `taskWorker.ts` and `agentLoop.ts` to connected clients.
  2. **Task Submission Dashboard:**
     - Create a clean form for users to input a Repository URL, Branch, and natural language Task Description.
     - Display a list of recent tasks with status indicators (Pending, Running, Completed, Failed).
  3. **Live Execution View (`[id].tsx`):**
     - Create a split-pane layout.
     - **Pane 1 (Live Terminal):** A scrolling terminal UI displaying real-time logs, AI thoughts, and tool execution outputs via WebSockets.
     - **Pane 2 (Agent State):** Display the current step (Planning, Modifying Files, Running Tests, etc.).
  4. **Result Viewer:**
     - Implement a Diff Viewer using `react-diff-viewer` to beautifully display the code changes the agent made.
     - Add "Download Patch" or "Create Pull Request" action buttons.

- **Proposed File Structure (Frontend):**
  ```text
  /frontend
  ├── /src
  │   ├── /components
  │   │   ├── TaskForm.tsx
  │   │   ├── LiveTerminal.tsx  # WebSocket powered terminal UI
  │   │   └── DiffViewer.tsx
  │   ├── /pages
  │   │   ├── index.tsx         # Landing page / Dashboard
  │   │   ├── /tasks
  │   │   │   └── [id].tsx      # Task execution view
  │   └── /styles
  │       └── globals.css
  ```

### Phase 6: Testing, Security Hardening & Deployment
**Objective:** Ensure the system is robust, secure, and ready for production deployment.

- **Tech Stack & Libraries:** Jest, Supertest, GitHub Actions, Docker, Nginx/Traefik.
- **Detailed Tasks:**
  1. **Comprehensive Testing:**
     - Write unit tests for tool functions (`fileSystem.ts`, `gitService.ts`).
     - Write integration tests for the API endpoints using `supertest`.
     - Write mock tests for the agent loop to ensure it handles tool parsing correctly without calling the real LLM API.
  2. **Security Hardening:**
     - Conduct a security audit of the Docker Sandbox (ensure no volume mounting vulnerabilities).
     - Sanitize all inputs in the Tool Execution Layer to prevent command injection from malicious LLM outputs.
     - Setup rate limiting (`express-rate-limit`) on task submission endpoints.
  3. **CI/CD Pipeline:**
     - Setup GitHub Actions to run ESLint, TypeScript compilation, and Jest tests on PRs.
     - Build Docker images for both frontend and backend automatically.
  4. **Deployment Configuration:**
     - Create a robust `docker-compose.prod.yml` that includes Frontend, Backend, PostgreSQL, and Redis.
     - Configure Nginx as a reverse proxy to route traffic and handle SSL termination.

- **Proposed File Structure (Root Additions):**
  ```text
  /coding-harness
  ├── .github
  │   └── workflows
  │       └── ci.yml          # GitHub Actions pipeline
  ├── docker-compose.yml      # Local dev setup
  ├── docker-compose.prod.yml # Production setup
  ├── Dockerfile.backend
  ├── Dockerfile.frontend
  └── tests/                  # E2E test suite
  ```

---

> [!TIP]
> **Next Steps:** Begin with **Phase 1** to initialize the monorepo structure, set up the ESLint/Prettier configs, and scaffold the PostgreSQL database schema.