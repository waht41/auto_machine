// 显式合并子模块
import * as list from './list';
import * as type from './type';
import * as read from './read';
import * as edit from './edit';
import * as create from './create';
import * as search from './search';
import * as download from './download';
import * as rename from './rename';

export default { ...list, ...type, ...read, ...edit, ...create, ...search, ...download, ...rename };