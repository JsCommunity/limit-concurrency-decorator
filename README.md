# limit-concurrency-decorator [![Build Status](https://travis-ci.org/JsCommunity/limit-concurrency-decorator.png?branch=master)](https://travis-ci.org/JsCommunity/limit-concurrency-decorator)

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
import limit from 'limit-concurrency-decorator'

class HttpClient {
  @limit(2)
  get () {
    // ...
  }
}

const client = new HttpClient()

// these calls will run in parallel
client.get('http://example.net/')
client.get('http://example2.net/')

// this call will wait for the 2 previous to finish
client.get('http://example3.net/')
```

Or a simple function as a wrapper:

```js
import httpRequest from 'http-request-plus'

const httpRequestLimited = limit(2)(httpRequest)

// these calls will run in parallel
httpRequestLimited('http://example.net/')
httpRequestLimited('http://example2.net/')

// this call will wait for the 2 previous to finish
httpRequestLimited('http://example3.net/')
```

The limit can be shared:

```js
const myLimit = limit(2)

class HttpClient {
  @myLimit
  post () {
    // ...
  }

  @myLimit
  put () {
    // ...
  }
}
```

## Development

```
# Install dependencies
> npm install

# Run the tests
> npm test

# Continuously compile
> npm run dev

# Continuously run the tests
> npm run dev-test

# Build for production (automatically called by npm install)
> npm run build
```

## Contributions

Contributions are *very* welcomed, either on the documentation or on
the code.

You may:

- report any [issue](https://github.com/JsCommunity/limit-concurrency-decorator/issues)
  you've encountered;
- fork and create a pull request.

## License

ISC © [Julien Fontanet](https://github.com/julien-f)
