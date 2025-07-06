## TASK

1. Read the current existing tools and notebooks to understand existing automation progress
   1. tools are found in `tool/*`
   2. notebook of importance: `notebook/specbook.ipynb`
2. Document the current approach, its strengths and weaknesses
3. Define how I should or could be using subagents to verify details or investigate particular questions that Claude may have
4. Make a plan for how to approach the next steps in the automation
   1. What would an agentic system look like:
      1. What tools would be needed
      2. What system dependencies would be needed
      3. What external dependencies would be needed
   2. What would a scripted solution look like:
      1. What scripts would be needed
      2. What functionalities would be needed
   3. What would an E2E system look like?
      1. What would a UI function towards?
      2. What features would the UI have?
      3. How could we handle edge cases and corner cases?
5. Identify the common problems and ideate solutions:
   1. How are we going to handle if a product is out of date
   2. How are we going to dynamically add, remove, update products?
   3. How might we eventually integrate with Revit? 
   4. If we don't integrate with Revit, how are we going to provide a seamless solution for the architects?
   5. How are we going to handle multiple projects over time?

## EXAMPLES

- Example specbook: `examplees/specbook-mockingbird.pdf`
- Agents
  - `agent/therma.py` - simple agent without any 3rd party deps
  - `agent/therma_pydantic.py` - simple agent without any 3rd party deps except pydantic

## DOCUMENTATION

- Project Information: `context/PROJECT.md`

## OTHER CONSIDERATIONS

- Please do no write any code.
- We are just looking to ideate, understand, and plan next steps

