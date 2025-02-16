// 显式合并子模块
import * as open from './open';
import * as search from './search';
import * as navigate from './navigate';
import * as interact from './interact';
import * as analyze from './analyze';
import * as state from './state';

export * from './type';
export default { ...open, ...search, ...navigate, ...interact, ...analyze, ...state };
