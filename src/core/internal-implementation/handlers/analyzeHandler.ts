import { GatherCommand } from '@core/internal-implementation/type';
import { handleFilter, handleRawData, handleReduce, handleTransform } from '@operation/Analyze';
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
			console.log('[waht]','reduce result:',reduceRes);
			result = result + '\n' + yaml.dump(reduceRes.data??'');

			return result ?? `error, no result returned when reduce ${options.from}`;
		default:
			return 'error, unknown action type when gathering';
	}
}
