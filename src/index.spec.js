/* eslint-env jest */

import limitAsync from './'

describe('@limitAsync()', () => {
  it('limits the concurrency', async () => {
    let i = 0
    const context = {}
    const fn = limitAsync(2)(function (value) {
      ++i

      // test context passing
      expect(this).toBe(context)

      return value
    })

    const results = Promise.all([
      fn.call(context, 'foo'),
      fn.call(context, 'bar'),
      fn.call(context, 'baz')
    ])

    // first 2 calls are run in parallel
    expect(i).toBe(2)

    // we need to wait a microtask for the third call
    await Promise.resolve()
    expect(i).toBe(3)

    // test arguments passing and returned value
    expect(await results).toEqual([ 'foo', 'bar', 'baz' ])
  })
})
