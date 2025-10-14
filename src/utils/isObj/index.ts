import type { IsObj } from './types/index.js'

/**
 * 判断一个数据是否为对象, 排除数组和函数
 * - 若需要将数组也视为对象应使用 isObject() 方法
 * - 若只需判断是否为引用类型应使用 isReferenceValue() 方法
 * - 需要一次性判断多个可以调用 isObject.all() 辅助方法
 * - 需要触发类型保护可以传入泛型
 * @param data 需要判断的数据
 * @returns boolean
 */
export const isObj = <T = IsObj>(data: any): data is T => {
	return typeof data === 'object' && data !== null && !Array.isArray(data)
}

/**
 * 判断传入的所有数据是否都为对象, 排除数组和函数
 * - 若需要将数组也视为对象应使用 isObject.all() 方法
 * - 若只需判断是否为引用类型应使用 isReferenceValue.all() 方法
 * - 暂无法触发类型保护
 * @param args 需要判断的数据
 * @returns boolean
 */
isObj.all = (...args: any[]) => {
	if (args.length === 0) return false
	return args.every(isObj)
}
