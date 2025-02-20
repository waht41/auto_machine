import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { BrowserOptions, PageOptions } from './type';
import * as process from "node:process";
import path from "node:path";
import fs from "node:fs";

let browserContext: BrowserContext | null = null;
export let lastActivePage: Page | null = null;
let userDataDir: string | null = null;

export async function getBrowser(options: BrowserOptions = {}): Promise<BrowserContext> {
    if (!browserContext) {
        userDataDir = options.userDataDir || getDefaultUserDataDir();
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, {recursive: true});
        }
        browserContext = await chromium.launchPersistentContext(userDataDir, {
            headless: options.headless ?? false,
            channel: options.channel ?? 'chrome',
            viewport: null, // 使用默认窗口大小
            args: [
                '--disable-blink-features=AutomationControlled'
            ],
            ignoreDefaultArgs: [
                '--enable-automation' // 禁用自动化标记
            ]
        });
    }
    return browserContext;
}

export async function getPage(options: PageOptions = {}): Promise<Page> {
    // 如果提供了新的身份验证状态，需要重新创建上下文
    if (options.userDataDir && browserContext) {
        if (userDataDir && userDataDir !== options.userDataDir) {
            await browserContext.close();
            browserContext = null;
            lastActivePage = null;
        }
    }

    const context = await getBrowser({
        headless: false,
        channel: 'chrome',
        userDataDir: options.userDataDir
    });
    
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
        const page = await context.newPage();
        lastActivePage = page;
        return page;
    }

    // 如果要求创建新页面
    if (options.createNew) {
        const page = await context.newPage();
        if (options.url) {
            await page.goto(options.url, {
                waitUntil: options.waitForUrl ? 'networkidle' : 'commit'
            });
        }
        lastActivePage = page;
        return page;
    }

    const pages = context.pages();

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
        const page = await context.newPage();
        await page.goto(options.url, {
            waitUntil: options.waitForUrl ? 'networkidle' : 'commit'
        });
        pages.push(page);
        lastActivePage = page;
        return page;
    }

    // 创建新页面
    const page = await context.newPage();
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
}

export const getDefaultUserDataDir = () => {
    return path.join(process.cwd(),'userData');
}