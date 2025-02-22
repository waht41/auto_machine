// Browser操作的类型定义

export interface BrowserOptions {
    headless?: boolean;
    channel?: string;
    userDataDir?: string; // 用户数据目录路径，用于持久化存储
}

export interface OpenOptions {
    url: string;
    userDataDir?: string;    // 身份验证状态文件路径
}

export interface SearchOptions {
    keyword: string;
    engine?: 'google' | 'bing';  // 搜索引擎选项
}


export interface SearchResult {
    title: string;
    description: string;
    link: string;
}

export interface NavigateOptions {
    action: 'back' | 'forward' | 'refresh';
    title?: string;
    url?: string;
    timeout?: number;
    wait_until?: 'load' | 'domcontentloaded' | 'networkidle';
}

export type InteractOptions = {
    url?: string;
    title?: string;
    selector?: string;
    tag?: string;
    id?: string;
    text?: string;

    timeout?: number;      // 最多等待时间，单位为秒
} & (ClickOptions | InputOptions);

interface ClickOptions {
    action: 'click';
    count?: number;
}

interface InputOptions {
    action: 'input';
    text: string;
    clear?: boolean;
    enter?: boolean;    // 输入后是否按回车键，默认为true
}

export interface PageOptions {
    url?: string;       // 通过URL匹配页面
    title?: string;     // 通过标题匹配页面
    createNew?: boolean; // 是否创建新页面
    waitForUrl?: boolean; // 是否等待URL加载完成
    userDataDir?: string; // 用户数据目录路径
}

export interface AnalyzeOptions {
    url?: string;              // 网页URL
    title?: string;            // 页面标题
    action?: ('interactive' | 'static')[];  // 分析动作类型
    with_selector?: boolean;   // 是否返回选择器信息
}

export interface AnalyzeResult {
    selector?: string;         // 元素的选择器路径
    tag: string;              // 元素类型（标签名）
    id?: string;              // 元素ID
    type?: string;            // 元素类型
    text?: string;            // 文本内容
    href?: string;            // 链接URL（仅链接元素）
    html?: string;            // 静态HTML内容
}

export interface PageState {
    url: string;
    title: string;
    state: 'active' | 'loading' | 'error' | 'captcha';  // 页面状态
    error?: string;                         // 错误信息（如果状态是error）
    captchaInfo?: {                        // 验证码相关信息
        selector: string;                   // 验证码元素选择器
        type: 'image' | 'recaptcha' | 'other';  // 验证码类型
    };
    isCurrentPage?: boolean;  // 是否是当前页面
}

export interface AuthOptions {
    action: 'save'|'delete';
    url?: string;
    title?: string;
    path?: string;    // 保存身份验证状态的文件路径
}

export interface DownloadOptions {
    url: string;                // 文件URL
    path?: string;              // 保存路径
    userDataDir?: string;      // 用户数据目录路径
}

// 通用的浏览器操作结果接口
export interface BrowserResult<T = any> {
    success: boolean;
    data?: T;
    page?: any;
    isNewPage?: boolean;  // 是否创建了新页面
}
