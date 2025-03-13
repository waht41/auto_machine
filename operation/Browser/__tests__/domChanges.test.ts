/**
 * DOM 变化检测工具测试
 */

import { Page } from 'playwright';
import { detectModalChanges, convertToDiff } from '../utils/domChanges';
import { getPage } from '../common';
import { AnalyzeResult } from '../type';
import { DiffType } from '../utils/objectDiff';

// 增加测试超时时间
jest.setTimeout(30000);

describe('DOM 变化检测测试', () => {
	let page: Page;
	const content = `
    <!DOCTYPE html>
      <html>
      <head>
        <title>DOM 变化测试</title>
        <style>
          .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            background: rgba(255,255,255,0.9);
            border: 1px solid #ccc;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        <div id="app">
          <h1>DOM 变化测试</h1>
          <button id="addBtn">添加元素</button>
          <button id="removeBtn">删除元素</button>
          <button id="modifyBtn">修改元素</button>
          <button id="showModalBtn">显示模态框</button>
          <div id="elementContainer">
            <p id="element1" class="static-element">这是一个静态元素</p>
          </div>
          <div id="modal" class="modal">
            <h2>这是一个模态框</h2>
            <button id="closeModalBtn">关闭</button>
          </div>
        </div>

        <script>
          // 添加元素按钮
          document.getElementById('addBtn').addEventListener('click', () => {
            const newElement = document.createElement('p');
            newElement.id = 'element2';
            newElement.innerText = '这是一个新元素';
            document.getElementById('elementContainer').appendChild(newElement);
          });

          // 删除元素按钮
          document.getElementById('removeBtn').addEventListener('click', () => {
            const element = document.getElementById('element1');
            if (element) element.remove();
          });

          // 修改元素按钮
          document.getElementById('modifyBtn').addEventListener('click', () => {
            const element = document.getElementById('element1');
            if (element) element.innerText = '这个元素被修改了';
          });

          // 显示模态框按钮
          document.getElementById('showModalBtn').addEventListener('click', () => {
            document.getElementById('modal').style.display = 'block';
          });

          // 关闭模态框按钮
          document.getElementById('closeModalBtn').addEventListener('click', () => {
            document.getElementById('modal').style.display = 'none';
          });
        </script>
      </body>
      </html>
  `;
  
	// 辅助函数，获取元素信息
	async function getElementsInfo(page: Page): Promise<AnalyzeResult[]> {
		return await page.evaluate(() => {
			const elements = Array.from(document.querySelectorAll('p'));
			return elements.map(el => ({
				tag: el.tagName.toLowerCase(),
				id: el.id,
				text: el.textContent,
				selector: `#${el.id}`
			}));
		});
	}

	beforeAll(async () => {
		// 创建一个测试页面
		page = await getPage({ createNew: true });
	});
	beforeEach(async () => {
		await page.reload();
		await page.setContent(content);
	});

	afterAll(async () => {
		await page.close();
	});

	// 测试元素添加
	test('应该正确检测元素添加', async () => {
		// 重置页面内容
		await page.waitForSelector('#addBtn');
    
		// 提取初始元素
		const beforeElements = await getElementsInfo(page);

		// 添加新元素
		await page.click('#addBtn');
		await page.waitForTimeout(500); // 等待元素添加完成

		// 提取修改后的元素
		const afterElements = await getElementsInfo(page);

		// 检测变化
		const changes = await detectDomChanges(page, beforeElements, afterElements);
		const diffs = convertToDiff(changes);

		// 验证结果
		expect(diffs.length).toBe(1);
		expect(diffs[0].type).toBe(DiffType.ADDED);
		expect(diffs[0].item.id).toBe('element2');
	});

	// 测试元素删除
	test('应该正确检测元素删除', async () => {
		// 重置页面内容
		await page.waitForSelector('#removeBtn');
    
		// 提取初始元素
		const beforeElements = await getElementsInfo(page);

		// 删除元素
		await page.click('#removeBtn');
		await page.waitForTimeout(500); // 等待元素删除完成

		// 提取修改后的元素
		const afterElements = await getElementsInfo(page);

		// 检测变化
		const changes = await detectDomChanges(page, beforeElements, afterElements);
		const diffs = convertToDiff(changes);

		// 验证结果
		expect(diffs.length).toBe(1);
		expect(diffs[0].type).toBe(DiffType.DELETED);
		expect(diffs[0].item.id).toBe('element1');
	});

	// 测试元素修改
	test('应该正确检测元素修改', async () => {
		// 重置页面内容
		await page.waitForSelector('#modifyBtn');
    
		// 提取初始元素
		const beforeElements = await getElementsInfo(page);

		// 修改元素
		await page.click('#modifyBtn');
		await page.waitForTimeout(500); // 等待元素修改完成

		// 提取修改后的元素
		const afterElements = await getElementsInfo(page);

		// 检测变化
		const changes = await detectDomChanges(page, beforeElements, afterElements);
		const diffs = convertToDiff(changes);

		// 验证结果
		expect(diffs.length).toBe(1);
		expect(diffs[0].type).toBe(DiffType.CHANGED);
		expect(diffs[0].item.id).toBe('element1');
		expect(diffs[0].changes?.text).toBeDefined();
	});

	// 测试模态框检测
	test('应该正确检测模态框', async () => {
		// 重置页面内容
		await page.waitForSelector('#showModalBtn');

		// 检查初始状态
		let hasModal = await detectModalChanges(page);
		expect(hasModal).toBe(false);

		// 显示模态框
		await page.click('#showModalBtn');
		await page.waitForTimeout(500); // 等待模态框显示

		// 检查模态框是否显示
		hasModal = await detectModalChanges(page);
		expect(hasModal).toBe(true);

		// 关闭模态框
		await page.click('#closeModalBtn');
		await page.waitForTimeout(500); // 等待模态框关闭

		// 检查模态框是否关闭
		hasModal = await detectModalChanges(page);
		expect(hasModal).toBe(false);
	});

	// 测试文本清理功能
	test('应该正确清理包含HTML和CSS的文本内容', async () => {
		// 创建一个包含HTML和CSS的测试页面
		const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>文本清理测试</title>
      </head>
      <body>
        <div id="container">
          <div id="content">
            这是正常文本
            <style>
              .hidden { display: none; }
              #test { color: red; }
            </style>
            <script>
              function test() {
                console.log('测试');
              }
            </script>
            <div id="test">这是另一段正常文本</div>
          </div>
        </div>
        <button id="testBtn">点击测试</button>
        <script>
          document.getElementById('testBtn').addEventListener('click', () => {
            const div = document.createElement('div');
            div.id = 'dynamicContent';
            div.innerHTML = '动态添加的内容 <style>.test{color:blue;}</style>';
            document.body.appendChild(div);
          });
        </script>
      </body>
      </html>
    `;

		// 设置页面内容
		await page.setContent(testHtml);
    
		// 开始监听DOM变化
		await observeDOMChanges(page);
    
		// 点击按钮添加带有样式的内容
		await page.click('#testBtn');
    
		// 获取变化
		const changes = await detectPageChanges(page);
    
		// 验证结果
		expect(changes.length).toBeGreaterThan(0);
    
		// 查找动态添加的内容
		const addedContent = changes.find(change => 
			change.type === 'added' && 
      change.item.id === 'dynamicContent'
		);
    
		expect(addedContent).toBeDefined();
		if (addedContent) {
			// 验证文本内容不包含样式代码
			expect(addedContent.item.text).toBe('动态添加的内容');
			expect(addedContent.item.text).not.toContain('style');
			expect(addedContent.item.text).not.toContain('color:blue');
		}
	});

	// 测试JavaScript链接处理
	test('应该正确处理JavaScript链接', async () => {
		// 创建一个包含JavaScript链接的测试页面
		const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>JavaScript链接测试</title>
      </head>
      <body>
        <a id="jsLink" href="javascript:alert('测试')">JavaScript链接</a>
        <a id="normalLink" href="https://example.com">普通链接</a>
        <button id="addLinkBtn">添加链接</button>
        
        <script>
          document.getElementById('addLinkBtn').addEventListener('click', () => {
            const link = document.createElement('a');
            link.id = 'dynamicLink';
            link.href = 'javascript:void(function(){var complex = "code"; console.log(complex);})';
            link.textContent = '动态JavaScript链接';
            document.body.appendChild(link);
          });
        </script>
      </body>
      </html>
    `;

		// 设置页面内容
		await page.setContent(testHtml);
    
		// 开始监听DOM变化
		await observeDOMChanges(page);
    
		// 点击按钮添加JavaScript链接
		await page.click('#addLinkBtn');
    
		// 获取变化
		const changes = await detectPageChanges(page);
    
		// 验证结果
		expect(changes.length).toBeGreaterThan(0);
    
		// 查找动态添加的链接
		const addedLink = changes.find(change => 
			change.type === 'added' && 
      change.item.id === 'dynamicLink'
		);
    
		expect(addedLink).toBeDefined();
		if (addedLink) {
			// 验证href属性已被简化
			expect(addedLink.item.href).toBe('javascript:void(0)');
			expect(addedLink.item.text).toBe('动态JavaScript链接');
		}
	});
});
