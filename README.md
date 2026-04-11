# DemandAI Kernel

**High-Performance Autonomous Agent Orchestration Layer**

DemandAI is an event-driven kernel designed for orchestrating autonomous agents. It provides a robust abstraction layer for Large Language Model (LLM) inference, integrating immutable event-sourced persistence, semantic context management, and standardized multi-agent delegation protocols.

## Key Features

- **Event-Sourced Persistence**: Immutable storage using PostgreSQL, supporting complex conversation branching and state recovery.
- **Semantic Folding (Context Reduction)**: Real-time token budget management and intelligent truncation of historical data to optimize context window utilization.
- **Multi-Agent Orchestration**: Native support for sub-agent delegation (Swarm pattern) with technical execution transcripts.
- **MCP Integration**: Seamless connectivity with Model Context Protocol (MCP) servers via Stdio or SSE transports.
- **Resilience Engine**: Built-in circuit breakers, automatic argument repair, and JSON schema sanitization for heterogeneous LLM providers.
- **Integrated Diagnostics**: "Doctor" module for real-time health monitoring of environment, providers, and tool capabilities.

## Architecture Overview

The kernel acts as a middleware between client applications and inference providers. It manages the lifecycle of a conversation turn:
1.  **Context Assembly**: History retrieval and semantic folding.
2.  **Inference Orchestration**: Tool-aware calling and provider normalization.
3.  **Result Persistence**: Immutable logging of events and metrics.

## Quick Start

### Installation
```bash
npm install demand-bot
```

### Basic Initialization
```typescript
import { DemandAI, PostgresPersistence, ProviderManager } from 'demandai';

// Initialize PostgreSQL adapter
const persistence = new PostgresPersistence({
  connectionString: process.env.DATABASE_URL
});
await persistence.init();

// Initialize the Kernel
const kernel = new DemandAI({
  provider: ProviderManager.fromEnv(),
  persistence,
  maxTurns: 10
});

// Execute a task
const response = await kernel.execute("Analyze infrastructure logs");
```

## System Requirements
- **Node.js**: v20.0.0 or higher
- **Database**: PostgreSQL 15+ (with support for JSONB)
- **Environment**: Compatible with OpenAI, Anthropic, and local providers (Ollama/LocalAI).

## Documentation
- [Technical Architecture](./ARCHITECTURE.md)
- [LLM Interaction Guidelines](./LLM-CONTEXT.md)

---
© 2026 DemandAI Engineering. Professional-grade agent orchestration.
