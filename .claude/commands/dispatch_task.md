# Command 

Name: Role Agent Dispatch
Arguments:
- `BRIEF_FILEPATH`: filepath to the execution brief file
- `MODE`: `parallel` or `sequential` (default `parallel`)

## Command Description

The purpose of this command is to split the execution brief into individual subtask briefs and send them to specialized Claude agents (role-based) for execution.

## Command Tasks

1. For each subtask in the execution brief:
   1. Identify the most appropriate role agent (examples: Python_Backend, Electron_UI, Data_ETL, QA_Reviewer).
   2. Create a dedicated brief for that role with only relevant information.
2. If `MODE="parallel"`, dispatch all subtasks to role agents concurrently.
3. If `MODE="sequential"`, execute subtasks in order, passing results forward if dependent.
4. Save outputs to a staging folder: `staging/TASK_NAME/`

## Command Rules

- Do not include unrelated subtasks in each role’s brief.
- Ensure each agent receives only the minimum viable context needed for its execution.
