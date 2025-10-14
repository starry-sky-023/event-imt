/**
 * 判断一个数据是否为 function
 * - 需要一次性判断多个可以调用 isFunction.all() 辅助方法
 * - 支持传入泛型
 * @param data 需要判断的数据
 * @returns boolean
 */
export const isFunction = <T = Function>(data: any): data is T => {
	return typeof data === 'function'
}

/**
 * 判断传入的所有数据是否都为 function
 * - 暂无法触发类型保护
 * @param args 需要判断的数据
 * @returns boolean
 */
isFunction.all = (...args: any[]) => {
	if (args.length === 0) return false
	return args.every(isFunction)
}
