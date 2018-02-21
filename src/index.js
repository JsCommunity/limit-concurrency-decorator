function Deferred (fn, thisArg, args, resolve, reject) {
  this.args = args
  this.fn = fn
  this.reject = reject
  this.resolve = resolve
  this.thisArg = thisArg
}

// based on implementation in https://github.com/ForbesLindesay/throat
function Queue (concurrency) {
  // not related to the queue implementation but used in this lib
  this.concurrency = concurrency
  this.next = this.next.bind(this)

  this._s1 = [] // stack to push to
  this._s2 = [] // stack to pop from
}

Queue.prototype.next = function () {
  const d = this.pop()
  if (d === undefined) {
    ++this.concurrency
  } else {
    try {
      d.resolve(d.fn.apply(d.thisArg, d.args))
    } catch (error) {
      d.reject(error)
    }
  }
}

Queue.prototype.push = function (value) {
  this._s1.push(value)
}

Queue.prototype.pop = function () {
  let s2 = this._s2
  if (s2.length === 0) {
    const s1 = this._s1
    if (s1.length === 0) {
      return
    }
    this._s1 = s2
    s2 = this._s2 = s1.reverse()
  }
  return s2.pop()
}

const getSymbol = typeof Symbol === 'function'
  ? key => Symbol.for('limit-concurrency-decorator/' + key)
  : key => '@@limit-concurrency-decorator/' + key

export const FAIL_ON_QUEUE = getSymbol('FAIL_ON_QUEUE')

const defaultTermination = promise => promise

const makeLimiter = (getQueue, termination = defaultTermination) => {
  return fn => function () {
    const queue = getQueue(this)
    const canRun = queue.concurrency > 0
    let argStart = 0
    const { length } = arguments
    if (argStart < length && arguments[argStart] === FAIL_ON_QUEUE) {
      ++argStart
      if (!canRun) {
        return Promise.reject(new Error('no available place in queue'))
      }
    }
    const args = new Array(length - argStart)
    for (let i = argStart; i < length; ++i) {
      args[i - argStart] = arguments[i]
    }
    let promise
    if (canRun) {
      --queue.concurrency
      try {
        promise = fn.apply(this, args)
        if (promise == null || typeof promise.then !== 'function') {
          promise = Promise.resolve(promise)
        }
      } catch (error) {
        promise = Promise.reject(promise)
      }
    } else {
      promise = new Promise((resolve, reject) =>
        queue.push(new Deferred(fn, this, args, resolve, reject))
      )
    }
    const { next } = queue
    termination(promise).then(next, next)
    return promise
  }
}

// create a function limiter where the concurrency is shared between
// all functions
const limitFunction = (concurrency, opts) => {
  const queue = new Queue(concurrency)
  return makeLimiter(() => queue, opts)
}

// create a method limiter where the concurrency is shared between all
// methods but locally to the instance
export const limitMethod = (concurrency, opts) => {
  const queues = new WeakMap()
  return makeLimiter(obj => {
    let queue = queues.get(obj)
    if (queue === undefined) {
      queue = new Queue(concurrency)
      queues.set(obj, queue)
    }
    return queue
  }, opts)
}

export default (...args) => {
  let method = false
  let wrap
  return (target, key, descriptor) => {
    if (key === undefined) {
      if (wrap === undefined) {
        wrap = limitFunction(...args)
      } else if (method) {
        throw new Error('the same decorator cannot be used between function and method')
      }
      return wrap(target)
    }

    if (wrap === undefined) {
      method = true
      wrap = limitMethod(...args)
    } else if (!method) {
      throw new Error('the same decorator cannot be used between function and method')
    }

    if ('value' in descriptor) {
      descriptor.value = wrap(descriptor.value)
    } else {
      const { get } = descriptor
      descriptor.get = function () {
        return wrap(get.call(this))
      }
    }

    return descriptor
  }
}
