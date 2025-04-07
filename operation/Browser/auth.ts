import { BrowserContext } from 'playwright';
import { getBrowserUserDataDir, getPage } from './common';
import { AuthOptions, BrowserResult } from './type';


export async function auth(options: AuthOptions): Promise<BrowserResult> {
	if (!options.url && !options.title) {
		throw new Error('需要提供url或title来指定页面');
	}

	switch (options.action) {
		case 'save':
			return saveAuth(options);
		case 'delete':
			return deleteAuth(options);
		default:
			throw new Error('不支持的操作');
	}
}
/**
 * 保存指定网站的身份验证状态
 * @param options 身份验证选项
 * @returns 保存结果
 */
export async function saveAuth(options: AuthOptions): Promise<BrowserResult> {
	if (!options.url && !options.title) {
		throw new Error('需要提供url或title来指定页面');
	}

	const page = await getPage({url: options.url, title: options.title});
	const context = page.context() as BrowserContext;
	const path = options.path ?? getBrowserUserDataDir();
	// 获取当前页面的存储状态
	await context.storageState({path: path});

	return {
		success: true,
	};
}

/**
 * 删除指定网站的身份验证状态
 * @param options 身份验证选项
 * @returns 删除结果
 */
export async function deleteAuth(options: AuthOptions): Promise<BrowserResult<void>> {
	if (!options.url && !options.title) {
		throw new Error('需要提供url或title来指定页面');
	}

	const page = await getPage({url: options.url, title: options.title});
	const context = page.context() as BrowserContext;

	// 清除存储状态
	await context.clearCookies();
	await page.evaluate(() => {
		localStorage.clear();
		sessionStorage.clear();
	});

	return {
		success: true
	};
}
