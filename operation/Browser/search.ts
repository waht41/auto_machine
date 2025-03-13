import { getPage } from './common';
import { SearchOptions, SearchResult, BrowserResult } from './type';

export async function search(options: SearchOptions): Promise<BrowserResult<SearchResult[]>> {
	const page = await getPage();
	const searchUrl = options.engine === 'google'
		? `https://google.com/search?q=${encodeURIComponent(options.keyword)}`
		: `https://bing.com/search?q=${encodeURIComponent(options.keyword)}`;

	await page.goto(searchUrl);

	// 等待搜索结果加载
	const selector = options.engine === 'google' ? '.g' : '.b_algo';
	await page.waitForSelector(selector);

	// 获取搜索结果
	const results = await page.evaluate((selector) => {
		const searchResults: SearchResult[] = [];
		const resultElements = document.querySelectorAll(selector);

		resultElements.forEach((element) => {
			const titleElement = element.querySelector('h3 a, h2 a');
			const descElement = element.querySelector('.VwiC3b, .b_caption p');

			if (titleElement && descElement) {
				searchResults.push({
					title: titleElement.textContent || '',
					description: descElement.textContent || '',
					link: (titleElement as HTMLAnchorElement).href
				});
			}
		});

		return searchResults;
	}, selector);

	return {
		success: true,
		data: results,
		page: page
	};

}
