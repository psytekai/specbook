# Project BlueGem: Architectural Automation 

## Description

1. The Ranch Mine is a high-end residential architecture firm operating out of Phoenix, AZ
2. The Ranch Mine (TRM) wants to automate manual and time-intensive tasks
3. The most time-intensive task is the generation and maintenence of the specification book
4. The specification book, or spec book, is a row-based document detailing products, appliciances, fixtures, and finishes, etc, picked as part of the design development phase
5. The spec book for products includes the product image, product web link, product type, characteristics, dimensions, colors, notes, quantity, and a key which links back to the Revit 3D Modelling Program
6. More than 20+ hours a project is spent just on documenting the products
7. The spec books were once kept in Google Sheets, but now are created in Revit Schedules within Revit, a 3D architecture modeling program
8. Storing in Revit Schedules allows automatic updates to the spec book if they change the product within the 3D model
9. Revit only supports C# plugins and is rather hard to integrate into or with

## Problems

1. Gathering the correct product specifications and documenting them in the spec book is time-consuming and laborious

## Solutions

1. Automate the fetching and storage of the product information
2. Automate the generation of the spec book from the collected data (pdf or csv for now)

## Additional Context

1. The architects generally know what they want, so the first step isn't to help build tools for product discovery
2. It's once the architect has selected a product that the data collection and documentation becomes a hassle
3. Our goal is to provide a robust system for the architects to manage their product selections and generate spec books
4. It was agreed upon to start that the architects would pass over a csv of the product urls and this system would handle the rest

## Current Progress

### 2025-07-06

As of July 6th, 2025, I have created a program which reads in a CSV file of product links, uses a custom-built 
web scraper (`tools/stealth_scraper`) to fetch the product site html, cleans the html, removing unecessary tags
and formatting the data into python dict which will be fed into a LLM prompt with `tools/html_processor`, creates
a LLM prompt with `tools/prompt_templator` and then invokes an OpenAI LLM with the `tools/llm_invocator`. I run 
all of these in a notebook, using pandas dataframes to store results and to write to disc for manual verification. 
My next steps include creating a plan for a more robust system. 
