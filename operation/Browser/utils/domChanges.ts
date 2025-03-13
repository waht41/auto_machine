/**
 * DOM 变化检测工具
 * 
 * 提供监测 DOM 变化的功能，包括新增元素、删除元素和修改元素
 */

import { Page } from 'playwright';
import { DiffType, Diff, PropertyChange } from './objectDiff';
import { AnalyzeResult } from '../type';

/**
 * 表示 DOM 变化的类型
 */
export enum DomChangeType {
  ADDED = 'added',       // 新增 DOM 元素
  REMOVED = 'removed',   // 删除 DOM 元素
  MODIFIED = 'modified', // 修改 DOM 元素
  MODAL = 'modal'        // 模态框变化
}

/**
 * DOM 变化的结果
 */
export interface DomChangeResult {
  type: DomChangeType;
  element: AnalyzeResult;
  oldElement?: AnalyzeResult; // 对于 MODIFIED 类型，保存修改前的元素信息
  changes?: Record<string, PropertyChange>; // 详细的变化信息
}

/**
 * 将 DOM 变化结果转换为标准 Diff 格式
 * @param changes DOM 变化结果数组
 * @returns 标准 Diff 格式的数组
 */
export function convertToDiff(changes: DomChangeResult[]): Diff<AnalyzeResult>[] {
	return changes.map(change => {
		switch (change.type) {
			case DomChangeType.ADDED:
				return {
					type: DiffType.ADDED,
					item: change.element
				};
			case DomChangeType.REMOVED:
				return {
					type: DiffType.DELETED,
					item: change.element
				};
			case DomChangeType.MODIFIED:
			case DomChangeType.MODAL:
				return {
					type: DiffType.CHANGED,
					item: change.element,
					oldItem: change.oldElement,
					changes: change.changes
				};
			default:
				throw new Error(`未知的变化类型: ${change.type}`);
		}
	});
}

/**
 * 检测页面中模态框的存在
 * @param page Playwright Page 对象
 * @returns 如果存在模态框返回 true，否则返回 false
 */
export async function detectModalChanges(page: Page): Promise<boolean> {
	return await page.evaluate(() => {
		// 检查常见的模态框或弹出层标记
		const modalSelectors = [
			// 通用模态框类名
			'.modal', '.dialog', '.popup', '.overlay', '.drawer', 
			// 常用属性
			'[role="dialog"]', '[role="alertdialog"]', '[aria-modal="true"]',
			// Z-index 高的元素可能是模态框
			'div[style*="z-index"][style*="position: fixed"]',
			'div[style*="z-index"][style*="position: absolute"]'
		];
    
		// 检查是否存在任何模态框元素
		return modalSelectors.some(selector => {
			const elements = document.querySelectorAll(selector);
			return elements.length > 0 && Array.from(elements).some(el => 
				(el as HTMLElement).style.display !== 'none' && 
        (el as HTMLElement).checkVisibility()
			);
		});
	});
}

/**
 * 监听 DOM 变化
 * @param page Playwright Page 对象
 * @param callback 变化回调函数
 * @returns 停止监听的函数
 */
export async function observeDOMChanges(page: Page): Promise<AnalyzeResult[]> {
	// 注入 MutationObserver 脚本
	await page.evaluate(() => {
		// 如果已经存在观察器，先断开连接
		if ((window as any).__domObserver) {
			(window as any).__domObserver.disconnect();
		}
    
		// 存储变化的元素
		(window as any).__changedElements = [];
    
		// 创建新的观察器
		const observer = new MutationObserver((mutations) => {
			mutations.forEach(mutation => {
				// 处理新增节点
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach(node => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							(window as any).__changedElements.push({
								type: 'added',
								element: node
							});
						}
					});
          
					mutation.removedNodes.forEach(node => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							(window as any).__changedElements.push({
								type: 'removed',
								element: node
							});
						}
					});
				}
        
				// 处理属性变化
				if (mutation.type === 'attributes') {
					(window as any).__changedElements.push({
						type: 'modified',
						element: mutation.target,
						attribute: mutation.attributeName,
						oldValue: mutation.oldValue
					});
				}
        
				// 处理文本变化
				if (mutation.type === 'characterData') {
					(window as any).__changedElements.push({
						type: 'text',
						element: mutation.target.parentElement,
						oldValue: mutation.oldValue
					});
				}
			});
		});
    
		// 开始观察整个文档
		observer.observe(document.body, {
			childList: true,
			attributes: true,
			characterData: true,
			subtree: true,
			attributeOldValue: true,
			characterDataOldValue: true
		});
    
		// 保存观察器引用
		(window as any).__domObserver = observer;
	});
  
	// 返回空数组，实际变化会在后续通过 getObservedChanges 获取
	return [];
}
function functionToExecutableString(fn: Function, variableName: string): string {
	return `window.${variableName} = ${fn.toString()};`;
}


// 辅助函数：清理文本内容，移除HTML、CSS和JavaScript代码
const cleanTextContent = (element: Element): string => {
	// 创建一个临时元素的克隆
	const tempElement = element.cloneNode(true) as Element;

	// 移除所有脚本和样式标签
	const scriptsAndStyles = tempElement.querySelectorAll('script, style, link[rel="stylesheet"]');
	scriptsAndStyles.forEach(node => node.parentNode?.removeChild(node));

	// 获取清理后的文本
	let text = tempElement.textContent || '';

	// 移除可能的内联CSS和JavaScript代码
	text = text.replace(/{[^}]*}/g, ''); // 移除CSS大括号内容
	text = text.replace(/javascript:[^;]*/g, ''); // 移除JavaScript代码

	// 规范化空白
	text = text.replace(/\s+/g, ' ').trim();

	return text;
};
// 辅助函数：清理特定属性值
const cleanAttributeValue = (value: string | null | undefined): string | undefined => {
	if (!value) return undefined;

	// 处理 javascript: 链接
	if (value.startsWith('javascript:')) {
		return 'javascript:void(0)';
	}

	return value;
};
const injectionScript = [
	functionToExecutableString(cleanTextContent, 'cleanTextContent'),
	functionToExecutableString(cleanAttributeValue, 'cleanAttributeValue')
].join('\n');
/**
 * 获取观察到的 DOM 变化
 * @param page Playwright Page 对象
 * @returns DOM 变化结果数组
 */
export async function getObservedChanges(page: Page): Promise<AnalyzeResult[]> {
	await page.evaluate(injectionScript);
	return await page.evaluate(() => {
		// 获取变化的元素
		const changedElements = (window as any).__changedElements || [];
    
		// 清空变化记录
		(window as any).__changedElements = [];
    
		// 处理变化的元素
		const processedElements = new Map();

		changedElements.forEach(change => {
			const element = change.element;
			if (!element || !(element as HTMLElement).checkVisibility) {
				return;
			}
      
			// 跳过不可见元素
			if (!(element as HTMLElement).checkVisibility()) {
				return;
			}
      
			// 跳过样式相关元素
			if (element.tagName?.toLowerCase() === 'style' || 
          element.tagName?.toLowerCase() === 'script' ||
          element.id?.includes('css') ||
          element.id?.includes('style')) {
				return;
			}
      
			// 获取清理后的文本内容
			const text = cleanTextContent(element);
      
			// 如果文本为空或仍然包含可疑内容，则跳过
			if (!text || text.includes('<style') || text.includes('function(') || text.length > 500) {
				return;
			}
      
			// 创建选择器路径
			let selector = '';
			if (element.id) {
				selector = `#${element.id}`;
			} else {
				// 简单的选择器生成
				try {
					let current = element;
					const parts = [];
          
					while (current && current !== document.body) {
						let part = current.tagName.toLowerCase();
            
						if (current.id) {
							part = `#${current.id}`;
							parts.unshift(part);
							break;
						}
            
						if (current.classList && current.classList.length > 0) {
							part += `.${Array.from(current.classList).join('.')}`;
						}
            
						const siblings = Array.from(current.parentElement?.children || [])
							.filter(el => el.tagName === current.tagName);
            
						if (siblings.length > 1) {
							const index = siblings.indexOf(current as Element) + 1;
							part += `:nth-child(${index})`;
						}
            
						parts.unshift(part);
						current = current.parentElement;
					}
          
					selector = parts.join(' > ');
				} catch (e) {
					// 如果选择器生成失败，使用标签名
					selector = element.tagName.toLowerCase();
				}
			}
      
			// 创建元素信息对象
			const elementInfo = {
				tag: element.tagName.toLowerCase(),
				id: element.id || undefined,
				type: (element as HTMLInputElement).type || undefined,
				text,
				href: cleanAttributeValue(element.tagName.toLowerCase() === 'a' ? (element as HTMLAnchorElement).href : undefined),
				selector,
				changeType: change.type
			};
      
			// 使用选择器作为键，避免重复
			processedElements.set(selector, elementInfo);
		});
    
		return Array.from(processedElements.values());
	});
}

/**
 * 直接检测页面中的 DOM 变化，不依赖 analyze 函数
 * @param page Playwright Page 对象
 * @returns DOM 变化结果数组
 */
export async function detectPageChanges(page: Page): Promise<Diff<AnalyzeResult>[]> {
	// 获取变化的元素
	const changedElements = await getObservedChanges(page);
  
	// 检测模态框
	const hasModal = await detectModalChanges(page);
  
	// 转换为 Diff 格式
	const changes: Diff<AnalyzeResult>[] = changedElements.map(element => {
		const changeType = element['changeType'];
		delete element['changeType'];
    
		// 过滤掉文本过长的元素
		if (element.text && element.text.length > 500) {
			element.text = element.text.substring(0, 500) + '...';
		}
    
		switch (changeType) {
			case 'added':
				return {
					type: DiffType.ADDED,
					item: element
				};
			case 'removed':
				return {
					type: DiffType.DELETED,
					item: element
				};
			case 'modified':
			case 'text':
				return {
					type: DiffType.CHANGED,
					item: element,
					changes: {
						text: {
							oldValue: '(旧值未捕获)',
							newValue: element.text
						}
					}
				};
			default:
				return {
					type: DiffType.ADDED,
					item: element
				};
		}
	});
  
	// 如果检测到模态框，添加模态框变化
	if (hasModal) {
		// 查找可能的模态框元素
		const modalElements = changedElements.filter(el => 
			el.selector?.includes('modal') || 
      el.selector?.includes('dialog') || 
      el.selector?.includes('popup') || 
      el.selector?.includes('overlay') ||
      el.tag === 'dialog'
		);
    
		if (modalElements.length > 0) {
			// 标记为模态框变化
			modalElements.forEach(element => {
				changes.push({
					type: DiffType.ADDED,
					item: {
						...element,
						isModal: true
					}
				});
			});
		} else {
			// 如果没有找到明确的模态框元素，添加一个通用的模态框变化
			changes.push({
				type: DiffType.ADDED,
				item: {
					tag: 'div',
					text: '检测到模态框或弹出层',
					selector: '[role="dialog"]',
					isModal: true
				} as AnalyzeResult
			});
		}
	}
  
	return changes;
}
