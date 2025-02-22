import { ElementHandle, Page } from 'playwright';
import { getElementSelector, getPage, waitForPageLoad } from './common';
import { AnalyzeOptions, AnalyzeResult } from "./type";

// 递归检查元素可见性链条
const checkVisibilityChain = (node: Node | null): boolean => {
    // 终止条件：非元素节点或 null
    if (!(node instanceof HTMLElement)) return true;

    // 检查当前节点可见性
    const style = window.getComputedStyle(node);
    if (style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        node.hidden) {
        return false;
    }

    // 三路递归检查（普通父元素、Shadow Host、插槽宿主）
    return checkVisibilityChain(node.assignedSlot) &&          // 检查插槽链路
        checkVisibilityChain(node.parentElement) &&        // 检查常规父元素
        checkVisibilityChain(node.getRootNode().host);     // 检查 Shadow Host
};

// 浏览器端函数
const isElementVisible = (element: HTMLElement): boolean => {
    console.log('检查元素可见性', element);

    // 初始检查从目标元素开始
    return checkVisibilityChain(element);
};


const processElement = (element: HTMLElement): any => {
    // 检查元素是否可见
    if (!isElementVisible(element)) {
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

    return {
        tag: element.tagName.toLowerCase(),
        id: element.id || undefined,
        type: (element as HTMLInputElement).type || undefined,
        text,
        // @ts-ignore
        href: element.tagName.toLowerCase() === 'a' ? element.href : undefined,
        _domPath: element.id || text.slice(0, 50) // 用于去重
    };
};

// 转换函数
function functionToExecutableString(fn: Function, variableName: string): string {
    return `window.${variableName} = ${fn.toString()};`
}

// 生成注入代码
const injectionScript = [
    functionToExecutableString(checkVisibilityChain, 'checkVisibilityChain'),
    functionToExecutableString(isElementVisible, 'isElementVisible'),
    functionToExecutableString(processElement, 'processElement')
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
    const processedElements = new Set<string>();
    const results: AnalyzeResult[] = [];

    console.log('等待页面加载...');
    await waitForPageLoad(page);
    console.log('页面加载完成');

    // 默认只返回交互式元素
    const actions = options.action || ['interactive'];

    // 注入函数到浏览器环境
    await page.evaluate(injectionScript);

    // 处理交互式元素
    if (actions.includes('interactive')) {
        const interactiveElements = await page.$$eval(
            'a, button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])',
            (elements) => {
                return elements.map(el => processElement(el as HTMLElement)).filter(item => item !== null);
            }
        );

        // 添加到已处理元素集合
        interactiveElements.forEach(el => {
            if (el._domPath) {
                processedElements.add(el._domPath);
                delete el._domPath;
            }
            results.push(el);
        });
    }

    // 处理静态内容
    if (actions.includes('static')) {
        const staticElements = await page.$$eval(
            'p, h1, h2, h3, h4, h5, h6, div, span, article, section',
            (elements) => {
                return elements.map(el => {
                    const element = el as HTMLElement;
                    
                    // 如果是div，检查是否是叶子节点
                    if (element.tagName.toLowerCase() === 'div') {
                        const hasBlockChildren = element.querySelector('p, div, h1, h2, h3, h4, h5, h6, article, section');
                        if (hasBlockChildren) {
                            return null;
                        }
                    }

                    return processElement(element);
                }).filter(item => item !== null);
            }
        );
        
        // 只添加未处理过的元素
        staticElements.forEach(el => {
            if (el._domPath && !processedElements.has(el._domPath)) {
                delete el._domPath;
                results.push(el);
            }
        });
    }

    return results;
}