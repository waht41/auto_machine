import { diffObjects, diffArrays, DiffType, isEqual, IdExtractor, calculateSimilarity, DiffOptions } from '../utils/objectDiff';

describe('isEqual function', () => {
	test('should correctly compare primitive values', () => {
		expect(isEqual(1, 1)).toBe(true);
		expect(isEqual('test', 'test')).toBe(true);
		expect(isEqual(true, true)).toBe(true);
		expect(isEqual(null, null)).toBe(true);
		expect(isEqual(undefined, undefined)).toBe(true);
    
		expect(isEqual(1, 2)).toBe(false);
		expect(isEqual('test', 'other')).toBe(false);
		expect(isEqual(true, false)).toBe(false);
		expect(isEqual(null, undefined)).toBe(false);
	});
  
	test('should correctly compare arrays', () => {
		expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true);
		expect(isEqual(['a', 'b'], ['a', 'b'])).toBe(true);
		expect(isEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    
		expect(isEqual([1, 2, 3], [1, 2, 4])).toBe(false);
		expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
		expect(isEqual([1, [2, 3]], [1, [2, 4]])).toBe(false);
	});
  
	test('should correctly compare objects', () => {
		expect(isEqual({a: 1, b: 2}, {a: 1, b: 2})).toBe(true);
		expect(isEqual({a: {b: 1}}, {a: {b: 1}})).toBe(true);
    
		expect(isEqual({a: 1, b: 2}, {a: 1, b: 3})).toBe(false);
		expect(isEqual({a: 1, b: 2}, {a: 1})).toBe(false);
		expect(isEqual({a: {b: 1}}, {a: {b: 2}})).toBe(false);
	});
});

describe('calculateSimilarity function', () => {
	test('should correctly calculate similarity between objects', () => {
		// Simple objects
		const obj1 = { name: 'John', age: 30, tags: ['a', 'b'] };
		const obj2 = { name: 'Johnny', age: 32, tags: ['a', 'c'] };
    
		const similarity = calculateSimilarity(obj1, obj2);
		expect(similarity).toBeGreaterThan(0.5);
		expect(similarity).toBeLessThan(1);
    
		// Different objects should have low similarity
		const obj3 = { name: 'Alice', age: 25, tags: ['x', 'y'] };
		const diff1 = calculateSimilarity(obj1, obj3);
		expect(diff1).toBeLessThan(similarity);
    
		// Identical objects should have similarity 1
		expect(calculateSimilarity(obj1, obj1)).toBe(1);
	});
  
	test('should apply weights to key fields', () => {
		const obj1 = { id: 'test', name: 'John', value: 100 };
		const obj2 = { id: 'test', name: 'Johnny', value: 100 };
		const obj3 = { id: 'different', name: 'John', value: 100 };
    
		// Without weight, obj1 and obj2 should be more similar (only name differs)
		const simWithoutWeight = calculateSimilarity(obj1, obj2);
    
		// With weight on id, obj1 and obj3 should be less similar
		const options: DiffOptions = { keyFields: ['id'] };
		const simWithWeight = calculateSimilarity(obj1, obj3, options);
    
		expect(simWithWeight).toBeLessThan(simWithoutWeight);
	});
});

describe('diffObjects function (legacy)', () => {
  // Define test data
  interface TestItem {
    id: number;
    name: string;
    value: number;
    tags?: string[];
  }
  
  const oldItems: TestItem[] = [
  	{ id: 1, name: 'Item 1', value: 100 },
  	{ id: 2, name: 'Item 2', value: 200 },
  	{ id: 3, name: 'Item 3', value: 300, tags: ['tag1', 'tag2'] }
  ];
  
  const newItems: TestItem[] = [
  	{ id: 1, name: 'Item 1 Updated', value: 100 }, // Changed name
  	{ id: 3, name: 'Item 3', value: 350, tags: ['tag1', 'tag3'] }, // Changed value and tags
  	{ id: 4, name: 'Item 4', value: 400 } // Added item
  ];
  
  test('should detect added items', () => {
  	const result = diffObjects(oldItems, newItems, 'id');
  	const addedItems = result.filter(diff => diff.type === DiffType.ADDED);
    
  	expect(addedItems).toHaveLength(1);
  	expect(addedItems[0].item.id).toBe(4);
  	expect(addedItems[0].item.name).toBe('Item 4');
  });
  
  test('should detect deleted items', () => {
  	const result = diffObjects(oldItems, newItems, 'id');
  	const deletedItems = result.filter(diff => diff.type === DiffType.DELETED);
    
  	expect(deletedItems).toHaveLength(1);
  	expect(deletedItems[0].item.id).toBe(2);
  	expect(deletedItems[0].item.name).toBe('Item 2');
  });
  
  test('should detect changed items', () => {
  	const result = diffObjects(oldItems, newItems, 'id');
  	const changedItems = result.filter(diff => diff.type === DiffType.CHANGED);
    
  	expect(changedItems).toHaveLength(2);
    
  	// Check first changed item
  	const item1Changes = changedItems.find(item => item.item.id === 1);
  	expect(item1Changes).toBeDefined();
  	expect(item1Changes?.changes?.name.oldValue).toBe('Item 1');
  	expect(item1Changes?.changes?.name.newValue).toBe('Item 1 Updated');
    
  	// Check second changed item
  	const item3Changes = changedItems.find(item => item.item.id === 3);
  	expect(item3Changes).toBeDefined();
  	expect(item3Changes?.changes?.value.oldValue).toBe(300);
  	expect(item3Changes?.changes?.value.newValue).toBe(350);
  	expect(item3Changes?.changes?.tags.oldValue).toEqual(['tag1', 'tag2']);
  	expect(item3Changes?.changes?.tags.newValue).toEqual(['tag1', 'tag3']);
  });
  
  test('should work with a custom ID extractor function', () => {
  	const idExtractor: IdExtractor<TestItem, number> = (item) => item.id;
  	const result = diffObjects(oldItems, newItems, idExtractor);
    
  	// Should have the same results as using the field name
  	expect(result).toHaveLength(4); // 1 added + 1 deleted + 2 changed
    
  	const addedItems = result.filter(diff => diff.type === DiffType.ADDED);
  	expect(addedItems).toHaveLength(1);
  	expect(addedItems[0].item.id).toBe(4);
    
  	const deletedItems = result.filter(diff => diff.type === DiffType.DELETED);
  	expect(deletedItems).toHaveLength(1);
  	expect(deletedItems[0].item.id).toBe(2);
    
  	const changedItems = result.filter(diff => diff.type === DiffType.CHANGED);
  	expect(changedItems).toHaveLength(2);
  });
  
  test('should handle empty arrays', () => {
  	const emptyArray: TestItem[] = [];
    
  	// All items should be added
  	const addResult = diffObjects(emptyArray, oldItems, 'id');
  	expect(addResult).toHaveLength(3);
  	expect(addResult.every(diff => diff.type === DiffType.ADDED)).toBe(true);
    
  	// All items should be deleted
  	const deleteResult = diffObjects(oldItems, emptyArray, 'id');
  	expect(deleteResult).toHaveLength(3);
  	expect(deleteResult.every(diff => diff.type === DiffType.DELETED)).toBe(true);
    
  	// No differences when both arrays are empty
  	const emptyResult = diffObjects(emptyArray, emptyArray, 'id');
  	expect(emptyResult).toHaveLength(0);
  });
  
  test('should handle complex nested objects', () => {
    interface ComplexItem {
      id: string;
      data: {
        nested: {
          value: number;
          items: string[];
        }
      }
    }
    
    const oldComplex: ComplexItem[] = [{
    	id: 'complex1',
    	data: {
    		nested: {
    			value: 42,
    			items: ['a', 'b', 'c']
    		}
    	}
    }];
    
    const newComplex: ComplexItem[] = [{
    	id: 'complex1',
    	data: {
    		nested: {
    			value: 43,
    			items: ['a', 'b', 'd']
    		}
    	}
    }];
    
    const result = diffObjects(oldComplex, newComplex, 'id');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(DiffType.CHANGED);
    
    const changes = result[0].changes;
    expect(changes?.data.oldValue.nested.value).toBe(42);
    expect(changes?.data.newValue.nested.value).toBe(43);
    expect(changes?.data.oldValue.nested.items).toEqual(['a', 'b', 'c']);
    expect(changes?.data.newValue.nested.items).toEqual(['a', 'b', 'd']);
  });
});

describe('diffArrays function', () => {
  // Test data similar to AnalyzeResult
  interface WebElement {
    selector?: string;
    tag: string;
    id?: string;
    type?: string;
    text?: string;
    href?: string;
  }
  
  const oldElements: WebElement[] = [
  	{ selector: 'div.main > button', tag: 'button', id: 'submit-btn', text: 'Submit Form' },
  	{ selector: 'div.main > input', tag: 'input', type: 'text', id: 'name-field' },
  	{ selector: 'div.main > a', tag: 'a', href: 'https://example.com', text: 'Visit Example' }
  ];
  
  const newElements: WebElement[] = [
  	{ selector: 'div.main > button', tag: 'button', id: 'submit-btn', text: 'Submit' }, // Text changed
  	{ selector: 'div.main > a', tag: 'a', href: 'https://example.org', text: 'Visit Example' }, // Href changed
  	{ selector: 'div.main > div', tag: 'div', text: 'New Element' } // New element
  ];
  
  test('should detect similarities based on object structure', () => {
  	const result = diffArrays(oldElements, newElements);
    
  	const addedItems = result.filter(diff => diff.type === DiffType.ADDED);
  	const deletedItems = result.filter(diff => diff.type === DiffType.DELETED);
  	const changedItems = result.filter(diff => diff.type === DiffType.CHANGED);
    
  	// One item added (the div)
  	expect(addedItems).toHaveLength(1);
  	expect(addedItems[0].item.tag).toBe('div');
    
  	// One item deleted (the input)
  	expect(deletedItems).toHaveLength(1);
  	expect(deletedItems[0].item.tag).toBe('input');
    
  	// Two items changed (button text and anchor href)
  	expect(changedItems).toHaveLength(2);
    
  	// Check button changes
  	const buttonChanges = changedItems.find(diff => diff.item.id === 'submit-btn');
  	expect(buttonChanges).toBeDefined();
  	expect(buttonChanges?.changes?.text.oldValue).toBe('Submit Form');
  	expect(buttonChanges?.changes?.text.newValue).toBe('Submit');
    
  	// Check anchor changes
  	const anchorChanges = changedItems.find(diff => diff.item.tag === 'a');
  	expect(anchorChanges).toBeDefined();
  	expect(anchorChanges?.changes?.href.oldValue).toBe('https://example.com');
  	expect(anchorChanges?.changes?.href.newValue).toBe('https://example.org');
  });
  
  test('should work with custom similarity options', () => {
  	// Options that give more weight to 'tag' field
  	const options: DiffOptions = {
  		similarityThreshold: 0.6,
  		keyFields: ['tag']
  	};
    
  	// Create test data with slight differences
  	const oldData = [
  		{ tag: 'div', id: 'container', text: 'Content A' },
  		{ tag: 'button', id: 'btn1', text: 'Click Me' }
  	];
    
  	const newData = [
  		{ tag: 'div', id: 'wrapper', text: 'Content A' }, // ID changed but tag same
  		{ tag: 'input', id: 'btn1', text: 'Click Me' } // Tag changed but ID same
  	];
    
  	const result = diffArrays(oldData, newData, options);
    
  	// The div should be detected as changed because tag has higher weight
  	const changedItems = result.filter(diff => diff.type === DiffType.CHANGED);
  	expect(changedItems.length).toBe(1);
  	expect(changedItems[0].item.tag).toBe('div');
  	expect(changedItems[0].changes?.id.oldValue).toBe('container');
  	expect(changedItems[0].changes?.id.newValue).toBe('wrapper');
    
  	// The button should be detected as deleted, and input as added (because tag changed)
  	const deletedItems = result.filter(diff => diff.type === DiffType.DELETED);
  	expect(deletedItems.length).toBe(1);
  	expect(deletedItems[0].item.tag).toBe('button');
    
  	const addedItems = result.filter(diff => diff.type === DiffType.ADDED);
  	expect(addedItems.length).toBe(1);
  	expect(addedItems[0].item.tag).toBe('input');
  });
  
  test('should handle empty arrays', () => {
  	const emptyArray: WebElement[] = [];
    
  	// All items should be added
  	const addResult = diffArrays(emptyArray, oldElements);
  	expect(addResult).toHaveLength(3);
  	expect(addResult.every(diff => diff.type === DiffType.ADDED)).toBe(true);
    
  	// All items should be deleted
  	const deleteResult = diffArrays(oldElements, emptyArray);
  	expect(deleteResult).toHaveLength(3);
  	expect(deleteResult.every(diff => diff.type === DiffType.DELETED)).toBe(true);
    
  	// No differences when both arrays are empty
  	const emptyResult = diffArrays(emptyArray, emptyArray);
  	expect(emptyResult).toHaveLength(0);
  });
  
  test('should handle real-world web page changes scenario', () => {
    // Simulate real-world AnalyzeResult objects from web pages
    interface AnalyzeResult {
      selector?: string;
      tag: string;
      id?: string;
      type?: string;
      text?: string;
      href?: string;
    }
    
    // First page snapshot
    const pageV1: AnalyzeResult[] = [
    	{ selector: '#header', tag: 'div', id: 'header', text: 'Website Header' },
    	{ selector: '#nav', tag: 'nav', id: 'nav', text: 'Home About Contact' },
    	{ selector: '.article', tag: 'article', text: 'Article content version 1' },
    	{ selector: '.footer', tag: 'footer', text: ' 2025 Company' }
    ];
    
    // Second page snapshot after changes
    const pageV2: AnalyzeResult[] = [
    	{ selector: '#header', tag: 'div', id: 'header', text: 'Website Header' }, // Unchanged
    	{ selector: '#nav', tag: 'nav', id: 'nav', text: 'Home Products About Contact' }, // Text changed
    	{ selector: '.new-banner', tag: 'div', text: 'Special Offer!' }, // Added
    	{ selector: '.article', tag: 'article', text: 'Article content version 2' }, // Text changed
    	{ selector: '.footer', tag: 'footer', text: ' 2025 Company' } // Unchanged
    ];
    
    const result = diffArrays(pageV1, pageV2);
    
    const addedItems = result.filter(diff => diff.type === DiffType.ADDED);
    const deletedItems = result.filter(diff => diff.type === DiffType.DELETED);
    const changedItems = result.filter(diff => diff.type === DiffType.CHANGED);
    
    // One new element added
    expect(addedItems).toHaveLength(1);
    expect(addedItems[0].item.selector).toBe('.new-banner');
    
    // No elements deleted
    expect(deletedItems).toHaveLength(0);
    
    // Two elements changed (nav and article)
    expect(changedItems).toHaveLength(2);
    
    // Check nav changes
    const navChanges = changedItems.find(diff => diff.item.id === 'nav');
    expect(navChanges).toBeDefined();
    expect(navChanges?.changes?.text.oldValue).toBe('Home About Contact');
    expect(navChanges?.changes?.text.newValue).toBe('Home Products About Contact');
    
    // Check article changes
    const articleChanges = changedItems.find(diff => diff.item.selector === '.article');
    expect(articleChanges).toBeDefined();
    expect(articleChanges?.changes?.text.oldValue).toBe('Article content version 1');
    expect(articleChanges?.changes?.text.newValue).toBe('Article content version 2');
  });
});
