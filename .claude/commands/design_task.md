# Command 

Name: Design Task
Arguments: 
- `PROBLEM_AREA`: brief description of what you want to explore (e.g., "teams integration", "data sync system")
- `MODE`: can be either `rapid` or `thorough`, default to `rapid`

## Command Description

This command helps developers explore fuzzy problems and transform them into actionable task definitions. Use this when you know you want to build something but haven't crystallized the specific requirements yet.

## How Developers Use This

1. **Start with uncertainty**: "I want to add Teams integration but I'm not sure what that means"
2. **Run design_task**: Claude guides you through rapid exploration
3. **Get concrete output**: A task definition ready for `new_task` command
4. **Maintain momentum**: Designed to take 5-10 minutes, not hours

## Command Tasks

### Phase 1: Problem Framing (2-3 minutes)
Ask the developer to answer (Claude provides initial thoughts if helpful):
1. **Why**: What's driving this need? What problem does it solve?
2. **Who**: Who will use this? What's their context?
3. **Success**: What does "working" look like? How will you know it's done?

### Phase 2: Solution Sketching (3-5 minutes)
Collaboratively explore:
1. **Capabilities**: What specific features/functions are needed?
2. **Integration Points**: What systems/APIs/data does this touch?
3. **Constraints**: What technical/time/resource limits exist?
4. **Unknowns**: What needs research or spike work?

### Phase 3: Task Generation (2 minutes)
Transform insights into:
1. **Core Subtasks**: 3-5 concrete engineering tasks
2. **Requirements**: 2-3 key requirements per subtask
3. **Risks**: Top 2-3 technical risks to monitor

## Output Format

Generate file: `YYYYMMDD-DESIGN-{PROBLEM_AREA}.md`

```markdown
# Design: {PROBLEM_AREA}

## Problem Statement
{1-2 sentence synthesis from Phase 1}

## Solution Approach
{Brief description of chosen direction}

## Unknowns Requiring Investigation
- {List items that need spikes or research}

## Proposed Task Structure
### Subtasks
1. {subtask_1}
2. {subtask_2}
3. {subtask_3}

### Task Requirements
{For each subtask, 2-3 concrete requirements}

## Next Step
Run: `new_task "{PROBLEM_AREA}_implementation" template`
Then copy subtasks and requirements from this design document.
```

## Design Philosophy

**Rapid over Comprehensive**: Get to clarity fast, iterate if needed
**Concrete over Abstract**: Transform vague ideas into specific tasks
**Collaborative over Prescriptive**: Developer drives, Claude facilitates
**Actionable over Perfect**: Output feeds directly into execution workflow

## Mode Differences

- **rapid**: 5-10 minute session, focuses on core clarity
- **thorough**: 15-20 minutes, includes competitive analysis, architecture implications, testing strategy

## Example Flow

```
Developer: "I want to add Teams integration"
Claude: "Let's explore this. Why do you need Teams integration?"
Developer: "Users keep asking to get notifications in Teams"
Claude: "What kind of notifications? All events or specific ones?"
Developer: "Just critical alerts and daily summaries"
Claude: "I see. So we need webhook integration for alerts and a scheduled job for summaries..."
[continues through phases]
Output: Concrete subtasks like "Implement Teams webhook client", "Create alert filtering logic", etc.
```

## When to Use vs. new_task

- **Use design_task when**: "I want X but haven't figured out what X really means"
- **Use new_task when**: "I need to build X, Y, and Z with these specific requirements"
- **Chain them**: design_task → new_task → review_task → execute