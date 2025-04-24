// Analyze操作的类型定义

export interface RawOptions {
    content: string;
    path?: string;
}

export interface TransformOptions {
    from: string;
    rule: string;
    to: string;
}

export interface FilterOptions {
    from: string;
    rule: string;
    to: string;
}

export type GatherOptions =
  { action: 'raw' } & RawOptions |
  { action: 'transform' } & TransformOptions |
  { action: 'filter' } & FilterOptions;

// 通用的分析操作结果接口
export interface AnalyzeResult<T = any> {
    success: boolean;
    data?: T;
    message?: string;
}
