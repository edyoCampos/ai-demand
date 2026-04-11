# DemandAI: Technical Directives for Inference Engines

This document defines the operational protocols and architectural constraints for Language Models (LLMs) interacting with the DemandAI Kernel.

## 1. Context Pipeline and Semantic Folding

The kernel implements a dynamic history reduction pipeline to prevent context window saturation while maintaining semantic coherence.

### 1.1 Content Truncation Awareness
- **State Flag**: When a `ContentBlock` reaches the kernel's token threshold, it is processed by the `ContextFolder`.
- **Property**: Models must detect the `collapsed: true` flag in the message schema.
- **Semantic Structure**: Folded blocks preserve the `Head` (initial technical context) and `Tail` (final execution result), omitting intermediate verbosity.
- **Directive**: Do not attempt to recover data from within a collapsed block unless requested via a specific tool (e.g., `wiki_search`).

### 1.2 Token Budgeting
- The `TokenBudgetManager` calculates the saturation ratio per turn.
- If the budget is exceeded, the kernel will inject a `[SYSTEM_INSTRUCTION]` indicating that historical context has been aggressively reduced.

## 2. Multi-Agent Delegation Protocol

The kernel supports the Swarm architecture through recursive delegation.

### 2.1 Task Delegation (`delegate_task`)
- **Usage**: Use this tool to offload specialized sub-tasks (e.g., code analysis, infra auditing, deep research).
- **Isolation**: Each delegation spawns a isolated `DemandAI` instance with restricted tools.
- **Result Handling**: The model receives a summarized technical transcript of the sub-agent's execution.
- **Directive**: Do not repeat delegation for the same task if the transcript indicates a terminal error; instead, report the failure to the coordinator context.

## 3. Resilience and Normalization Engines

### 3.1 Schema Sanitization
- The kernel automatically strips incompatible JSON Schema keywords (e.g., `default`, `patternProperties`) before transmission to the provider.
- **Constraint**: Always output strictly valid JSON according to the provided `inputSchema`.

### 3.2 Automated Argument Repair
- The normalization engine intercepts malformed outputs (e.g., JSON wrapped in markdown, triple backticks) and repairs them before tool execution.
- **Constraint**: While the kernel has repair capabilities, models should prioritize clean, raw JSON output for maximum reliability.

### 3.3 Circuit Breaker Protocol
- After **3 consecutive failures** in a specific tool execution, the kernel will block further attempts for that tool in the current turn.
- **Directive**: If the circuit breaker triggers, explain the limitation to the user and suggest an alternative approach.

## 4. Integrated Knowledge & Monitoring

### 4.1 Knowledge Base (WikiEngine)
- Use `wiki_search` and `wiki_read` tools to access the integrated knowledge repository.
- Prioritize Wiki information over internal model knowledge for project-specific facts.

### 4.2 Health Diagnostics (Doctor)
- Reports from the `Doctor` module provide health status for MCP connections and tool capabilities.
- **Status Interpretation**:
    - `ok`: Full capability.
    - `warning`: Capability present but degraded (e.g., high latency).
    - `error`: Capability unavailable.

---
**Core Principle**: Maintain provider agnosticism with extreme reliability.
