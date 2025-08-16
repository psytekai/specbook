# Command 

Name: Execution Brief
Arguments: 
- `TASK_FILEPATH`: the filepath to the reviewed `task_requirement_document`
- `MODE`: can be either `template` or `interactive`, default to `template`

## Command Description

The purpose of this command is to produce a condensed, Claude-ready execution plan for each subtask that has passed the review stage.
This brief is stripped of process notes and formatted so Claude or another AI agent can execute without additional reformatting.

## Command Tasks

1. For each subtask in the task_requirement_document:
   1. Summarize the subtask into:
      - **Inputs:** Files, APIs, datasets, or dependencies required.
      - **Outputs:** Expected deliverables.
      - **Constraints:** Performance, technical, legal, or design limitations.
      - **Plan:** Step-by-step approach to complete the subtask.
   2. Ensure clarity and remove all meta-instructions or redundant notes.
   3. If `MODE="interactive"`, confirm details with the developer before writing.
2. Save to a new file in the format: `YYYYMMDD-BRIEF-$TASK_NAME.md`

# Execution Brief for TASK_NAME

## Subtask: SUBTASK_NAME
**Inputs:**  
**Outputs:**  
**Constraints:**  
**Plan:**  
1. ...
