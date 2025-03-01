import { Page } from 'playwright';
import { getElementSelector, getPage, waitForPageLoad } from './common';
import { AnalyzeOptions, AnalyzeResult } from "./type";

// 处理单个元素
const processElement = (element: HTMLElement, selector: string | undefined): any => {
    // 使用浏览器内置的checkVisibility函数检测可见性
    if (!element.checkVisibility()) {
        return null;
    }

    // 跳过样式相关元素
    if (element.id?.includes('css') ||
        element.id?.includes('style') ||
        element.textContent?.trim().startsWith('<style') ||
        (element as HTMLTextAreaElement).value?.includes('style')) {
        return null;
    }

    // 获取纯文本内容，移除多余的空白字符
    const text = element.textContent?.replace(/\s+/g, ' ').trim();
    if (!text || text.includes('<style')) {
        return null;
    }

    // 获取元素的位置信息，保证唯一性
    const rect = element.getBoundingClientRect();
    // 使用元素id、文本、位置信息创建唯一标识
    const uniqueKey = `${element.id ?? ''}:${text.slice(0, 50)}:${rect.left.toFixed(0)},${rect.top.toFixed(0)}`;

    return {
        tag: element.tagName.toLowerCase(),
        id: element.id || undefined,
        type: (element as HTMLInputElement).type || undefined,
        text,
        // @ts-ignore
        href: element.tagName.toLowerCase() === 'a' ? element.href : undefined,
        _domPath: uniqueKey, // 用于去重
        selector: selector
    };
};

const processElements = (option: {action:string[]}) => {

    const processedElements = new Map<string, any>();
    const results: any[] = [];

    // 处理交互式元素
    if (option.action.includes('interactive')) {
        const interactiveSelectors = 'a, button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
        const elements = document.querySelectorAll(interactiveSelectors);
        
        elements.forEach(el => {
            const element = el as HTMLElement;
            const result = processElement(element, undefined);
            if (result) {
                processedElements.set(result._domPath, result);
            }
        });
    }

    // 处理静态内容
    if (option.action.includes('static')) {
        const staticSelectors = 'p, h1, h2, h3, h4, h5, h6, div, span, article, section';
        const elements = document.querySelectorAll(staticSelectors);
        
        elements.forEach(el => {
            const element = el as HTMLElement;
            
            // 如果是div，检查是否是叶子节点
            if (element.tagName.toLowerCase() === 'div') {
                const hasBlockChildren = element.querySelector('p, div, h1, h2, h3, h4, h5, h6, article, section');
                if (hasBlockChildren) {
                    return;
                }
            }
            
            const result = processElement(element, undefined);
            if (result && !processedElements.has(result._domPath)) {
                processedElements.set(result._domPath, result);
            }
        });
    }

    // 将Map转换为结果数组，并移除_domPath字段
    processedElements.forEach(element => {
        delete element._domPath;
        results.push(element);
    });
    
    return results;
};


function functionToExecutableString(fn: Function, variableName: string): string {
    return `window.${variableName} = ${fn.toString()};`
}

const injectionScript = [
    functionToExecutableString(processElement, 'processElement'),
    functionToExecutableString(processElements, 'processElements')
].join('\n');

/**
 * Analyze web page content based on given options
 * @param options Configuration options for analysis
 * @returns Analysis result containing interactive elements and/or static content
 */
export const analyze = async (options: AnalyzeOptions): Promise<AnalyzeResult[]> => {
    if (!options.url && !options.title) {
        throw new Error('Either url or title must be provided');
    }

    const page: Page = await getPage({title: options.title, url: options.url});

    console.log('等待页面加载...');
    await waitForPageLoad(page);
    console.log('页面加载完成');

    // 默认只返回交互式元素
    const actions = options.action || ['interactive'];

    // 注入处理函数到浏览器环境
    await page.evaluate(injectionScript);

    // 一次性执行所有处理，减少DOM通信次数
    const results = await page.evaluate((opts) => {
        return processElements(opts);
    }, options);

    // 如果需要选择器，添加选择器信息
    if (options.with_selector && results.length > 0) {
        const elements = await Promise.all(
            actions.includes('interactive') 
                ? await page.$$('a, button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')
                : []
        );
        
        const staticElements = actions.includes('static') 
            ? await page.$$('p, h1, h2, h3, h4, h5, h6, div, span, article, section')
            : [];
        
        const allElements = [...elements, ...staticElements];
        
        // 获取所有元素的选择器
        const selectors = await Promise.all(
            allElements.map(element => getElementSelector(element))
        );
        
        // 为结果添加选择器
        for (let i = 0; i < Math.min(results.length, selectors.length); i++) {
            results[i].selector = selectors[i];
        }
    }

    return results;
};

