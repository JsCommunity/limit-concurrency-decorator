/* eslint-env jest */

import limitConcurrency, { FAIL_ON_QUEUE } from './'

// expect(promise).rejects.toThrow does not work with Jest 21
const makeSyncWrapper = promise =>
  promise.then(
    value => () => value,
    reason => () => {
      throw reason
    }
  )

describe('@limitConcurrency()', () => {
  it('limits the concurrency of a function', async () => {
    let calls = 0
    const context = {}
    const fn = limitConcurrency(2)(function (value) {
      ++calls

      // test context passing
      expect(this).toBe(context)

      return value
    })

    const results = Promise.all([
      fn.call(context, 'foo'),
      fn.call(context, 'bar'),
      fn.call(context, 'baz'),
    ])

    // first 2 calls are run in parallel
    expect(calls).toBe(2)

    // we need to wait a microtask for the third call
    await Promise.resolve()
    expect(calls).toBe(3)

    // test arguments passing and returned value
    expect(await results).toEqual([ 'foo', 'bar', 'baz' ])
  })

  it('can share the limit between multiple functions', async () => {
    const limit = limitConcurrency(2)
    const f1 = limit(value => {
      ++f1.calls
      return value
    })
    f1.calls = 0
    const f2 = limit(value => {
      ++f2.calls
      return value
    })
    f2.calls = 0

    const results = Promise.all([
      f1('foo'),
      f2('bar'),
      f1('baz'),
    ])

    // first 2 calls are run in parallel
    expect(f1.calls).toBe(1)
    expect(f2.calls).toBe(1)

    // we need to wait a microtask for the third call
    await Promise.resolve()
    expect(f1.calls).toBe(2)

    // test arguments passing and returned value
    expect(await results).toEqual([ 'foo', 'bar', 'baz' ])
  })

  it('limits the concurrency of a method', async () => {
    class C {
      constructor () {
        this.calls = 0
      }

      @limitConcurrency(2)
      method (value, context) {
        ++this.calls

        // test context passing
        expect(this).toBe(context)

        return value
      }
    }

    const i1 = new C()
    const i2 = new C()

    const results = Promise.all([
      i1.method('foo', i1),
      i1.method('bar', i1),
      i1.method('baz', i1),

      i2.method('foo', i2),
      i2.method('bar', i2),
      i2.method('baz', i2),
    ])

    // first 2 calls are run in parallel
    expect(i1.calls).toBe(2)
    expect(i2.calls).toBe(2)

    // we need to wait a microtask for the third call
    await Promise.resolve()
    expect(i1.calls).toBe(3)
    expect(i2.calls).toBe(3)

    // test arguments passing and returned value
    expect(await results).toEqual([ 'foo', 'bar', 'baz', 'foo', 'bar', 'baz' ])
  })

  it('can share the limit between multiple methods', async () => {
    const limit = limitConcurrency(2)
    class C {
      constructor () {
        this.calls1 = 0
        this.calls2 = 0
      }

      @limit
      method1 (value) {
        ++this.calls1
        return value
      }

      @limit
      method2 (value) {
        ++this.calls2
        return value
      }
    }

    const i1 = new C()
    const i2 = new C()

    const results = Promise.all([
      i1.method1('foo'),
      i1.method2('bar'),
      i1.method1('baz'),

      i2.method1('foo'),
      i2.method2('bar'),
      i2.method1('baz'),
    ])

    // first 2 calls are run in parallel
    expect(i1.calls1).toBe(1)
    expect(i1.calls2).toBe(1)
    expect(i2.calls1).toBe(1)
    expect(i2.calls2).toBe(1)

    // we need to wait a microtask for the third call
    await Promise.resolve()
    expect(i1.calls1).toBe(2)
    expect(i1.calls2).toBe(1)
    expect(i2.calls1).toBe(2)
    expect(i2.calls2).toBe(1)

    // test arguments passing and returned value
    expect(await results).toEqual([ 'foo', 'bar', 'baz', 'foo', 'bar', 'baz' ])
  })

  it('cannot share the limit between functions and methods', () => {
    expect(() => {
      const limit = limitConcurrency(2)
      limit(() => {})
      class C { // eslint-disable-line no-unused-vars
        @limit
        method () {}
      }
    }).toThrow()
  })

  it('supports custom termination', async () => {
    let terminate
    const fn = limitConcurrency(1, _ => {
      const promise = new Promise(resolve => {
        terminate = () => {
          resolve()
          return promise
        }
      })
      return promise
    })(() => {})

    await fn()

    expect(await makeSyncWrapper(fn(FAIL_ON_QUEUE))).toThrow()

    await terminate()

    await fn(FAIL_ON_QUEUE)
  })
})

describe('FAIL_ON_QUEUE', () => {
  it('makes the call fail instead of queue', async () => {
    const fn = limitConcurrency(2)(() => {})

    fn()
    fn()

    expect(await makeSyncWrapper(fn(FAIL_ON_QUEUE))).toThrow(
      'no available place in queue'
    )
  })
})
