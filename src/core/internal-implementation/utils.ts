export function yamlWrap(value: string | string[]){
	if (Array.isArray(value)) {
		return '```yaml\n' + value.join('\n---\n') + '\n```';
	}
	return '```yaml\n' + value + '\n```';
}