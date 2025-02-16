import { getPage, getPages } from './common';
import { InteractOptions, BrowserResult, AnalyzeResult } from './type';

export async function interact(options: InteractOptions, analyzeResult?: AnalyzeResult[]): Promise<BrowserResult> {

    if (!options.url && !options.title) {
        throw new Error('交互操作需要提供url或title,从而指定页面');
    }

    const pages = await getPages();
    const page = await getPage({url: options.url, title: options.title});
    
    let selector = options.selector;
    if (!selector) {
        if (options.id) {
            selector = `#${options.id}`;
        } else if (options.text) {
            selector = `text=${options.text}`;
        } else if (options.tag) {
            selector = options.tag;
        } else {
            throw new Error('需要提供选择器或者id/text/tag中的一个');
        }
    }

    const wait = options.timeout ?? 3; // 默认等待3秒

    // 等待元素出现
    await page.waitForSelector(selector, {
        timeout: wait * 1000
    });

    switch (options.action) {
        case 'click':
            const count = options.count ?? 1;
            for (let i = 0; i < count; i++) {
                await page.click(selector);
            }
            break;

        case 'input':
            if (!options.text) {
                throw new Error('输入操作需要提供text参数');
            }

            if (options.clear) {
                await page.fill(selector, ''); // 清空输入框
            }
            await page.fill(selector, options.text);
            if (options.enter ?? true) {  // 默认为true，按回车键
                await page.press(selector, 'Enter');
            }
            break;

        default:
            throw new Error('不支持的交互操作');
    }

    await page.waitForTimeout(1000);  // 等待1秒

    const newPages = (await getPages()).filter(p => !pages.includes(p));  // 获取新打开的页面
    const isCreateNewPage = newPages.length > 0;  // 判断是否创建了新页面

    return {
        success: true,
        page: page,
        isNewPage: isCreateNewPage,  // 返回是否创建了新页面的信息
        data: isCreateNewPage ? newPages.map(p => {
            return {
                url: p.url(), title: p.title()
            }
        }) : undefined
    };

}
