import { chromium, Page, BrowserContext, ElementHandle } from 'playwright';
import { BrowserOptions, PageOptions } from './type';
import path from "path";
import fs from "fs";


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
                '--enable-automation' // 禁用自动化标记，降低被当成机器人的概率
            ],
        });
    }
    return browserContext;
}

/**
 * 获取空白页面或创建新页面
 * @param context 浏览器上下文
 * @returns 返回页面对象
 */
async function getOrCreatePage(context: BrowserContext): Promise<Page> {
    // 获取所有页面
    const pages = context.pages();
    
    // 查找空白页面（about:blank）
    const blankPage = pages.find(page => page.url() === 'about:blank');
    
    if (blankPage) {
        return blankPage;
    }
    
    // 如果没有空白页面，创建新页面
    return await context.newPage();
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
        const page = await getOrCreatePage(context);
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

    // 尝试在现有页面中查找匹配的页面
    const pages = context.pages();

    for (const p of pages) {
        try {
            if (options.url) {
                const currentUrl = p.url();
                const normalizedCurrentUrl = new URL(currentUrl).hostname.replace(/^www\./, '') + new URL(currentUrl).pathname;
                const normalizedTargetUrl = new URL(options.url).hostname.replace(/^www\./, '') + new URL(options.url).pathname;
                
                if (normalizedCurrentUrl === normalizedTargetUrl) {
                    lastActivePage = p;
                    console.log('Found matching page by URL:', options.url);
                    return p;
                }
            }
            
            if (options.title) {
                const pageTitle = await p.title();
                if (pageTitle === options.title) {
                    lastActivePage = p;
                    return p;
                }
            }
        } catch (error) {
            // 页面可能已关闭，从列表中移除
            if (lastActivePage === p) {
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
        const page = await getOrCreatePage(context);
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
    return path.resolve(path.join('.','userData'));
}

export const getElementSelector = async (element: ElementHandle): Promise<string> => {
    return element.evaluate((node: Element) => {
        // 快速生成唯一选择器
        
        // 如果元素有ID，直接使用ID选择器
        if (node.id && !node.id.match(/^[0-9]/)) {
            return `#${node.id}`;
        }
        
        // 如果元素有data-testid属性，使用它
        const testId = node.getAttribute('data-testid');
        if (testId) {
            return `[data-testid="${testId}"]`;
        }
        
        // 如果元素有name属性，使用它
        const name = (node as HTMLInputElement).name;
        if (name) {
            return `${node.tagName.toLowerCase()}[name="${name}"]`;
        }
        
        // 尝试使用类名生成选择器
        if (node.classList.length > 0) {
            const classes = Array.from(node.classList)
                .filter(c => !/^[0-9]/.test(c))  // 过滤掉以数字开头的类名
                .filter(c => /^[a-zA-Z0-9_-]+$/.test(c))  // 只保留合法的CSS类名字符
                .map(c => `.${c}`)
                .join('');
                
            if (classes) {
                // 验证此选择器是否唯一
                const matchingElements = document.querySelectorAll(`${node.tagName.toLowerCase()}${classes}`);
                if (matchingElements.length === 1) {
                    return `${node.tagName.toLowerCase()}${classes}`;
                }
            }
        }
        
        // 使用精简的定位方法
        let path = '';
        let current: Element | null = node;
        let i = 0;
        
        while (current && current.nodeType === 1 && i < 3) {
            let selector = current.tagName.toLowerCase();
            
            // 尝试加入文本内容进行约束
            const buttonText = current.textContent?.trim();
            if (buttonText && current.tagName.toLowerCase() === 'button' && buttonText.length < 20) {
                return `button:has-text("${buttonText}")`;
            }
            
            // 计算位置索引
            let pos = 0;
            let temp = current;
            while (temp) {
                if (temp.nodeName === current.nodeName) pos++;
                temp = temp.previousElementSibling;
            }
            if (pos > 1) {
                selector += `:nth-child(${pos})`;
            }
            
            // 添加到路径
            path = path ? `${selector} > ${path}` : selector;
            
            // 向上移动
            current = current.parentElement;
            i++;
        }
        
        return path;
    });
};

/**
 * 等待页面完全加载
 */
export const waitForPageLoad = async (page: Page): Promise<void> => {
    try {
        // 等待页面的不同加载状态
        await Promise.all([
            // 等待DOM内容加载完成
            page.waitForLoadState('domcontentloaded'),
            // 等待网络请求基本完成
            page.waitForLoadState('networkidle'),
            // 等待页面加载完成
            page.waitForLoadState('load')
        ]);

        // 确保body元素已加载
        await page.waitForSelector('body', {state: 'attached'});

        // 给页面一些额外时间来执行JavaScript
        await page.waitForTimeout(1000);

        // 等待可能的动态内容加载
        await page.evaluate(() => {
            return new Promise<void>((resolve) => {
                // 如果页面已经加载完成，直接返回
                if (document.readyState === 'complete') {
                    resolve();
                    return;
                }

                // 否则等待load事件
                window.addEventListener('load', () => resolve(), {once: true});

                // 设置一个超时，以防止无限等待
                setTimeout(resolve, 5000);
            });
        });
    } catch (error) {
        console.log('等待页面加载时出错:', error);
        // 继续执行，因为页面可能已经足够可用
    }
};