import { Page } from 'playwright';
import { getElementSelector, getPage, waitForPageLoad } from './common';
import { AnalyzeOptions, AnalyzeResult } from "./type";

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