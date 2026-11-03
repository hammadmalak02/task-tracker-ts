# Typed Task Tracker

A TypeScript-based task management data layer built as part of the AI-Assisted Software Development Internship — Week 1 assignment.

The project focuses on TypeScript fundamentals, type safety, asynchronous operations, state management, data validation and testing.

## Project Objectives

- Practice TypeScript strict typing and generics.
- Build reusable and type-safe task management functions.
- Handle asynchronous operations, retries, and request cancellation.
- Implement filtering, sorting, and pagination.
- Manage application state with optimistic updates.
- Implement caching and debounced search.
- Safely render task data as HTML.
- Maintain code quality through ESLint and automated checks.

## Technologies Used

- TypeScript
- JavaScript
- Node.js
- Vitest
- ESLint
- Prettier
- Git and GitHub
- GitHub Actions

## Project Structure

```text
task-tracker-ts/
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── api.ts
│   ├── cache.ts
│   ├── fetcher.ts
│   ├── filters.ts
│   ├── pagination.ts
│   ├── render.ts
│   ├── search.ts
│   ├── stats.ts
│   ├── store.ts
│   ├── types.ts
│   └── validation.ts
├── tests/
├── .gitignore
├── eslint.config.js
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Installation

Clone the repository:

```bash
git clone <your-repository-url>
```

Navigate into the project:

```bash
cd task-tracker-ts
```

Install dependencies:

```bash
npm install
```

## Available Commands

Run TypeScript type checking:

```bash
npm run typecheck
```

Run ESLint:

```bash
npm run lint
```

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

Format project files:

```bash
npm run format
```

## Continuous Integration

GitHub Actions is configured to run the following checks on pushes to `main` and pull requests targeting `main`:

- Dependency installation
- ESLint
- TypeScript type checking
- Automated tests

## Learning Outcomes

This project provides practical experience with TypeScript, asynchronous programming, error handling, immutable data, generic functions, state management, and automated software quality checks.

## Assignment

**AI-Assisted Software Development Internship — Week 1**

Typed Task Tracker