import { getPage, getPages } from './common';
import { InteractOptions, BrowserResult, AnalyzeResult, InteractDiffResult } from './type';
import { observeDOMChanges, detectPageChanges } from '@operation/Browser/utils/domChanges';

export async function interact(options: InteractOptions): Promise<BrowserResult> {

	if (!options.url && !options.title) {
		throw new Error('交互操作需要提供url或title,从而指定页面');
	}
	const page = await getPage({url: options.url, title: options.title});

	let selector = options.selector;
	if (!selector) {
		if (options.id) {
			selector = `#${options.id}`;
		} else if (options.text) {
			selector = `text=${options.text}`;
		} else if (options.tag) {
			selector = options.tag;
		} else {
			throw new Error('需要提供选择器或者id/text/tag中的一个');
		}
	}

	const wait = options.timeout ?? 3; // 默认等待3秒

	// 等待元素出现
	await page.waitForSelector(selector, {
		timeout: wait * 1000
	});
    
	// 记录初始页面数量
	const initialPages = await getPages();
    
	// 开始监听 DOM 变化
	await observeDOMChanges(page);

	switch (options.action) {
		case 'click':
			const count = options.count ?? 1;
			for (let i = 0; i < count; i++) {
				await page.click(selector);
			}
			break;

		case 'input':
			if (!options.text) {
				throw new Error('输入操作需要提供text参数');
			}

			if (options.clear) {
				await page.fill(selector, ''); // 清空输入框
			}
			await page.fill(selector, options.text);
			if (options.enter ?? true) {  // 默认为true，按回车键
				await page.press(selector, 'Enter');
			}
			break;

		default:
			throw new Error('不支持的交互操作');
	}

	// 等待页面反应
	await page.waitForTimeout(1000);

	// 获取 DOM 变化
	const changes = await detectPageChanges(page);

	// 检查是否有新页面
	const currentPages = await getPages();
	const filteredPages = currentPages.filter(p => !initialPages.includes(p));
	const newPages = await Promise.all(
		filteredPages.map(async (p) => ({
			url: p.url(),
			title: await p.title()
		}))
	);
	const isCreateNewPage = newPages.length > 0;

	const result: InteractDiffResult = {
		isCreateNewPage,
		newPages,
		changes,
	};

	return {
		success: true,
		data: result
	};
}
