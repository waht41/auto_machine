import { Page } from 'playwright';
import { PageState } from './type';
import { getPages } from './common';

/**
 * 检查页面是否存在验证码
 * @param page Playwright Page 对象
 * @returns 验证码信息，如果没有验证码则返回 null
 */
async function checkCaptcha(page: Page) {
    // 常见验证码选择器
    const captchaSelectors = {
        recaptcha: [
            'iframe[src*="recaptcha"]',
            '.g-recaptcha',
            '#recaptcha'
        ],
        image: [
            'img[alt*="captcha" i]',
            'img[src*="captcha" i]',
            'input[name*="captcha" i]'
        ],
        other: [
            '[id*="captcha" i]',
            '[class*="captcha" i]',
            '[name*="captcha" i]'
        ]
    };

    for (const [type, selectors] of Object.entries(captchaSelectors)) {
        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    return {
                        selector,
                        type: type as 'recaptcha' | 'image' | 'other'
                    };
                }
            } catch {
                // 忽略选择器检查错误
                continue;
            }
        }
    }

    return null;
}

/**
 * 获取所有页面的状态信息
 * @returns 页面状态数组
 */
export async function state(): Promise<PageState[]> {
    const pages = await getPages();
    const states: PageState[] = [];

    for (const page of pages) {
        try {
            // 检查页面是否响应
            await page.evaluate(() => true);
            
            const url = page.url();
            const title = await page.title();
            let state: PageState['state'] = 'active';
            
            // 检查页面是否有验证码
            const captchaInfo = await checkCaptcha(page);
            if (captchaInfo) {
                state = 'captcha';
            }

            // 检查页面加载状态
            const loadState = await page.evaluate(() => document.readyState);
            if (loadState !== 'complete') {
                state = 'loading';
            }

            states.push({
                url,
                title,
                state,
                ...(captchaInfo && { captchaInfo })
            });
        } catch (error) {
            // 如果页面无法响应，标记为错误状态
            states.push({
                url: page.url(),
                title: '无法访问',
                state: 'error',
                error: error instanceof Error ? error.message : '页面无响应'
            });
        }
    }

    return states;
}
