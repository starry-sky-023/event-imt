/**
 * 判断一个数据是否为 string
 * - 需要一次性判断多个可以调用 isString.all() 辅助方法
 * @param data 需要判断的数据
 * @returns boolean
 */
export const isString = (data: any): data is string => {
	return typeof data === 'string'
}

/**
 * 判断传入的所有数据是否都为 string
 * - 暂无法触发类型保护
 * @param args 需要判断的数据
 * @returns boolean
 */
isString.all = (...args: any[]) => {
	if (args.length === 0) return false
	return args.every(isString)
}
