/**
 * 判断一个数据是否为 undefined
 * - 需要一次性判断多个可以调用 isUndefined.all() 辅助方法
 * @param data 需要判断的数据
 * @returns boolean
 */
export const isUndefined = (data: any): data is undefined => {
	return data === undefined
}

/**
 * 判断传入的所有数据是否都为 undefined
 * - 暂无法触发类型保护
 * @param args 需要判断的数据
 * @returns boolean
 */
isUndefined.all = (...args: any[]) => {
	return args.every(isUndefined)
}
