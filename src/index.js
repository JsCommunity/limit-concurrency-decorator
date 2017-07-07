function Deferred (fn, thisArg, args, resolve, reject) {
  this.args = args
  this.fn = fn
  this.reject = reject
  this.resolve = resolve
  this.thisArg = thisArg
}

// based on implementation in https://github.com/ForbesLindesay/throat
function Queue () {
  this._s1 = [] // stack to push to
  this._s2 = [] // stack to pop from
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

const limitAsync = concurrency => {
  const queue = []
  const execNext = () => {
    const d = queue.shift()
    if (d === undefined) {
      ++concurrency
    } else {
      try {
        d.resolve(d.fn.apply(d.thisArg, d.args))
      } catch (error) {
        d.reject(error)
      }
    }
  }

  return fn => function (...args) {
    const promise = concurrency > 0
      ? new Promise(resolve => {
        --concurrency
        resolve(fn.apply(this, args))
      })
      : new Promise((resolve, reject) =>
        queue.push(new Deferred(fn, this, args, resolve, reject))
      )
    promise.then(execNext, execNext)
    return promise
  }
}
export default (...args) => {
  const wrap = limitAsync(...args)
  return (target, key, descriptor) =>
    key === undefined
      ? wrap(target)
      : {
        ...descriptor,
        configurable: true,
        get () {
          const value = wrap(descriptor.value)
          Object.defineProperty(this, key, { ...descriptor, value })
          return value
        },
        set (value) {
          Object.defineProperty(this, key, { ...descriptor, value })
        }
      }
}
