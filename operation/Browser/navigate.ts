import { getPage } from './common';
import { NavigateOptions, BrowserResult } from './type';

export async function navigate(options: NavigateOptions): Promise<BrowserResult> {
    // 对于导航操作（back/forward/refresh），应该使用当前页面，而不是查找或创建新页面
    const page = await getPage({
        url: options.url,
        title: options.title,
        createNew: false  // 确保不会创建新页面
    });
    
    const timeout = options.timeout ?? 5000; // 默认5秒超时

    switch (options.action) {
        case 'back':
            await page.goBack({
                timeout,
                waitUntil: options.wait_until ?? 'networkidle'
            });
            break;
        case 'forward':
            await page.goForward({
                timeout,
                waitUntil: options.wait_until ?? 'networkidle'
            });
            break;
        case 'refresh':
            await page.reload({
                timeout,
                waitUntil: options.wait_until ?? 'networkidle'
            });
            break;
        default:
            throw new Error(`不支持的导航操作: ${options.action}`);
    }

    return {
        success: true,
        page: page
    };
}
