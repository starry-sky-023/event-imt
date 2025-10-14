/**
 * 判断一个数据是否为 symbol
 * - 需要一次性判断多个可以调用 isSymbol.all() 辅助方法
 * @param data 需要判断的数据
 * @returns symbol
 */
export const isSymbol = (data: any): data is symbol => {
	return typeof data === 'symbol'
}

/**
 * 判断传入的所有数据是否都为 symbol
 * - 暂无法触发类型保护
 * @param args 需要判断的数据
 * @returns symbol
 */
isSymbol.all = (...args: any[]) => {
	if (args.length === 0) return false
	return args.every(isSymbol)
}
