/**
 * 交互功能测试
 */

import { Page } from 'playwright';
import { getPage } from '../common';
import { interact } from '../interact';

// 增加测试超时时间
jest.setTimeout(30000);

describe('交互功能测试', () => {
	let page: Page;
	const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>交互测试</title>
      <style>
        .modal {
          display: none;
          position: fixed;
          z-index: 1000;
          background: rgba(255,255,255,0.9);
          border: 1px solid #ccc;
          padding: 20px;
        }
        #result {
          margin-top: 20px;
          padding: 10px;
          border: 1px solid #ddd;
        }
      </style>
    </head>
    <body>
      <div id="app">
        <h1>交互测试</h1>
        <button id="addBtn">添加元素</button>
        <button id="showModalBtn">显示模态框</button>
        <input id="textInput" type="text" placeholder="输入文本">
        <div id="result"></div>
        <div id="elementContainer"></div>
        <div id="modal" class="modal">
          <h2>这是一个模态框</h2>
          <button id="closeModalBtn">关闭</button>
        </div>
      </div>

      <script>
        // 添加元素按钮
        document.getElementById('addBtn').addEventListener('click', () => {
          const newElement = document.createElement('p');
          newElement.id = 'dynamicElement';
          newElement.innerText = '这是动态添加的元素';
          document.getElementById('elementContainer').appendChild(newElement);
          document.getElementById('result').innerText = '添加了新元素';
        });

        // 显示模态框按钮
        document.getElementById('showModalBtn').addEventListener('click', () => {
          document.getElementById('modal').style.display = 'block';
          document.getElementById('result').innerText = '显示了模态框';
        });

        // 关闭模态框按钮
        document.getElementById('closeModalBtn').addEventListener('click', () => {
          document.getElementById('modal').style.display = 'none';
          document.getElementById('result').innerText = '关闭了模态框';
        });

        // 文本输入框
        document.getElementById('textInput').addEventListener('input', (e) => {
          document.getElementById('result').innerText = '输入了: ' + e.target.value;
        });
      </script>
    </body>
    </html>
  `;

	beforeAll(async () => {
		// 创建一个测试页面
		page = await getPage({ createNew: true });
	});

	beforeEach(async () => {
		await page.reload();
		await page.setContent(testHtml);
	});

	afterAll(async () => {
		await page.close();
	});

	// 测试点击交互
	test('点击按钮应该检测到 DOM 变化', async () => {
		// 模拟页面标题
		jest.spyOn(page, 'title').mockResolvedValue('交互测试');
    
		// 执行交互
		const result = await interact({
			title: '交互测试',
			selector: '#addBtn',
			action: 'click'
		});

		// 验证结果
		expect(result.success).toBe(true);
		expect(result.data.changes.length).toBeGreaterThan(0);
    
		// 至少应该有一个添加的元素
		const addedElements = result.data.changes.filter(change => change.type === 'added');
		expect(addedElements.length).toBeGreaterThan(0);
    
		// 验证页面上的实际变化
		const dynamicElement = await page.$('#dynamicElement');
		expect(dynamicElement).not.toBeNull();
	});

	// 测试输入交互
	test('输入文本应该检测到 DOM 变化', async () => {
		// 模拟页面标题
		jest.spyOn(page, 'title').mockResolvedValue('交互测试');
    
		// 执行交互
		const result = await interact({
			title: '交互测试',
			selector: '#textInput',
			action: 'input',
			text: '测试文本',
			enter: false
		});

		// 验证结果
		expect(result.success).toBe(true);
		expect(result.data.changes.length).toBeGreaterThan(0);
    
		// 验证页面上的实际变化
		const resultText = await page.$eval('#result', el => el.textContent);
		expect(resultText).toContain('测试文本');
	});

	// 测试模态框交互
	test('显示模态框应该检测到模态框变化', async () => {
		// 模拟页面标题
		jest.spyOn(page, 'title').mockResolvedValue('交互测试');
    
		// 执行交互
		const result = await interact({
			title: '交互测试',
			selector: '#showModalBtn',
			action: 'click'
		});

		// 验证结果
		expect(result.success).toBe(true);
		expect(result.data.changes.length).toBeGreaterThan(0);
    
		// 应该检测到模态框
		const modalElements = result.data.changes.filter(change => 
			change.item.selector?.includes('modal') || 
      (change.item as any).isModal
		);
		expect(modalElements.length).toBeGreaterThan(0);
    
		// 验证页面上的实际变化
		const modalStyle = await page.$eval('#modal', el => (el as HTMLElement).style.display);
		expect(modalStyle).toBe('block');
	});
});
