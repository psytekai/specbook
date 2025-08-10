## TASK

Phase 1: Evaluation & Monitoring Design

1. Analyze the current specbook pipeline script found: `workspace/scripts/current_pipeline.py` (formerly `scripts/specbook.py`)
2. Design an evaluation and monitoring plan that would allow a developer to identify issues in the success of the pipeline, taking into consideration:
    i. Failure to fetch product site html with non 200 cods
    ii. Failure to fetch appropriate product content due to bot detection
    iii. Firecrawl failures due to rate limiting or insuffucient tokens
    iv. OpenAI rate limiting errors or insufficient tokens

Phase 2: Design LLM Model and Prompt Tuning Plan with Benchmarking

1. Building off the evaluation plan, design a plan to benchmark different openAI model extractions
2. Design a process or plamn for evaluating different prompts and results


Phase 3: Document and Review Plan

1. Write all plans to a markdown files within `context/plans/<task_file_name>.md`
2. Review the markdown file plans and identify key or critical gaps in thinking, being very thoughtful in how to design a simple and elegant solution

Phase 4: Implement Plans

1. With human review and acceptance, implement the plans in code 

Phase 5: Execute Plans

1. Execute tha plans, begnning with the evaluation and monitoring, making sure to document the design of the system and how to use it
2. Execute the benchmarking plans, running the pipeline code, evaluating results, iterating on prompts and models
3. Generate a report of the prompts used, models used, and results, with summaray statistics so that a human can evaluate the performance of the system
  

## GOAL

1. 100% product site fetch accuracy with the exceptions of 404s (404s are okay, just need to make sure they're documented)
2. 100% success on LLM calls, avoiding rate limits
3. 100% success in extracting valid product image urls


## EXAMPLES

- Example specbook: `examplees/specbook-mockingbird.pdf`

## DOCUMENTATION

- Project Information: `context/PROJECT.md`

## OTHER CONSIDERATIONS

- Prioritize simple and readable code
- There's only one developer revieing the plans and code, so do not over-engineer, stick to simple, manageable solutions that be easily understand and followed by one developer
- **IMPORTANT**: When running the specbook.py script multiple times as we start to iterate on different prompts, we want to make sure we don't re-fetch the same html and potentially use up firecrawl tokenss. So we need to implement a solution that checks if we already fetched the html and skip the scraping part. This could mean, instead of reading the `workspace/input/specbook.csv` each time, we read `shared/data/reference_data/llm_results.csv` (which is the final output of the script) if it exists, use that as our starting point, check if the html alraedy exists, and if it does, continue to cleaning the html and generating the prompt. Thank you.


  