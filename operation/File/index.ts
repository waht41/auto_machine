// 显式合并子模块
import * as list from './list';
import * as type from './type';
import * as read from './read';
import * as edit from './edit';
import * as create from './create';
import * as search from './search';

export default { ...list, ...type, ...read, ...edit, ...create, ...search };