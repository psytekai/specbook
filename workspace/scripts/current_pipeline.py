from lib.core.html_processor import HTMLProcessor
from lib.core.llm import PromptTemplator
from lib.core.llm import LLMInvocator
from lib.core.scraping import StealthScraper
import pandas as pd
from concurrent.futures import ThreadPoolExecutor


stealth_scraper = StealthScraper()
html_processor = HTMLProcessor()
prompt_templator = PromptTemplator()
llm_invocator = LLMInvocator()


def main():
    df = pd.read_csv("workspace/input/specbook.csv")
    df['id'] = range(1, len(df) + 1)

    # STEP 1: Scrape product sites
    product_scrape_results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        for id, product_search_result in zip(df['id'], executor.map(stealth_scraper.scrape_url, df['product_url'].to_list())):
            product_scrape_results.append({
                'id': id,
                'product_url': product_search_result.url,
                'success': product_search_result.success,
                'content_length': len(product_search_result.content) if product_search_result.content else 0,
                'status_code': product_search_result.status_code,
                'final_method': product_search_result.final_method,
                'error_reason': product_search_result.error_reason,
                'page_issues': product_search_result.page_issues,
                'html_content': product_search_result.content,
                'full_result': product_search_result.model_dump_json()
            })

    product_scrape_results_df = pd.DataFrame(product_scrape_results)
    print(product_scrape_results_df.value_counts(['success', 'status_code', 'final_method']))
    product_scrape_results_df = df.merge(product_scrape_results_df, on='id', how='left') \
        .drop(columns=['product_url_y']) \
        .rename(columns={'product_url_x': 'product_url'})

    # STEP 2: Clean HTML and generate prompts
    product_scrape_results_df_success = product_scrape_results_df[product_scrape_results_df['success'] == True]
    product_prompts_df = product_scrape_results_df.copy()

    for id, product_url, html_content in zip(product_scrape_results_df_success['id'], product_scrape_results_df_success['product_url'], product_scrape_results_df_success['html_content']):
        cleaned_html = html_processor.clean_html(str(html_content))
        cleaned_html_json = cleaned_html.model_dump_json()
        prompt = prompt_templator.product_extraction(product_url, cleaned_html_json)
        
        # Add fields dynamically using loc
        product_prompts_df.loc[product_prompts_df['id'] == id, 'cleaned_html'] = cleaned_html_json
        product_prompts_df.loc[product_prompts_df['id'] == id, 'cleaned_html_len'] = len(cleaned_html_json)

        product_prompts_df.loc[product_prompts_df['id'] == id, 'prompt'] = prompt
        product_prompts_df.loc[product_prompts_df['id'] == id, 'prompt_len'] = len(prompt)

    # STEP 3: Invoke LLM
    llm_results_df = product_prompts_df.copy()
    llm_results_df['prompt_len'].sum()

    for id, success, prompt in zip(llm_results_df['id'], llm_results_df['success'], llm_results_df['prompt']):
        default_response = PromptTemplator.ProductExtractionOutput(
                image_url="",
                type="",
                description="",
                model_no="",
                product_link="",
                qty="",
                key="",
            )

        if success == True:
            try:
                llm_response = llm_invocator.invoke_llm(
                    model_provider="openai",
                    llm_model_name="gpt-4o-mini",
                    prompt=prompt
                )
            except Exception as e:
                print(f"Error invoking LLM: {e}")
                default_response.description = f"Error invoking LLM: {e}"

            try:
                default_response = PromptTemplator.ProductExtractionOutput.model_validate_json(llm_response)
            except Exception as e:
                print(f"Error validating response: {e}")
                default_response.description = "Error validating response"

        llm_results_df.loc[llm_results_df['id'] == id, 'llm_response'] = default_response.model_dump_json()

    # STEP 4: Save results
    print(llm_results_df.count())
    llm_results_df.to_csv("workspace/output/llm_results.csv", index=False)

    total_prompt_len = llm_results_df['prompt_len'].sum()
    print(f"Total prompt length: {total_prompt_len:,}")


    llm_result_dicts = [dict(PromptTemplator.ProductExtractionOutput.model_validate_json(response)) for response in llm_results_df['llm_response'].to_list()]
    product_specs_df = pd.DataFrame(llm_result_dicts)

    product_specs_df.to_csv("workspace/output/product_specs.csv", index=False)


if __name__ == "__main__":
    main()
