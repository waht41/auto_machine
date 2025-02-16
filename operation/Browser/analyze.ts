import { Page, ElementHandle } from 'playwright';
import { getPage } from './common';
import { AnalyzeOptions, AnalyzeResult } from "./type";

const getElementSelector = async (element: ElementHandle): Promise<string> => {
    return element.evaluate((node: Element) => {
        const segments: string[] = [];
        let current: Element | null = node;

        while (current && current.nodeType === 1) {
            let selector = current.tagName.toLowerCase();

            // 处理ID
            if (current.id) {
                // 如果ID以数字开头，使用属性选择器
                if (/^[0-9]/.test(current.id)) {
                    selector += `[id="${current.id}"]`;
                } else {
                    selector += `#${current.id}`;
                }
                segments.unshift(selector);
                break;
            }

            // 处理类名
            if (current.classList.length > 0) {
                const classes = Array.from(current.classList)
                    .filter(c => !/^[0-9]/.test(c))  // 过滤掉以数字开头的类名
                    .map(c => `.${c}`)
                    .join('');
                if (classes) {
                    selector += classes;
                }
            }

            // 计算同类型元素中的位置
            let sibling = current.previousElementSibling;
            let index = 1;
            while (sibling) {
                if (sibling.tagName === current.tagName) index++;
                sibling = sibling.previousElementSibling;
            }
            if (index > 1) {
                selector += `:nth-of-type(${index})`;
            }

            segments.unshift(selector);
            current = current.parentElement;
        }

        return segments.join(' > ');
    });
};

/**
 * 等待页面完全加载
 */
const waitForPageLoad = async (page: Page): Promise<void> => {
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

/**
 * Analyze web page content based on given selector
 * @param options Configuration options for analysis
 * @returns Analysis result containing text and HTML content
 */
export const analyze = async (options: AnalyzeOptions): Promise<AnalyzeResult[]> => {
    if (!options.url && !options.title) {
        throw new Error('Either url or title must be provided');
    }

    const page: Page = await getPage({title: options.title, url: options.url});

    console.log('等待页面加载...');
    await waitForPageLoad(page);
    console.log('页面加载完成');

    const interactiveElements = await Promise.all((await page.$$('a, button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')).map(async element => {
        const selector = options.selector? await getElementSelector(element) : undefined;
        return element.evaluate((el, selector) => {
            const element = el as HTMLElement;
            const inputElement = element as HTMLInputElement;
            return {
                selector,
                tag: element.tagName.toLowerCase(),
                id: element.id || undefined,
                type: inputElement.type || undefined,
                text: element.textContent?.trim() || undefined,
                href: (element as HTMLAnchorElement).href || undefined,
            };
        }, selector);
    }));

    return interactiveElements;
}