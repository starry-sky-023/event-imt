# 说明

> **注意:**
> 这是一个全新的版本, 与 0.x.x 之间存在破坏性变更, 请谨慎升级

一个事件触发和订阅模块, 提供两套 API 高度一致的模块:

- `Bus` —— 事件总线, 负责事件的注册与触发
- `Hook` —— 钩子, 负责注册回调, 并在需要时主动执行

两者都支持以下能力:

- 通过泛型约束事件/钩子的名称、参数与返回值 (支持 `type` 与 `interface`)
- 一次性回调 (`once` / `registerOnce`)
- 通过回调函数引用或回调标识 (symbol) 移除回调
- 运行前警告钩子 (`onWarning`), 可自定义处理"事件/钩子不存在""回调不存在""ref 类型有误"等情况
- 传入自定义 `Map` 实例作为内部存储

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

**使用 CDN**

参考 [使用 CDN](https://github.com/starry-sky-023/event-imt/blob/master/tests/cdn.html)

## 使用

```js
import { Bus, Hook } from 'event-imt'
```

如果你想使用 `CommonJS` 模块化规范, 那么你可以使用以下方式导入

```js
const { Bus, Hook } = require('event-imt/dist/index.cjs.js')
const bus = new Bus()
```

同样的提供了 `umd` 和 `iife` 版本, 只需将 `cjs` 换成对应的 `umd` 或 `iife`, 导入后将直接挂载到全局对象上, 你可以通过全局对象中的 `EventImt.Bus` / `EventImt.Hook` 使用

```js
import 'event-imt/dist/index.umd.js'
const bus = new EventImt.Bus()
const hook = new EventImt.Hook()
```

***

# Bus (事件总线)

## 构造

**语法**

```
const bus = new Bus([options])
```

- `options` 配置对象 \[可选]
  - `events` 事件配置对象, key 为事件名, value 为事件回调函数, 实例化时会自动注册这些事件 \[可选]
  - `eventMap` `Map` 实例, 传入后将被直接用作事件存储, 而不是内部新建 \[可选]
  - `ctx` 实例上下文钩子, 接收一个函数, 在实例初始化完成前执行, 用于最大程度操作实例 \[可选]
  - `onWarning` 警告处理器, 当事件不存在、回调不存在或 ref 类型有误时被调用 \[可选]

> 事件回调中的 `this` 默认绑定为实例对象, 如果你希望使用 `this` 获取实例, 请使用普通函数, 而非箭头函数。

```js
const bus = new Bus({
	/** 初始事件, 实例化时自动注册 */
	events: {
		onMsg(msg) {
			console.log('onMsg', msg)
		}
	},

	/** 实例上下文钩子 */
	ctx(ctx) {
		// ctx.eventMapInstance // 事件 Map 实例
		// ctx.self // 当前实例
	},

	/** 警告处理器 */
	onWarning(from, ctx) {
		console.warn(from, ctx)
	}
})

bus.emit('onMsg', 'hello')
```

构造函数在参数不合法时会抛出 `TypeError`:

- `eventMap` 不是 `Map` 实例
- `events` 不是对象
- `events` 中某个值不是函数
- `onWarning` 不是函数

## 上下文对象

通过实例化时传递的 `ctx` 配置函数获得。

```js
const bus = new Bus({
	ctx(ctx) {
		console.log(ctx)
	}
})
```

- `ctx` 上下文对象
  - `ctx.eventMapInstance` 事件 `Map` 实例
  - `ctx.self` 当前实例引用

`ctx` 函数中的 `this` 指向当前实例, 因此也可以直接通过 `this` 操作实例。

## 原型方法

### on

注册一个事件。

**语法**

```
bus.on(eventName, callback [, options])
```

- `eventName` 事件名称, 支持字符串和 symbol, 其他类型将被强制转换为字符串
- `callback` 事件回调函数
- `options` 配置选项 \[可选]
  - `ref` 自定义标识 (symbol), 之后可通过该标识移除回调 \[可选]

**返回值**

`symbol` 唯一标识, 后续可用该标识移除回调

```js
const bus = new Bus()
const ref = bus.on('e', (v) => console.log(v))
bus.emit('e', 1) // 1
```

### once

注册一个一次性事件, 当事件触发一次后将被移除。

**语法**

```
bus.once(eventName, callback [, options])
```

- `eventName` 事件名称, 支持字符串和 symbol
- `callback` 事件回调函数
- `options` 配置选项 \[可选]
  - `ref` 自定义标识 (symbol) \[可选]

**返回值**

`symbol` 唯一标识, 后续可用该标识移除回调

```js
const bus = new Bus()
bus.once('e', () => console.log('only once'))
bus.emit('e') // only once
bus.emit('e') // 无输出
```

### emit

触发指定事件。

- 不收集返回值, 遇到错误立即抛出
- 当回调函数被触发, 不管是否有错误, 都算作一次消费 (一次性回调在此被移除)
- 触发不存在的事件时将输出警告 (`type: 'notExist'`), 可通过 `onWarning` 自定义处理

**语法**

```
bus.emit(eventName [, arg1, arg2, ...argN])
```

- `eventName` 需要触发的事件的名称
- `arg` 需要传递的事件参数

**返回值**

`void`

```js
const bus = new Bus()
bus.on('e', (a, b) => console.log(a, b))
bus.emit('e', 1, 2) // 1 2
```

### emitTry

触发指定事件, 尝试执行所有回调, 收集执行过程中抛出的错误。

- 顺序执行, 遇到错误不会中断, 而是收集
- 有错误时输出警告 (`type: 'error'`) 并返回错误数组; 没有错误则无返回值
- 触发不存在的事件时将输出警告 (`type: 'notExist'`)

**语法**

```
bus.emitTry(eventName [, arg1, arg2, ...argN])
```

**返回值**

`any[] | void` 错误数组, 无错误时返回 `undefined`

```js
const bus = new Bus()
bus.on('e', () => {
	throw new Error('boom')
})
bus.on('e', () => console.log('still run'))

const errors = bus.emitTry('e')
// still run
console.log(errors) // [Error: boom]
```

### emitAsync

触发指定事件, 按注册顺序排队执行, 返回一个 `Promise`, 所有回调执行完毕后 `resolve()`。

- 顺序执行, 遇到返回 `Promise` 的回调会 `await` 等待
- 不收集返回值, 遇到错误立即抛出并中断后续回调
- 触发不存在的事件时将输出警告 (`type: 'notExist'`)

**语法**

```
await bus.emitAsync(eventName [, arg1, arg2, ...argN])
```

**返回值**

`Promise<void>`

```js
const bus = new Bus()
bus.on('e', async (v) => {
	await new Promise((r) => setTimeout(r, 100))
	console.log('async', v)
})
bus.on('e', (v) => console.log('sync', v))

await bus.emitAsync('e', 1)
// async 1
// sync 1
```

### emitTryAsync

触发指定事件, 按注册顺序排队执行, 等待所有回调执行完毕后 `resolve()`。

- 顺序执行, 遇到返回 `Promise` 的回调会 `await` 等待
- 遇到错误不会中断, 而是收集
- 有错误时输出警告 (`type: 'error'`) 并返回错误数组; 没有错误则无返回值
- 触发不存在的事件时将输出警告 (`type: 'notExist'`)

**语法**

```
await bus.emitTryAsync(eventName [, arg1, arg2, ...argN])
```

**返回值**

`Promise<any[] | void>` 错误数组, 无错误时 `undefined`

### emitConcurrencyAsync

触发指定事件, 并发执行, 遇到返回 `Promise` 的回调会等待。

- 并发执行所有回调, 不收集返回值
- 使用 `Promise.allSettled` 收集所有错误, 在所有回调执行完毕后返回错误数组; 没有错误则无返回值
- 有错误时输出警告 (`type: 'error'`)
- 触发不存在的事件时将输出警告 (`type: 'notExist'`)

**语法**

```
await bus.emitConcurrencyAsync(eventName [, arg1, arg2, ...argN])
```

**返回值**

`Promise<void | any[]>` 错误数组, 无错误时 `undefined`

```js
const bus = new Bus()
bus.on('e', async () => {
	await new Promise((r) => setTimeout(r, 100))
	console.log('a')
})
bus.on('e', async () => {
	console.log('b')
})

await bus.emitConcurrencyAsync('e')
// b
// a
```

### off

移除指定事件中的回调。

- 移除成功后, 若该事件已无任何回调, 则该事件被一并删除
- 失败时输出警告并返回 `false`
  - `ref` 类型有误 (既不是 symbol 也不是函数) → `type: 'typeError'`
  - 事件不存在 → `type: 'notExist'`
  - 事件存在但回调不存在 → `type: 'notExist'`

**语法**

```
bus.off(eventName, ref)
```

- `eventName` 需要移除回调的事件的名称
- `ref` 回调函数引用或回调标识 (symbol)

**返回值**

`boolean` 是否移除成功

```js
const bus = new Bus()
const fn = () => {}
bus.on('e', fn)
bus.off('e', fn) // true
```

### offRef

通过回调标识移除事件回调 (会在所有事件中查找该标识)。

- 失败时输出警告并返回 `false`
  - `ref` 类型有误 → `type: 'typeError'`
  - 该标识不存在 → `type: 'notExist'`

**语法**

```
bus.offRef(ref)
```

- `ref` 回调标识 (symbol)

**返回值**

`boolean` 是否移除成功

```js
const bus = new Bus()
const ref = bus.on('e', () => {})
bus.offRef(ref) // true
```

### has

判断一个事件是否存在。

- 若传递 `ref` 参数, 则内部调用 `hasCallback` 判断回调是否存在

**语法**

```
bus.has(eventName [, ref])
```

- `eventName` 事件的名称
- `ref` 回调函数引用或回调标识 (symbol) \[可选]

**返回值**

`boolean`

```js
const bus = new Bus()
bus.on('e', () => {})
bus.has('e') // true
```

### hasCallback

判断事件中指定的回调是否存在。

- 事件不存在时直接返回 `false`
- `ref` 类型有误时输出警告 (`type: 'typeError'`) 并返回 `false`

**语法**

```
bus.hasCallback(eventName, ref)
```

- `eventName` 事件的名称
- `ref` 回调函数引用或回调标识 (symbol)

**返回值**

`boolean`

### hasRef

通过回调标识判断回调是否存在 (会在所有事件中查找该标识)。

- `ref` 类型有误时输出警告 (`type: 'typeError'`) 并返回 `false`

**语法**

```
bus.hasRef(ref)
```

- `ref` 回调标识 (symbol)

**返回值**

`boolean`

***

# Hook (钩子)

`Hook` 的 API 与 `Bus` 一一对应, 区别在于: `Bus` 通过 `emit*` 主动触发, 而 `Hook` 通过 `exec*` 主动执行, 并且 `exec*` 接收一个配置对象 `{ handler, args }`。

## 构造

**语法**

```
const hook = new Hook([options])
```

- `options` 配置对象 \[可选]
  - `hooks` 钩子配置对象, key 为钩子名, value 为回调函数, 实例化时会自动注册这些钩子 \[可选]
  - `hookMap` `Map` 实例, 传入后将被直接用作钩子存储, 而不是内部新建 \[可选]
  - `ctx` 实例上下文钩子, 接收一个函数, 将在初始化完成前执行 \[可选]
  - `onWarning` 警告处理器, 当钩子不存在、回调不存在或 ref 类型有误时被调用 \[可选]

```js
const hook = new Hook({
	/** 初始钩子, 实例化时自动注册 */
	hooks: {
		onMsg(msg) {
			console.log('onMsg', msg)
		}
	},

	/** 实例上下文钩子 */
	ctx(ctx) {
		// ctx.hookMapInstance // 钩子 Map 实例
		// ctx.self // 当前实例
	}
})

hook.exec('onMsg', { args: ['hello'] })
```

构造函数在参数不合法时会抛出 `TypeError`:

- `hookMap` 不是 `Map` 实例
- `hooks` 不是对象
- `hooks` 中某个值不是函数
- `onWarning` 不是函数

## 上下文对象

通过实例化时传递的 `ctx` 配置函数获得。

- `ctx` 上下文对象
  - `ctx.hookMapInstance` 钩子 `Map` 实例
  - `ctx.self` 当前实例引用

## 原型方法

### register

注册一个钩子。

**语法**

```
hook.register(name, callback [, options])
```

- `name` 钩子名称, 支持字符串和 symbol, 其他类型将被强制转换为字符串
- `callback` 钩子回调函数
- `options` 配置选项 \[可选]
  - `ref` 自定义标识 (symbol) \[可选]

**返回值**

`symbol` 唯一标识, 后续可用该标识移除回调

```js
const hook = new Hook()
const ref = hook.register('e', (v) => console.log(v))
hook.exec('e', { args: [1] }) // 1
```

### registerOnce

注册一个一次性钩子, 当钩子执行一次后将被移除。

**语法**

```
hook.registerOnce(name, callback [, options])
```

**返回值**

`symbol` 唯一标识

```js
const hook = new Hook()
hook.registerOnce('e', () => console.log('only once'))
hook.exec('e') // only once
hook.exec('e') // 无输出
```

### exec

执行钩子。

- 不收集返回值, 遇到错误立即抛出
- 当回调函数被触发, 不管是否有错误, 都算作一次消费 (一次性回调在此被移除)
- 触发不存在的钩子时将输出警告 (`type: 'notExist'`), 可通过 `onWarning` 自定义处理
- 传入配置对象时, 若存在 `handler`, 则每一个回调函数与执行上下文将交由 `handler` 自行决定如何调用与处理 (详见 [执行处理器 handler](#执行处理器-handler))

**语法**

```
hook.exec(name [, options])
```

- `name` 钩子名称, 支持字符串和 symbol
- `options` 配置选项 \[可选]
  - `handler` 自定义执行器 \[可选]
  - `args` 钩子参数数组, 将传递给回调函数或处理器 \[可选]

**返回值**

`void`

```js
const hook = new Hook()
hook.register('e', (a, b) => console.log(a, b))
hook.exec('e', { args: [1, 2] }) // 1 2
```

### execAsync

执行钩子, 按注册顺序排队执行, 返回一个 `Promise`, 所有回调执行完毕后 `resolve()`。

- 顺序执行, 遇到返回 `Promise` 的回调会 `await` 等待
- 不收集返回值, 遇到错误立即抛出并中断后续回调
- 若存在 `handler`, 则每个回调交由 `handler` 处理, 并等待 `handler` 返回的 `Promise`
- 触发不存在的钩子时将输出警告 (`type: 'notExist'`)

**语法**

```
await hook.execAsync(name [, options])
```

**返回值**

`Promise<void>`

### execConcurrencyAsync

执行钩子, 并发执行, 遇到返回 `Promise` 的回调会等待。

- 并发执行所有回调, 不收集返回值
- 使用 `Promise.allSettled` 收集所有错误, 在所有回调执行完毕后返回错误数组; 没有错误则无返回值
- 有错误时输出警告 (`type: 'error'`)
- 触发不存在的钩子时将输出警告 (`type: 'notExist'`)

**语法**

```
await hook.execConcurrencyAsync(name [, options])
```

**返回值**

`Promise<void | any[]>` 错误数组, 无错误时 `undefined`

### unregister

注销指定钩子中的回调。

- 移除成功后, 若该钩子已无任何回调, 则该钩子被一并删除
- 失败时输出警告并返回 `false`
  - `ref` 类型有误 → `type: 'typeError'`
  - 钩子不存在 → `type: 'notExist'`
  - 钩子存在但回调不存在 → `type: 'notExist'`

**语法**

```
hook.unregister(name, ref)
```

- `name` 钩子名称
- `ref` 回调函数引用或回调标识 (symbol)

**返回值**

`boolean` 是否移除成功

### unregisterRef

通过回调标识注销钩子回调 (会在所有钩子中查找该标识)。

- 失败时输出警告并返回 `false`
  - `ref` 类型有误 → `type: 'typeError'`
  - 该标识不存在 → `type: 'notExist'`

**语法**

```
hook.unregisterRef(ref)
```

**返回值**

`boolean` 是否移除成功

### has

判断一个钩子是否存在。

- 若传递 `ref` 参数, 则内部调用 `hasCallback` 判断回调是否存在

**语法**

```
hook.has(name [, ref])
```

**返回值**

`boolean`

### hasCallback

判断钩子中指定的回调是否存在。

- 钩子不存在时直接返回 `false`
- `ref` 类型有误时输出警告 (`type: 'typeError'`) 并返回 `false`

**语法**

```
hook.hasCallback(name, ref)
```

**返回值**

`boolean`

### hasRef

通过回调标识判断回调是否存在 (会在所有钩子中查找该标识)。

- `ref` 类型有误时输出警告 (`type: 'typeError'`) 并返回 `false`

**语法**

```
hook.hasRef(ref)
```

**返回值**

`boolean`

## 执行处理器 handler

`exec` / `execAsync` / `execConcurrencyAsync` 都接受一个可选的 `handler`。传入后, **内置的自动遍历逻辑将被跳过**, 执行器会针对**每一个**回调函数调用一次 `handler`, 并由 `handler` 自行决定如何调用该回调。

```ts
type ExecHandler = (
	callback: HookCallbackOf<H, K>,
	ctx: ExecCtx<H, K>
) => any
```

- `callback` 当前回调函数 (类型会依据钩子名称 `K` 精确推导)
- `ctx` 执行上下文对象
  - `ctx.name` 当前钩子名称
  - `ctx.args` 本次传入的参数数组 (`options.args`)
  - `ctx.self` 当前实例引用

```ts
const hook = new Hook<{
	send: (msg: string, op: { a: number }) => number
}>()

hook.register('send', () => 1)

hook.exec('send', {
	args: ['a', { a: 0 }],
	handler(callback, ctx) {
		// callback: (msg: string, op: { a: number }) => number
		// ctx.args: [string, { a: number }]
		const result = callback.call(ctx.self, ...ctx.args)
		console.log(result)
	}
})
```

- `exec` / `execAsync` 顺序地对每个回调调用一次 `handler` (`execAsync` 会 `await` 其返回值)
- `execConcurrencyAsync` 并发地对每个回调调用一次 `handler`, 并收集其抛出的错误或返回的 rejected Promise

> 提示: `handler` 内的 `ctx` 只暴露 `name`、`args`、`self`, 不暴露内部的 `hookMap`。

***

# 警告与 onWarning

当发生以下情况时会触发警告处理器 `onWarning`, 若未提供则使用内置默认处理器 (带颜色的 `console.warn` 输出):

- 事件/钩子不存在
- 回调不存在
- `ref` 类型有误
- 执行回调发生错误 (`emitTry` / `emitTryAsync` / `emitConcurrencyAsync` / `execConcurrencyAsync`)

`onWarning` 的签名为 `(from, ctx) => void`:

- `from` 触发来源方法名
- `ctx` 上下文, 常见结构:
  - `{ type: 'notExist', name, args }` 事件/钩子不存在 (触发类方法)
  - `{ type: 'notExist', name, ref }` 回调不存在 (移除/判断类方法)
  - `{ type: 'notExist', ref }` 标识不存在 (`offRef` / `unregisterRef`)
  - `{ type: 'typeError', name, ref }` ref 类型有误
  - `{ type: 'error', name, args }` 执行回调发生错误

`from` 的取值:

- `Bus`: `emit` / `emitTry` / `emitAsync` / `emitTryAsync` / `emitConcurrencyAsync` / `off` / `offRef` / `hasCallback` / `hasRef`
- `Hook`: `exec` / `execAsync` / `execConcurrencyAsync` / `unregister` / `unregisterRef` / `hasCallback` / `hasRef`

```js
const bus = new Bus({
	onWarning(from, ctx) {
		console.warn(from, ctx)
	}
})
bus.emit('not-exist', 1) // warning: emit { type: 'notExist', name: 'not-exist', args: [1] }
```

***

# ts 类型支持

自定义事件/钩子类型, 通过泛型约束名称、参数与返回值。支持 `type` 与 `interface` 两种写法。

## Bus

示例 1 —— 直接使用 `type`

```ts
import { Bus } from 'event-imt'

type BusEvent = {
	sum?: (a: number, b: number) => number
	set?: (str: 'a' | 'b') => string
	send?: (msg: any) => void
}

const bus = new Bus<BusEvent>()
bus.on('sum', (a, b) => {}) // 参数与返回值自动推导
bus.emit('sum', 1, 2) // 参数自动约束
```

示例 2 —— 使用 `interface` 时配合 `InterfaceToType`

```ts
import { Bus, type InterfaceToType } from 'event-imt'

interface BusEvent {
	sum?: (a: number, b: number) => number
	set?: (str: 'a' | 'b') => string
	send?: (msg: any) => void
}

const bus = new Bus<InterfaceToType<BusEvent>>()
bus.on('sum', (a, b) => {})
bus.emit('sum', 1, 2)
```

示例 3 —— 通过继承扩展

```ts
import { Bus, type InterfaceToType } from 'event-imt'

interface BusEvent {
	sum?: (a: number, b: number) => number
}

class MyBus extends Bus<InterfaceToType<BusEvent>> {}

const test = new MyBus()
test.on('sum', (a, b) => {
	console.log(a, b)
})
test.emit('sum', 1, 2)
```

## Hook

`Hook` 的类型参数是一个"钩子名 → 回调函数"的映射:

```ts
import { Hook } from 'event-imt'

type Hooks = {
	sum: (a: number, b: number) => number
	send: (msg: string) => void
}

const hook = new Hook<Hooks>()

hook.register('sum', (a, b) => a + b) // 参数与返回值自动推导
hook.exec('sum', {
	args: [1, 2], // 参数元组自动约束
	handler(callback, ctx) {
		callback.call(ctx.self, ...ctx.args)
	}
})
```

`interface` 写法同样配合 `InterfaceToType`:

```ts
import { Hook, type InterfaceToType } from 'event-imt'

interface Hooks {
	sum: (a: number, b: number) => number
}

const hook = new Hook<InterfaceToType<Hooks>>()
hook.register('sum', (a, b) => a + b)
```

## 未知名称为宽松类型

- `Bus` 中对 `E` 里已知的事件名, `on` / `once` 的回调参数与返回值、`emit*` 的参数都会被约束
- `Hook` 中对 `H` 里已知的钩子名, `register` / `registerOnce` 的回调、`exec*` 的 `args` 都会被约束
- 对于未在泛型中声明的事件/钩子名, 类型会退化为通用回调/`any[]`, 不做严格约束 (运行时通过 `onWarning` 提示不存在)

## js 中的类型支持

在 js 中自定义类型, 创建 `TS` 文件然后通过 `JSDOC` 导入, 或直接在 `JSDOC` 中编写

```ts
// type.ts
export type BusEvent = {
	sum?: (a: number, b: number) => number
}
```

```js
/**
 * 在文档注释中引入类型
 * 如果引入丢失或类型报错, 尝试更改导入扩展名, `.ts` 或 `.js` 或 不添加
 * @type {Bus<import('./type.ts').BusEvent>}
 */
const bus1 = new Bus()
bus1.on('sum', (a, b) => {
	console.log(a, b)
})


// 或者
import { Bus } from 'event-imt'

/**
 * 直接书写在文档注释中
 * @type {Bus<{ sum: (a: number, b: number) => void }>}
 */
const bus2 = new Bus()
bus2.on('sum', (a, b) => {
	console.log(a, b)
})
```

