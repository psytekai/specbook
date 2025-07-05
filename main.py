from tools.html_processor import HTMLProcessor
from tools.prompt_templator import PromptTemplator
from tools.llm_invocator import LLMInvocator
from tools.stealth_scraper import StealthScraper
import pandas as pd
from concurrent.futures import ThreadPoolExecutor



if __name__ == "__main__":
    stealth_scraper = StealthScraper()
    html_processor = HTMLProcessor()
    prompt_templator = PromptTemplator()
    llm_invocator = LLMInvocator()

    df = pd.read_csv("01_llmpipeline/specbook.csv")
    df['id'] = range(1, len(df) + 1)

    products = zip(df['id'], df['product_url'])

    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        for id, product_search_result in zip(df['id'], executor.map(stealth_scraper.scrape_url, df['product_url'].to_list())):
            results.append({
                'id': id,
                'product_url': product_search_result.url,
                'success': product_search_result.success,
                'content_length': len(product_search_result.content) if product_search_result.content else 0,
                'status_code': product_search_result.status_code,
                'final_method': product_search_result.final_method,
                'error_reason': product_search_result.error_reason,
                'page_issues': product_search_result.page_issues,
                'full_result': product_search_result.model_dump_json()
            })


    result_df = pd.DataFrame(results)
    df = df.merge(result_df, on='id', how='left')
    df.to_csv("01_llmpipeline/1-specbook_scrape_results.csv", index=False)

    # for id, product_url in products:
    #     html_content = stealth_scraper.scrape_url(product_url)
        
    #     # TODO validate html_content

    #     if html_content.success:
    #         cleaned_html = html_processor.clean_html(str(html_content.content))

    #         # TODO validate cleaned_html

    #         prompt = prompt_templator.product_extraction(product_url, cleaned_html.model_dump_json())

    #         # TODO validate prompt

    #         response = llm_invocator.invoke_llm(
    #             model_provider="openai",
    #             llm_model_name="gpt-4.1",
    #             prompt=prompt
    #         )

    #         # TODO validate response



    # html_processor.clean_html(html_content)
    