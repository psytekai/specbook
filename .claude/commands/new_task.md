# Command 

Name: New Task
Arguments: 
- `TASK_NAME`: name of the task
- `MODE`: can be either `template` or `interactive`, default to `template`

## Command Description

The purpose of this command is to dynamically generate the context needed to execute a given task.
This document will serve as a framework in which to guide CLAUDE and the developer in the thinking necessary
to most effectively collaborate and execute on a given task.

For the developer, the goal is to better understand how to use CLAUDE to achieve a task and generate the necessary
context needed for CLAUDE so that it can correctly execute the task.

## Command Tasks

1. If `MODE="template"`, copy this document to a new location (ask the developer where they'd like the file written) as `YYYYMMDD-TASK-$TASK_NAME`, e.g. `20250809-TASK-UI_features.md`
2. If `MODE="interactive"`, ask the developer what subtasks are needed and for each subtask, ask the developer to provide a description and list of requirements
   1. Once done, use this document as a template to generate a new file 
   2. Ask the developer where they'd like the file written to
   3. Name the file in the following format: `YYYYMMDD-TASK-$TASK_NAME`, e.g. `20250809-TASK-UI_features.md`

# Task: $TASK_NAME

## Subtasks

1. <subtask_1>
2. <subtask_2>
3. <subtask_3>
4. ...

### subtask_1

**Description** 

**Requirements**
 
- <requirement_1>

### subtask_2

**Description** 

**Requirements**
 
- <requirement_1>

### subtask_3

**Description** 

**Requirements**
 
- <requirement_1>
