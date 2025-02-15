import path from "path";

export function shouldExclude(itemPath: string,exclude: string[]): boolean {
    const itemName = path.basename(itemPath);
    return exclude.some(pattern => {
        // 支持通配符匹配
        if (pattern.includes('*')) {
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*');
            return new RegExp(`^${regexPattern}$`).test(itemName);
        }
        return itemName === pattern;
    });
}