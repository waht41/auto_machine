import { GatherCommand } from '@core/internal-implementation/type';
import { handleFilter, handleRawData, handleTransform } from '@operation/Analyze';


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
		default:
			return 'error, unknown action type when gathering';
	}
}
