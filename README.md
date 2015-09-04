# Poirot.js - Elegant Handlebar templates.

> "Fighting evil since 1920."

Most of [Handlebars.js](http://handlebarsjs.com/) syntax, implemented without use `eval()`.
Targeted at online compilation in browsers.

## Features

* Compiler is magnitude faster (~20x) than original handlebars.js.
* Rendering is slightly slower due to one functon call per operation overhead.
* Secure: Does not use `eval()`, so can be used in browsers while having full CSP protections turned on.
* Small: 10k minified.
* Compatible: all of of Handlebars.js v2.0.0 syntax, most of API.
* No dependencies: works from IE6 to Node.js.

## Usage

Poirot implements [Handlebars](http://handlebarsjs.com/) templating
syntax which is extension of Mustache templating syntax.
Most of [Mustache](https://mustache.github.io/mustache.5.html)
also applies, except tag-change, recursive lookup
and partials in data.

The module exports initalized Poirot.Environment object as exports.
That means the functions needs to be called with exported object
as `this`.

```js
var Poirot = require('poirot');

/* compile and render separately */
var renderFunc = Poirot.compile('{{data}}');
var html = renderFunc({data: "Info"});

/* compile and cache in one shot - template is used as index into cache */
var html = Poirot.render('{{data}}', {data: "Info"});

// Will result: "Info"
```



## Deliberate differences from Handlebars.js

* No pre-compilation.
* Templates: 0 is falsey as usual in JavaScript.
* Templates: String constants have proper \-escapes.
* API: Main API functions must be called with module as `this`.
* API: Compiler does not support following flags: compat, knownHelpers, trackIds, noEscape.
* API: Custom helpers can be registered in env or given to compile() function, but not compiled render function.
* API: Helper functions must call `options.fn()` and `options.inverse()` with `options` as `this`.

## Differences from Mustache

* No recursive lookup
* Cannot switch tags

