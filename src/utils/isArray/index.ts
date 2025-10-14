/**
 * 判断一个数据是否为数组
 * - 需要一次性判断多个可以调用 isArray.all() 辅助方法
 * - 支持传入泛型
 * @param data 需要判断的数据
 * @returns boolean
 */
export const isArray = <T = any>(data: any): data is Array<T> => {
	return Array.isArray(data)
}

/**
 * 判断传入的所有数据是否都为数组
 * - 暂无法触发类型保护
 * @param args 需要判断的数据
 * @returns boolean
 */
isArray.all = (...args: any[]) => {
	if (args.length === 0) return false
	return args.every(isArray)
}
