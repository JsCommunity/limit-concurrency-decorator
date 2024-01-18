# limit-concurrency-decorator

[![Package Version](https://badgen.net/npm/v/limit-concurrency-decorator)](https://npmjs.org/package/limit-concurrency-decorator) [![Build Status](https://travis-ci.org/JsCommunity/limit-concurrency-decorator.png?branch=master)](https://travis-ci.org/JsCommunity/limit-concurrency-decorator) [![PackagePhobia](https://badgen.net/packagephobia/install/limit-concurrency-decorator)](https://packagephobia.now.sh/result?p=limit-concurrency-decorator) [![Latest Commit](https://badgen.net/github/last-commit/JsCommunity/limit-concurrency-decorator)](https://github.com/JsCommunity/limit-concurrency-decorator/commits/master)

> Decorator to limit concurrency of async functions

Similar to these libraries, but can be used as decorator:

- [throat](https://github.com/ForbesLindesay/throat)
- [p-limit](https://github.com/sindresorhus/p-limit)

Also similar to
[p-concurrency](https://github.com/kaelzhang/p-concurrency), but the
limit can be enforced over multiple functions.

## Install

Installation of the [npm package](https://npmjs.org/package/limit-concurrency-decorator):

```
> npm install --save limit-concurrency-decorator
```

## Usage

Simply apply the decorator to a method:

```js
import { limitConcurrency } from "limit-concurrency-decorator";

class HttpClient {
  @limitConcurrency(2)
  get() {
    // ...
  }
}

const client = new HttpClient();

// these calls will run in parallel
client.get("http://example.net/");
client.get("http://example2.net/");

// this call will wait for one of the 2 previous to finish
client.get("http://example3.net/");
```

Or a simple function as a wrapper:

```js
import httpRequest from "http-request-plus";

const httpRequestLimited = limitConcurrency(2)(httpRequest);

// these calls will run in parallel
httpRequestLimited("http://example.net/");
httpRequestLimited("http://example2.net/");

// this call will wait for one of the 2 previous to finish
httpRequestLimited("http://example3.net/");
```

Or even as a call limiter:

```js
const limiter = limitConcurrency(2)(/* nothing */);

// these calls will run in parallel
limiter(asyncFn, param1, ...);
limiter.call(thisArg, asyncFn, param1, ...);

// this call will wait for one of the 2 previous to finish
limiter.call(thisArg, methodName, param1, ...)
```

The limit can be shared:

```js
const myLimit = limitConcurrency(2);

class HttpClient {
  @myLimit
  post() {
    // ...
  }

  @myLimit
  put() {
    // ...
  }
}
```

With `FAIL_ON_QUEUE` you can fail early instead of waiting:

```js
import { FAIL_ON_QUEUE } from "limit-concurrency-decorator";

try {
  await httpRequestLimited(FAIL_ON_QUEUE, "http://example2.net");
} catch (error) {
  error.message; // 'no available place in queue'
}
```

Custom termination:

```js
const httpRequestLimited = limitConcurrency(2, async (promise) => {
  const stream = await promise;
  await new Promise((resolve) => {
    stream.on("end", resolve);
    stream.on("error", reject);
  });
})(httpRequest);

// these calls will run in parallel
httpRequestLimited("http://example.net/");
httpRequestLimited("http://example2.net/");

// this call will wait for one of the 2 previous responses to have been read entirely
httpRequestLimited("http://example3.net/");
```

## Contributions

Contributions are _very_ welcomed, either on the documentation or on
the code.

You may:

- report any [issue](https://github.com/JsCommunity/limit-concurrency-decorator/issues)
  you've encountered;
- fork and create a pull request.

## License

ISC © [Julien Fontanet](https://github.com/julien-f)
