# Command 

Name: Review Output
Arguments: 
- `TASK_FILEPATH`: filepath to the `task_requirement_document`
- `OUTPUT_FOLDER`: folder containing completed subtask outputs

## Command Description

The purpose of this command is to evaluate whether the delivered outputs meet the defined requirements in the task requirement document.

## Command Tasks

1. For each subtask:
   1. Check each deliverable against requirements.
   2. Assign a quality score (0-10) for completeness and correctness.
   3. List missing or incorrect elements.
   4. Suggest corrections or improvements.
2. Produce a final review report as `YYYYMMDD-REVIEW-$TASK_NAME.md`

# Review Report for TASK_NAME

## Subtask: SUBTASK_NAME
**Score:** 8/10  
**Pass:** Yes  
**Issues:** None / Minor styling mismatch.  
**Recommendations:** Adjust padding on mobile UI.

