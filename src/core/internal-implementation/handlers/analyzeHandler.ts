import { GatherCommand, PreviewCommand } from '@core/internal-implementation/type';
import { handleFilter, handleRawData, handleReduce, handleTransform, preview } from '@operation/Analyze';
import yaml from 'js-yaml';

/**
 * 数据收集与处理主函数
 * @param options 数据处理选项
 * @returns 操作结果
 */
export async function gatherHandler(options: GatherCommand): Promise<string> {
	let result: string | undefined = '';
	switch (options.action) {
		case 'raw':
			result = (await handleRawData(options)).message;
			return result ?? 'error, no result returned when save csv';
		case 'transform':
			result = (await handleTransform(options)).message;
			return result ?? `error, no result returned when transform ${options.from}`;
		case 'filter':
			result = (await handleFilter(options)).message;
			return result ?? `error, no result returned when filter ${options.from}`;
		case 'reduce':
			const reduceRes = (await handleReduce(options));
			console.log('[waht]', 'reduce result:', reduceRes);
			result = result + '\n' + yaml.dump(reduceRes.data ?? '');

			return result ?? `error, no result returned when reduce ${options.from}`;
		default:
			return 'error, unknown action type when gathering';
	}
}

export async function previewHandler(options: PreviewCommand): Promise<string> {
	const res = await preview(options);
	if (!res.success) {
		return res.message ?? 'error, no result returned when previewing';
	}
	const data = res.data;
	const lines = data?.lines ?? [];
	let dataDump = '';
	if (lines.length > 100) {
		const previewLines = lines.slice(0, 10);
		const skippedLines = lines.length - 10;
		dataDump = yaml.dump({ ...data, lines: previewLines }, { skipInvalid: true })
			+ `\n// ... lines too long, skipped ${skippedLines} lines`;
	} else {
		dataDump = yaml.dump(data, { skipInvalid: true });
	}
	return res.message + '\n' + dataDump;
}

	