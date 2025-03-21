import { StreamChatManager } from '../StreamChatManager';
import { ApiHandler } from '@/api';
import { IApiConversationItem } from '../type';

// 模拟依赖
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('[]'),
}));

jest.mock('@/utils/fs', () => ({
  fileExistsAtPath: jest.fn().mockResolvedValue(false),
}));

describe('StreamChatManager', () => {
  let streamChatManager: StreamChatManager;
  let mockApiHandler: jest.Mocked<ApiHandler>;
  let mockSaveClineMessages: jest.Mock;

  const mockHistoryData = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<meta>historyId:1</meta>\n<task>\n测试变量存文件\n</task>'
        }
      ],
      ts: 1742531186448
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '<meta>historyId:2</meta>\n```yaml\ntool: external\nrequest: File\n```\n\n我将请求使用文件资源来完成这个任务。请稍等，我将获取文件资源的使用方式。'
        }
      ],
      ts: 1742531189236
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<meta>historyId:3</meta>\nuse tool \ntype: tool_use\nname: external\nparams:\n  request: File\npartial: false\n Result:'
        },
        {
          type: 'text',
          text: '<meta>historyId:4</meta>\n```yaml\n# 用于处理文件相关操作的工具\r\nlist:\r\n  description: 列出指定路径下的文件\r\n  params:\r\n    path: 路径\r\n    recursive: [optional]   # 是否递归列出,默认为 false\r\n    depth: [optional]       # 递归层数，默认为3，只在recursive为true时生效\r\n    exclude: [optional]     # 排除的文件夹或文件,支持*作为通配符\r\n  example:\r\n    - tool: file\r\n      cmd: list\r\n      path: /path/to/files\r\n      exclude: [\".git\", \".idea\", \"*.ts\"]\r\n      recursive: true\r\n      depth: 3\r\n\r\ncreate:\r\n  description: 创建文件\r\n  params:\r\n    path: 路径\r\n    content: [optional] # 文件内容\r\n  example:\r\n    - tool: file\r\n      cmd: create\r\n      path: /path/to/file.txt\r\n      content: 这是要存储的内容 <var historyId=5/>\r\n\r\nread:\r\n  description: 读取指定路径的文件\r\n  params:\r\n    path: 路径\r\n  example:\r\n    - tool: file\r\n      cmd: read\r\n      path: /path/to/file.txt\r\n\r\nedit:\r\n  description: 编辑指定路径的文件\r\n  cmd: edit\r\n  params:\r\n    action: \"insert|delete|replace\"  # 必选操作类型\r\n    path: 文件路径                                   # 必选\r\n    content: 文本内容                                # write/insert/overwrite/replace时必选\r\n    start: row,col                                  # 操作起始位置，默认为1,1（delete/replace时必选）\r\n    end: [rol,col]                                    # 操作结束位置（delete/replace时必选） [-1,-1]表示文件末尾\r\n  example:\r\n    - tool: file\r\n      cmd: edit\r\n      action: insert\r\n      start: [-1,-1]\r\n      content: \"Hello, World!\"\r\n\r\n\r\nsearch:\r\n  description: 在指定路径下搜索包含关键词的文件\r\n  params:\r\n    path: [optional] # 路径，默认为当前目录下\r\n    keyword: 关键词  # 可使用正则\r\n    exclude: [optional]\r\n  example:\r\n    - tool: file\r\n      cmd: search_file\r\n      keyword: /[1-9]/g\r\n\r\ndownload:\r\n    description: 下载文件\r\n    params:\r\n        url: 下载地址\r\n        path: 保存路径\r\n    example:\r\n        - tool: file\r\n          cmd: download\r\n          url: https://www.baidu.com/favicon.ico\r\n          path: ./download/favicon.ico  # 保存到当前目录下的download文件夹中\n```'
        }
      ],
      ts: 1742531189281
    },
  ] as IApiConversationItem[];

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 创建模拟对象
    mockApiHandler = {
      createMessage: jest.fn(),
      getModel: jest.fn().mockReturnValue({
        info: {
          supportsImages: true
        }
      })
    } as unknown as jest.Mocked<ApiHandler>;

    mockSaveClineMessages = jest.fn().mockResolvedValue(undefined);

    // 创建 StreamChatManager 实例
    streamChatManager = new StreamChatManager(
      'test-task-id',
      mockApiHandler,
      'test-task-dir',
      mockSaveClineMessages
    );
  });

  describe('getHistoryContentWithId', () => {
    it('应该返回匹配 historyId 的消息', () => {
      // 手动设置历史记录
      streamChatManager.apiConversationHistory = mockHistoryData;

      // 测试获取 historyId 为 1 的消息
      const result = streamChatManager.getHistoryContentWithId(1);
      
      // 验证结果
      expect(result).not.toBeNull();
      expect(result?.role).toBe('user');
      expect(Array.isArray(result?.content)).toBe(true);
      
      const content = result?.content as Array<{ type: string, text: string }>;
      expect(content[0].type).toBe('text');
      expect(content[0].text).toContain('<meta>historyId:1</meta>');
      expect(content[0].text).toContain('测试变量存文件');
    });

    it('应该返回匹配 historyId 为 2 的消息', () => {
      // 手动设置历史记录
      streamChatManager.apiConversationHistory = mockHistoryData;

      // 测试获取 historyId 为 2 的消息
      const result = streamChatManager.getHistoryContentWithId(2);
      
      // 验证结果
      expect(result).not.toBeNull();
      expect(result?.role).toBe('assistant');
      
      const content = result?.content as Array<{ type: string, text: string }>;
      expect(content[0].type).toBe('text');
      expect(content[0].text).toContain('<meta>historyId:2</meta>');
      expect(content[0].text).toContain('tool: external');
    });

    it('应该返回匹配 historyId 为 3 的消息', () => {
      // 手动设置历史记录
      streamChatManager.apiConversationHistory = mockHistoryData;

      // 测试获取 historyId 为 3 的消息
      const result = streamChatManager.getHistoryContentWithId(3);
      
      // 验证结果
      expect(result).not.toBeNull();
      expect(result?.role).toBe('user');
      
      const content = result?.content as Array<{ type: string, text: string }>;
      expect(content[0].type).toBe('text');
      expect(content[0].text).toContain('<meta>historyId:3</meta>');
      expect(content[0].text).toContain('use tool');
    });

    it('当 historyId 不存在时应该返回 null', () => {
      // 手动设置历史记录
      streamChatManager.apiConversationHistory = mockHistoryData;

      // 测试获取不存在的 historyId
      const result = streamChatManager.getHistoryContentWithId(999);
      
      // 验证结果
      expect(result).toBeNull();
    });

    it('当历史记录为空时应该返回 null', () => {
      // 设置空的历史记录
      streamChatManager.apiConversationHistory = [];

      // 测试获取任意 historyId
      const result = streamChatManager.getHistoryContentWithId(1);
      
      // 验证结果
      expect(result).toBeNull();
    });
  });
});
