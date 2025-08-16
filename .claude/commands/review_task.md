# Command 

Name: Review Task
Arguments: 
- `TASK_FILEPATH`: the filepath to the `task_requirement_document`
- `MODE`: can be either `template` or `interactive`, default to `interactive`

## Command Description

The purpose of this command is to create a Task Execution Plan for a particular task defined in an existing task_requirement_document including the following:

1. Task Delegation Analysis
2. SMART Analysis

## Command Tasks

1. If `MODE="template"`, for each subtask in the task_requirement_document: 
   1. Perform a Task Delegation Analysis (see below) for each subtask, exploring each delegation prompt and generating a best-effort response for the developer to work off of
      1. The initial task delegation prompt responses should be concise and thoughtful, at most three sentences or bullets per prompt
   2. Write the outputs of the Task Delegation Analysis under the subtask heading in the task_requirement_document
   3. Do not write a new file, edit the existing task_requirement_document
2. If `MODE="interactive"`, review the Task Delegation Analysis and for each subtask in the task_requirement_document:
   1. Work with the developer to answer all the delegation prompt questions
   2. Decide which delegation prompts would be useful for CLAUDE to have an opinion on before asking the developer and generate an initial response
   3. Write the outputs of the Task Delegation Analysis under the subtask heading in the task_requirement_document
   4. Do not write a new file, edit the existing task_requirement_document
3. Perform a SMART Analysis

## Command Rules

These are a set of rules that the command should always follow when executing the Command Tasks:

1. Do not generate a Task Execution Plan for subtasks that are missing a task description
   1. Work with the developer to generate task descriptions for each subtask first or let the developer define these before following up with the Task Execution Plan
2. Do not change/edit/modify the `task_requirement_document` filename

# Task Execution Plan

## Task Delegation Analysis

For each task, explore the following delegation prompts

**Prompts**

1. What is the overall vision for the task? What does a good result look like?
2. What are the different bits of work needed to get there?
3. Which of these bits require human expertise, creativity, judgment, or uniquely human skills? 
4. What specific skills, knowledge, or AI capabilities are needed?
5. Where might collaboration have the most impact?

## SMART Analysis

**Validate Requirements for SMART Criteria**
1. For each requirement listed under a subtask, check if it meets SMART guidelines and document:
   - **S**pecific: Is it clear and unambiguous?
   - **M**easurable: Can completion be objectively verified?
   - **A**chievable: Is it realistic given constraints?
   - **R**elevant: Does it contribute directly to the task goal?
   - **T**ime-bound: Is there a defined deadline or timeframe?
2. Flag any requirement that fails and suggest improvements.
3. Work interactively with the developer to fix incomplete requirements before finalizing the file.