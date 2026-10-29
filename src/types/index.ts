export type * from './event.js'
export type * from './hook.js'

/** 将 interface 类型转换为 type */
export type InterfaceToType<T> = {
	[K in keyof T]: T[K]
}
