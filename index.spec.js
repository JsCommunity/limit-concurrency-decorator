"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("test");

const { BYPASS_QUEUE, FAIL_ON_QUEUE, limitConcurrency } = require("./");

function applyDecorator(klass, prop, decorator) {
  const descriptor = Object.getOwnPropertyDescriptor(klass, prop);

  Object.defineProperty(
    klass,
    prop,
    decorator(klass, prop, descriptor) || descriptor
  );
}

// expect(promise).rejects.toThrow does not work with Jest 21
const makeSyncWrapper = (promise) =>
  promise.then(
    (value) => () => value,
    (reason) => () => {
      throw reason;
    }
  );

describe("@limitConcurrency()", () => {
  it("limits the concurrency of a function", async () => {
    let calls = 0;
    const context = {};
    const fn = limitConcurrency(2)(function (value) {
      ++calls;

      // test context passing
      assert.equal(this, context);

      return value;
    });

    const results = Promise.all([
      fn.call(context, "foo"),
      fn.call(context, "bar"),
      fn.call(context, "baz"),
    ]);

    // first 2 calls are run in parallel
    assert.equal(calls, 2);

    // we need to wait a microtask for the third call
    await Promise.resolve();
    assert.equal(calls, 3);

    // test arguments passing and returned value
    assert.deepEqual(await results, ["foo", "bar", "baz"]);
  });

  it("properly handle synchronous exception", async () => {
    const error = new Error();
    const fn = limitConcurrency(2)(function () {
      throw error;
    });

    assert.throws(await makeSyncWrapper(fn()), error);
  });

  it("can share the limit between multiple functions", async () => {
    const limit = limitConcurrency(2);
    const f1 = limit((value) => {
      ++f1.calls;
      return value;
    });
    f1.calls = 0;
    const f2 = limit((value) => {
      ++f2.calls;
      return value;
    });
    f2.calls = 0;

    const results = Promise.all([f1("foo"), f2("bar"), f1("baz")]);

    // first 2 calls are run in parallel
    assert.equal(f1.calls, 1);
    assert.equal(f2.calls, 1);

    // we need to wait a microtask for the third call
    await Promise.resolve();
    assert.equal(f1.calls, 2);

    // test arguments passing and returned value
    assert.deepEqual(await results, ["foo", "bar", "baz"]);
  });

  it("limits the concurrency of a method", async () => {
    class C {
      constructor() {
        this.calls = 0;
      }

      method(value, context) {
        ++this.calls;

        // test context passing
        assert.equal(this, context);

        return value;
      }
    }
    applyDecorator(C.prototype, "method", limitConcurrency(2));

    const i1 = new C();
    const i2 = new C();

    const results = Promise.all([
      i1.method("foo", i1),
      i1.method("bar", i1),
      i1.method("baz", i1),

      i2.method("foo", i2),
      i2.method("bar", i2),
      i2.method("baz", i2),
    ]);

    // first 2 calls are run in parallel
    assert.equal(i1.calls, 2);
    assert.equal(i2.calls, 2);

    // we need to wait a microtask for the third call
    await Promise.resolve();
    assert.equal(i1.calls, 3);
    assert.equal(i2.calls, 3);

    // test arguments passing and returned value
    assert.deepEqual(await results, ["foo", "bar", "baz", "foo", "bar", "baz"]);
  });

  it("can share the limit between multiple methods", async () => {
    const limit = limitConcurrency(2);
    class C {
      constructor() {
        this.calls1 = 0;
        this.calls2 = 0;
      }

      method1(value) {
        ++this.calls1;
        return value;
      }

      method2(value) {
        ++this.calls2;
        return value;
      }
    }
    applyDecorator(C.prototype, "method1", limit);
    applyDecorator(C.prototype, "method2", limit);

    const i1 = new C();
    const i2 = new C();

    const results = Promise.all([
      i1.method1("foo"),
      i1.method2("bar"),
      i1.method1("baz"),

      i2.method1("foo"),
      i2.method2("bar"),
      i2.method1("baz"),
    ]);

    // first 2 calls are run in parallel
    assert.equal(i1.calls1, 1);
    assert.equal(i1.calls2, 1);
    assert.equal(i2.calls1, 1);
    assert.equal(i2.calls2, 1);

    // we need to wait a microtask for the third call
    await Promise.resolve();
    assert.equal(i1.calls1, 2);
    assert.equal(i1.calls2, 1);
    assert.equal(i2.calls1, 2);
    assert.equal(i2.calls2, 1);

    // test arguments passing and returned value
    assert.deepEqual(await results, ["foo", "bar", "baz", "foo", "bar", "baz"]);
  });

  it("cannot share the limit between functions and methods", () => {
    assert.throws(() => {
      const limit = limitConcurrency(2);
      limit(() => {});
      // eslint-disable-next-line no-unused-vars
      class C {
        method() {}
      }
      applyDecorator(C.prototype, "method", limit);
    });
  });

  it("supports custom termination", async () => {
    let terminate;
    const fn = limitConcurrency(1, (_) => {
      const promise = new Promise((resolve) => {
        terminate = () => {
          resolve();
          return promise;
        };
      });
      return promise;
    })(() => {});

    await fn();

    assert.throws(await makeSyncWrapper(fn(FAIL_ON_QUEUE)));

    await terminate();

    await fn(FAIL_ON_QUEUE);
  });
});

describe("BYPASS_QUEUE", () => {
  it("makes the call bypass the limit", async () => {
    let returnedValue;
    const fn = limitConcurrency(1)(() => returnedValue);

    // this call never terminates
    returnedValue = new Promise(() => {});
    fn();

    // this call passes without waiting
    returnedValue = undefined;
    await fn(BYPASS_QUEUE);
  });

  it("the call counts for the concurrency", async () => {
    const fn = limitConcurrency(1)(() => new Promise(() => {}));

    // this call never terminates
    fn(BYPASS_QUEUE);

    // the second call counts for the concurrency limit
    assert.throws(await makeSyncWrapper(fn(FAIL_ON_QUEUE)), {
      message: "no available place in queue",
    });
  });
});

describe("FAIL_ON_QUEUE", () => {
  it("makes the call fail instead of queue", async () => {
    const fn = limitConcurrency(2)(() => {});

    fn();
    fn();

    assert.throws(await makeSyncWrapper(fn(FAIL_ON_QUEUE)), {
      message: "no available place in queue",
    });
  });
});
