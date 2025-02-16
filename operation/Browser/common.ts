import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { BrowserOptions, PageOptions } from './type';

let browserInstance: Browser | null = null;
let browserContext: BrowserContext | null = null;
let lastActivePage: Page | null = null;

export async function getBrowser(options: BrowserOptions = {}): Promise<Browser> {
    if (!browserInstance) {
        browserInstance = await chromium.launch({
            headless: options.headless ?? false,
            channel: options.channel ?? 'chrome',
        });
        // 创建一个共享的上下文
        browserContext = await browserInstance.newContext({
            viewport: null // 使用默认窗口大小
        });
    }
    return browserInstance;
}

export async function getPage(options: PageOptions = {}): Promise<Page> {
    await getBrowser(); // 确保浏览器和上下文已创建
    
    if (!browserContext) {
        throw new Error('Browser context not initialized');
    }
    
    // 如果没有任何选项，返回上一次操作的页面或创建新页面
    if (!options.url && !options.title && !options.createNew) {
        // 如果有上一次操作的页面且页面仍然有效，返回该页面
        if (lastActivePage) {
            try {
                // 检查页面是否仍然有效
                await lastActivePage.evaluate(() => true);
                return lastActivePage;
            } catch {
                // 页面已关闭，从列表中移除
                console.error('Last active page is closed');
                lastActivePage = null;
            }
        }
        
        // 如果明确指定不创建新页面，则抛出错误
        if (options.createNew === false) {
            throw new Error('No active page found and createNew is false');
        }
        
        // 如果没有有效的上一次操作页面，创建新页面
        const page = await browserContext.newPage();
        lastActivePage = page;
        return page;
    }

    // 如果要求创建新页面
    if (options.createNew) {
        const page = await browserContext.newPage();
        if (options.url) {
            await page.goto(options.url, {
                waitUntil: options.waitForUrl ? 'networkidle' : 'commit'
            });
        }
        lastActivePage = page;
        return page;
    }

    const pages = browserContext.pages();

    // 尝试在现有页面中查找匹配的页面
    for (const page of pages) {
        try {
            if (options.url) {
                const currentUrl = page.url();
                const normalizedCurrentUrl = new URL(currentUrl).hostname.replace(/^www\./, '') + new URL(currentUrl).pathname;
                const normalizedTargetUrl = new URL(options.url).hostname.replace(/^www\./, '') + new URL(options.url).pathname;
                
                if (normalizedCurrentUrl === normalizedTargetUrl) {
                    lastActivePage = page;
                    console.log('Found matching page by URL:', options.url);
                    return page;
                }
            }
            
            if (options.title) {
                const pageTitle = await page.title();
                if (pageTitle === options.title) {
                    lastActivePage = page;
                    return page;
                }
            }
        } catch (error) {
            // 页面可能已关闭，从列表中移除
            if (lastActivePage === page) {
                lastActivePage = null;
            }
        }
    }

    if (options.title) {
        throw new Error('No matching page found for title: ' + options.title);
    }

    // 如果明确指定不创建新页面，则抛出错误
    if (options.createNew === false) {
        throw new Error('No matching page found and createNew is false');
    }

    // 如果没有找到匹配的页面，创建新页面
    if (options.url) {
        const page = await browserContext.newPage();
        await page.goto(options.url, {
            waitUntil: options.waitForUrl ? 'networkidle' : 'commit'
        });
        pages.push(page);
        lastActivePage = page;
        return page;
    }

    // 创建新页面
    const page = await browserContext.newPage();
    pages.push(page);
    lastActivePage = page;
    return page;
}

export async function getPages(): Promise<Page[]> {
    return browserContext ? browserContext.pages() : [];
}

export async function closePage(page: Page): Promise<void> {
    await page.close();
    if (lastActivePage === page) {
        lastActivePage = null;
    }
}

export async function closeBrowser(): Promise<void> {
    if (browserContext) {
        await browserContext.close();
        browserContext = null;
    }
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}
