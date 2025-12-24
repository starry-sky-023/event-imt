# 说明

一个发布订阅模块

## 安装

**使用 pnpm**

```sh
pnpm i event-imt
```

**使用 yarn**

```sh
yarn add event-imt
```

**使用 npm**

```sh
npm i event-imt
```

## 使用

```js
import Bus from 'event-imt'
// 或者 import { Bus } from 'event-imt'

const bus = new Bus()

/** 注册事件 */
bus.on('e', (...args) => {
	console.log('e', ...args)
})

/** 触发事件并传递参数 */
bus.emit('e', 1, 'a', { name: 'test' })

/** 移除事件1 */
const f1 = () => {}
bus.on('f1', f1) // 注册
bus.off('f1', f1) // 移除

/**
 * 移除事件2
 * - 使用标识符移除
 */
const f2 = bus.on('f2', () => {}) // 注册并接收返回值
bus.off(f2) // 通过标识符移除
```

如果你想使用 CommonJS 模块化规范, 那么你可以使用以下方式导入

```js
const Bus = require('event-imt/dist/index.cjs.js')
const bus = new Bus()
```

## Bus

**语法**

```
const bus = new Bus([options])
```

-   options 配置对象 [可选]
    -   events 事件配置, 接收一个对象 [可选]
    -   ctx 实例上下文 hook, 接收一个函数 [可选]

事件中的函数 this 默认绑定为实例对象, 如果你希望使用 this 来获取实例, 请使用普通函数, 而非箭头函数

```js
const bus = new Bus({
	events: {
		/** 注册事件 */
		a(ctx) {}
	},

	/** 实例上下文 hook */
	ctx(ctx) {
		// ctx.clear('a') // 清除指定事件(仅用于向后兼容)
		// ctx.clearAll() // 清除所有事件(仅用于向后兼容)
		// ctx.eventMap // 事件对象(仅用于向后兼容)
		// ctx.eventMapInstance // 事件 Map 实例
		// ctx.self // 当前实例
		// ctx.setSelf('d', 1) // 设置实例属性(避免ts警告)
	}
})
```

## 原型方法

### on

注册一个事件

**语法**

```
bus.on(eventName, callback)
```

-   eventName 事件名称, 支持字符串和 symbol
-   callback 事件回调函数

**返回值**

symbol 唯一标识, 后续可用该标识移除回调

### once

注册一个一次性事件, 当事件触发一次后将被移除

**语法**

```
bus.once(eventName, callback)
```

-   eventName 事件名称, 支持字符串和 symbol

-   callback 事件回调函数

**返回值**

symbol 唯一标识, 后续可用该标识移除回调

### emit

触发指定事件

**语法**

```
bus.emit(eventName [, arg1, arg2, arg3, ...argN])
```

-   eventName 需要触发的事件的名称
-   arg 需要传递的事件参数

**返回值**

this

### emitWait

触发指定事件, 并返回一个 promise, 事件所有回调完成, promise resolve

-   与 `emit` 区别

-   `emit` 触发事件, 不等待回调完成

-   `emitWait` 触发事件, 等待所有回调完成(并发), promise resolve

**语法**

```
await bus.emitWait(eventName [, arg1, arg2, arg3, ...argN])
```

-   eventName 需要触发的事件的名称
-   arg 需要传递的事件参数

**返回值**

Promise.allSettled() 返回值

### emitLineUp

触发指定事件, 并返回一个 promise, 事件所有回调完成, promise resolve

遇到错误将立即抛出, 错误将中断后续回调执行

-   与 `emit` 区别

-   `emit` 触发事件, 不等待回调完成

-   `emitLineUp` 触发事件, 等待所有回调完成(顺序执行), promise resolve

**语法**

```
await bus.emitLineUp(eventName [, arg1, arg2, arg3, ...argN])
```

-   eventName 需要触发的事件的名称
-   arg 需要传递的事件参数

**返回值**

any[] 返回值

### emitLineUpCaptureErr

触发指定事件, 并返回一个 promise, 事件所有回调完成, promise resolve

遇到错误将捕获, 不影响后续回调执行

-   与 `emit` 区别

-   `emit` 触发事件, 不等待回调完成

-   `emitLineUpCaptureErr` 触发事件, 等待所有回调完成(顺序执行), promise resolve

**语法**

```
await bus.emitLineUpCaptureErr(eventName [, arg1, arg2, arg3, ...argN])
```

-   eventName 需要触发的事件的名称
-   arg 需要传递的事件参数

**返回值**

回调返回值包装后的数组

### off

移除一个事件中的回调

**语法**

```
bus.off(eventName, ref)
```

-   eventName 需要移除的事件的名称
-   ref 事件回调引用(函数或 symbol)

**返回值**

this

### offBySign

移除一个事件中的回调

**语法**

```
bus.offBySign(ref)
```

-   ref 事件回调唯一标识(不允许函数, 函数复用更为普遍)

**返回值**

this

### has

判断事件是否存在

**语法**

```
bus.has(eventName)
```

-   eventName 事件的名称

**返回值**

boolean

### hasCallback

判断事件中的回调是否存在

**语法**

```
bus.hasCallback(eventName, ref)
```

-   eventName 事件的名称
-   ref 事件回调引用(函数或 symbol)

**返回值**

boolean

### hasCallbackBySign

判断事件中的回调是否存在

**语法**

```
bus.hasCallbackBySign(sign)
```

-   sign 回调唯一标识

**返回值**

boolean

## 上下文对象

通过实例时传递的 ctx 配置函数获得

```js
const bus = new Bus({
	ctx(ctx) {
		console.log(ctx)
	}
})
```

-   ctx 上下文对象

    -   ctx.clear(eventName) // 清除指定事件(仅用于向后兼容)
    -   ctx.clearAll() // 清除所有事件(仅用于向后兼容)
    -   ctx.eventMap // 事件对象(仅用于向后兼容)
    -   ctx.eventMapInstance // 事件 Map 实例
    -   ctx.self // 当前实例
    -   ctx.setSelf(prop, value) // 设置实例属性(避免 ts 警告)

## ts 类型支持

自定义事件类型

示例 1

直接在创建实例时传递类型, 使用 type

```ts
type BusEvent = {
	sum?(a: number, b: number): number
	set?(str: 'a' | 'b'): string
	send?(msg: any): void
}

const bus = new Bus<BusEvent>()
bus.on('sum', (a, b) => {}) // 类型推导
bus.emit('sum', 1, 2) // 类型推导
```

示例 2

直接在创建实例时传递类型, 使用 interface

```ts
interface BusEvent {
	[k: symbol]: (...args: any[]) => any
	sum?(a: number, b: number): number
	set?(str: 'a' | 'b'): string
	send?(msg: any): void
}

const bus = new Bus<BusEvent>()
bus.on('sum', (a, b) => {}) // 类型推导
bus.emit('sum', 1, 2) // 类型推导
```

示例 3

通过继承扩展

```ts
interface BusEvent {
	[k: symbol]: (...args: any[]) => any
	sum?(a: number, b: number): number
	set?(str: 'a' | 'b'): string
	send?(msg: any): void
}

class MyBus extends Bus<BusEvent> {}

const test = new MyBus()
test.on('sum', (a, b) => {
	console.log(a, b)
})
test.emit('sum', 1, 2)
```

示例 4

js 中自定义类型, 创建 `TS` 文件然后通过 `JSDOC` 导入, 或直接在 `JSDOC` 中编写

```ts
// type.ts
export interface BusEvent {
	[k: symbol]: (...args: any[]) => any
	sum?(a: number, b: number): number
}
```

```js
import Bus from 'event-imt'

/**
 * 直接书写在文档注释中
 * @type {Bus<{ sum: (a: number, b: number) => void }>}
 */
const bus1 = new Bus()
bus1.on('sum', (a, b) => {
	console.log(a, b)
})

/**
 * 在文档注释中引入类型
 * 如果引入丢失或类型报错, 尝试更改导入扩展名, `.ts` 或 `.js` 或 不添加
 * @type {Bus<import('./type.ts').BusEvent>}
 */
const bus2 = new Bus()
bus2.on('sum', (a, b) => {
	console.log(a, b)
})
```
