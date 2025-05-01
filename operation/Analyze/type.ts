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

export interface ReduceOptions {
    from: string;
    pairs: [string, string][];
}

export interface PreviewOptions {
    path: string;
    lines: {
        start: number;
        end: number;
    };
}

export type GatherOptions =
  { action: 'raw' } & RawOptions |
  { action: 'transform' } & TransformOptions |
  { action: 'filter' } & FilterOptions |
  { action: 'reduce' } & ReduceOptions;

// 通用的分析操作结果接口
export interface AnalyzeResult<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
}
