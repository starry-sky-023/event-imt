import Bus from '../../dist/index.es.js'

/**
 * @type {Bus<{ sum: (a: number, b: number) => void }>}
 */
const event1 = new Bus()
event1.on('sum', (a, b) => {
	console.log(a, b)
})

/**
 * @type {Bus<import('./type.js').BusEvent>}
 */
const event2 = new Bus()
event2.on('sum', (a, b) => {
	console.log(a, b)
})
