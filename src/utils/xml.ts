/** 解析 XML 属性字符串为键值对对象 */
export function parseXml(attributeStr: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	// 增强正则以处理属性间可能存在的空格
	const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^"'\s]+))/g;
	let attrMatch;

	while ((attrMatch = attrRegex.exec(attributeStr)) !== null) {
		const key = attrMatch[1];
		// 优先捕获带引号的值，最后是无引号的值
		const value = attrMatch[2] || attrMatch[3] || attrMatch[4] || '';
		attributes[key] = value.trim();
	}
	return attributes;
}