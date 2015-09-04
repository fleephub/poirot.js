/*jshint node:true, qunit:true, forin:false */
/*global poirot, test */

(function (Poirot) {
'use strict';

var test = function (name, func) {
    if (typeof QUnit !== 'undefined') {
        QUnit.test(name, func);
    } else if (module.exports[name]) {
        throw new Error("double name: "+name);
    } else {
        module.exports[name] = function(test) {
            func(test);
            test.done();
        };
    }
};

var Utils = Poirot.Utils;

var NAN = 0/0;

var XString = String; // avoid jshint warning about 'new String()'

Poirot.registerHelper("echo",
    function Echo () {
        var res = '';
        for (var i = 0; i < arguments.length - 1; i++) {
            if (i > 0)
                res += ' ';
            res += arguments[i];
        }
        return res;
   });

test("Poirot.Utils.isArray", function(assert) {
    var isArray = Utils.isArray;

    assert.ok(isArray([]));
    assert.ok(isArray([1,2,3]));
    assert.ok(!isArray(undefined));
    assert.ok(!isArray(null));
    assert.ok(!isArray(false));
    assert.ok(!isArray(""));
    assert.ok(!isArray(function(){}));
    assert.ok(!isArray(arguments));
    assert.ok(!isArray(3.4));
    assert.ok(!isArray({}));
    assert.ok(!isArray(new XString("qwe")));
    assert.ok(!isArray(NAN));
});

test("Poirot.Utils.isFunction", function(assert) {
    var isFunction = Utils.isFunction;

    assert.ok(isFunction(function(){}));
    assert.ok(isFunction(isFunction));
    assert.ok(!isFunction(undefined));
    assert.ok(!isFunction(null));
    assert.ok(!isFunction(true));
    assert.ok(!isFunction(""));
    assert.ok(!isFunction({}));
    assert.ok(!isFunction(arguments));
    assert.ok(!isFunction(4.5));
    assert.ok(!isFunction(0));
    assert.ok(!isFunction(NAN));
});

test("Poirot.Utils.isObject", function(assert) {
    var isObject = Utils.isObject;

    assert.ok(isObject({}));
    assert.ok(isObject(function(){}));
    assert.ok(isObject(arguments));
    assert.ok(isObject(new XString("")));
    assert.ok(!isObject(undefined));
    assert.ok(!isObject(null));
    assert.ok(!isObject(true));
    assert.ok(!isObject(""));
    assert.ok(!isObject(4.5));
    assert.ok(!isObject(0));
    assert.ok(!isObject(NAN));
});

test("Poirot.Utils.isEmpty", function(assert) {
    var isEmpty = Utils.isEmpty;
    assert.ok(isEmpty(undefined));
    assert.ok(isEmpty(null));
    assert.ok(isEmpty(''));
    assert.ok(isEmpty(false));
    assert.ok(isEmpty([]));
    assert.ok(isEmpty(NAN)); // correct?
    assert.ok(isEmpty(0));
    assert.ok(isEmpty(0.0));
    assert.ok(!isEmpty(2));
    assert.ok(!isEmpty(true));
    assert.ok(!isEmpty([1]));
    assert.ok(!isEmpty({}));
    assert.ok(!isEmpty(new XString('')));
    assert.ok(!isEmpty(arguments));
});

test("Poirot.Utils.extend", function(assert) {
    var extend = Utils.extend;
    var n, r, o;

    n = extend({}, {a:1,b:2}, {a:3,c:4});
    r = [n.a, n.b, n.c].join(',');
    assert.equal(r, '3,2,4');

    o = {x:5};
    extend(o, {a:1,b:2}, {a:3,c:4});
    r = [o.a, o.b, o.c, o.x].join(',');
    assert.equal(r, '3,2,4,5');
});

test("Poirot.Utils.escapeExpression", function(assert) {
    var escapeExpression = Utils.escapeExpression;
    assert.equal(escapeExpression(undefined), '');
    assert.equal(escapeExpression(null), '');
    assert.equal(escapeExpression(''), '');
    assert.equal(escapeExpression(0), '0');
    assert.equal(escapeExpression(true), 'true');
    assert.equal(escapeExpression(false), 'false');
    assert.equal(escapeExpression("x"), 'x');
    assert.equal(escapeExpression("<>&\"'"), '&lt;&gt;&amp;&quot;&#39;');
    assert.equal(escapeExpression({}), '[object Object]');
    assert.equal(escapeExpression({toString: function(){return '<>';}}), '&lt;&gt;');
    assert.equal(escapeExpression(NAN), 'NaN');
});

test("Poirot.Utils.basics", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };

    var data = {a: 0, b: "<b>", c: null, str: '\\&<>"\'/\\'};

    assert.equal(render(null), '');
    assert.equal(render(''), '');
    assert.equal(render('qwe', data), 'qwe');
    assert.equal(render('{{ undef }}{{{ undef }}}', data), '');
    assert.equal(render('<b>{{ b }}</b>', data), '<b>&lt;b&gt;</b>');
    assert.equal(render('{{ nontrue }}', {nontrue: false}), 'false');
    assert.equal(render('<c>{{{ \n b \n  }}}</c>', data), '<c><b></c>');
    assert.equal(render('|{{ a }}{{ b }}{{ c }}|', data), '|0&lt;b&gt;|');
    assert.equal(render('|{{{ a }}}{{{ b }}}{{{ c }}}{{& b }}|', data), '|0<b><b>|');
    assert.equal(render('{{{ str }}}|{{ str }}', data), '\\&<>"\'/\\|\\&amp;&lt;&gt;&quot;&#39;/\\');

    assert.equal(render('{{ list.[0] }} | {{ list.[1].desc }} | {{ list.[1].sublist.[1] }}',
                      {list: ["el0", {desc: "el1", sublist: ["sl0","sl1"]}]}),
               'el0 | el1 | sl1');

    assert.equal(render('{{ trueza }}', {trueza: false}), 'false');
});

test("Poirot.paths", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    assert.equal(render('{{ sub.foo }}', {'sub': {'foo': 2}}), '2');
    assert.equal(render('{{ sub/foo }}', {'sub': {'foo': 2}}), '2');
    assert.equal(render('{{ [with]/[foo] }}', {'with': {'foo': 2}}), '2');
    assert.equal(render('{{ ./with/foo }}', {'with': {'foo': 2}}), '2');
    assert.equal(render('{{ [@weird].[[../path spec] }}', {'@weird': {'[../path spec': 'ok'}}), 'ok');
});

test("Poirot.comments", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    assert.equal(render('a{{! \ncomment\n }} b {{! cmt2 }}c {{!}}d', {}), 'a b c d');
    assert.equal(render('a{{!-- \ncomment\n {{ .. }} zz --}} b {{!----}}c', {}), 'a b c');
});

test("Poirot.escaping", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    assert.equal(render('\\{{foo}}', {foo: 1}), '{{foo}}');
    assert.equal(render('\\\\{{foo}}', {foo: 1}), '\\1');
    assert.equal(render('\\\\\\{{{ foo }}}', {foo: 1}), '\\{1}');
    assert.equal(render('\\\\\\{\\{{ foo }}}', {foo: 1}), '\\{{{ foo }}}');
    assert.equal(render('\\\\\\\\{{{ foo }}}', {foo: 1}), '\\\\1');
    assert.equal(render(' \\ {{foo}}', {foo: 1}), '  1');
    assert.equal(render(' \\ \\{{foo}}', {foo: 1}), '  {{foo}}');
});

test("Poirot.current", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    // current obj
    assert.equal(render('{{#slist}}{{.}},{{/slist}}', {slist: [1, 2, 3]}), '1,2,3,');
    assert.equal(render('{{#slist}}{{{ . }}},{{/slist}}', {slist: [1, 2, 3]}), '1,2,3,');
    assert.equal(render('{{#with svalue }}{{ . }}{{/ with }}', {svalue: 4}), '4');
    assert.equal(render('{{.}}', 4), '4');
    assert.equal(render('{{./foo}}', {foo:4}), '4');

    assert.equal(render('{{ this.foo }}', {foo:4}), '4');
    assert.equal(render('{{lookup this "foo"}}', {foo:4}), '4');
});

test("Poirot.const", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    assert.equal(render("{{echo 'qwe\\'z\\'y\\\\' \"asd\\\"z\\\"y\"}}", {}), 'qwe&#39;z&#39;y\\ asd&quot;z&quot;y');
    assert.equal(render("{{echo true }}", {'true':5}), 'true');
    assert.equal(render("{{echo false}}", {'false':6}), 'false');
    assert.equal(render("{{echo true false}}", {'true':7,'false':8}), 'true false');
    assert.equal(render("{{echo  0  123}}", {0:'x', 123:'y'}), '0 123');
});

test("Poirot.uprefs", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    var sub = {name:"X0", sub1:{name:"X1", sub2:{name:"X2", sub3:{name:"X3", sub4:{name:"X4"}}}}};
    assert.equal(render('{{#with foo}}{{name}}{{../bar}}{{/with}}', {foo: {name: "(name)"}, bar: '(bar)'}),
               '(name)(bar)');
    assert.equal(render('{{#with foo}}{{name}}{{../../bar}}{{/with}}', {foo: {name: "(name)"}, bar: '(bar)'}),
               '(name)');
    assert.equal(render('{{#with sub1}}{{#with ..}}{{name}}{{/with}}{{/with}}', sub), 'X0');
    assert.equal(render('{{#with sub1}}{{#with sub2}}{{#with ../..}}{{name}}{{/with}}{{/with}}{{/with}}', sub), 'X0');
});

test("Poirot.hashargs", function(assert) {
    var env = Poirot.create();
    var tagFunc = function Tag (options) {
                            var k, v, res, attlist = [];
                            var tag = options.name;
                            for (k in options.hash) {
                                v = Poirot.escapeExpression(options.hash[k]);
                                attlist.push(' '+k+'="'+v+'"');
                            }
                            res = "<" + tag + attlist.join('')+">";
                            res += options.fn(this);
                            res += "</" + tag + ">";
                            return res;
                       };
    env.registerHelper("img", tagFunc);

    env.registerHelper("add", function Add (v1, v2) { return v1 + v2; });

    assert.equal(env.render('{{#img src=href}}{{name}}{{/img}}', {name: "(name)", href: "http://localhost/"}),
                 '<img src="http://localhost/">(name)</img>');
    assert.equal(env.render('{{#img src=href}}{{name}}{{/img}}', {name: "(name)", href: "http://www/"}),
                 '<img src="http://www/">(name)</img>');
    assert.equal(env.render("{{#img href='url'}}{{name}}{{/img}}", {name: "(name)"}),
                 '<img href="url">(name)</img>');
    assert.equal(env.render("{{#img href=( add 'http:' name )}}{{name}}{{/img}}", {name: "<name>"}),
                 '<img href="http:&lt;name&gt;">&lt;name&gt;</img>');
});

test("Poirot.partials", function(assert) {
    // Sub-templates: {{> foo }}
    var env = Poirot.create();
    env.registerPartial("demo", "Partial:{{name}}");
    assert.equal(env.render('Base: {{> demo }}', {name: '(name)'}), 'Base: Partial:(name)');
    assert.equal(env.render('Base: {{#with foo}}{{> demo }}{{/with}}', {foo: {name: '(name)'}}), 'Base: Partial:(name)');
    assert.equal(env.render('Base: {{> demo foo }}', {foo: {name: '(name)'}, name: 'X'}), 'Base: Partial:(name)');
    assert.equal(env.render('Base: {{> demo foo name="XXX"}} BAK:{{foo.name}}',
                            {foo: {name: '(name)'}, name: 'X'}),
                 'Base: Partial:XXX BAK:(name)');

    env.registerPartial("uplev", "L0:{{name}} L1:{{../name}} L2:{{../../name}} L3:{{../../../name}}");
    var sub = {name:"X0", sub1:{name:"X1", sub2:{name:"X2", sub3:{name:"X3", sub4:{name:"X4"}}}}};
    assert.equal(env.render('Base: {{sub.name}} {{>uplev sub.sub1.sub2}}',
                            {sub: sub}),
                 'Base: X0 L0:X2 L1:X2 L2: L3:');
    assert.equal(env.render('Base: {{sub.name}} {{#with sub.sub1.sub2}}{{> uplev}}{{/with}}',
                            {sub: sub}),
                 'Base: X0 L0:X2 L1:X2 L2: L3:');

    env.registerPartial("subindex", "[ {{@index}} ]");
    assert.equal(env.render('{{#each list}}{{> subindex}} = {{.}}, {{/each}}', {list:[1,2,3]}),
                 '[ 0 ] = 1, [ 1 ] = 2, [ 2 ] = 3, ');
});

test("Poirot.local-data", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    // local vars
    assert.equal(render('{{#each lst}}{{@first}},{{@index}},{{name}}|{{/each}}', {lst: [{name: "A"}, {name: "B"}]}), 'true,0,A|false,1,B|');
    assert.equal(render('{{#each lst }}{{ @first }},{{ @index }},' +
                      '[{{#each lst2}}{{@first}};{{@index}}![{{@../index}}]{{/each}}] {{/each}}',
                      {lst: [{lst2: [1,2,3]}, {lst2: [4,5,6]}]}),
               'true,0,[true;0![0]false;1![0]false;2![0]] false,1,[true;0![1]false;1![1]false;2![1]] ');
    assert.equal(render('{{#with foo}}{{#if bool}}{{val}},{{../val}},{{../../val}} /{{../../../val}}/{{/if}}{{/with}}',
                      {foo:{bool: true, val: '(sub)'}, val:'(root)'}),
               '(sub),(sub),(root) //');
    assert.equal(render('{{#with foo}}{{#if bool~}} {{~@root.val}} / {{@root.foo.val}}{{/if}}{{/with}}',
                      {foo:{bool: true, val: '(sub)'}, val:'(root)'}),
               '(root) / (sub)');
});

test("Poirot.mustache", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    assert.equal(render('{{#foo}}{{name}}{{/foo}}', {foo: {name: "Me & Myself"}}), 'Me &amp; Myself');
    assert.equal(render('{{#undef}}UNDEF{{/undef}}', {}), '');
    assert.equal(render('{{#foo}}{{name}}{{/foo}}', {foo: {name: "Me & Myself"}}), 'Me &amp; Myself');
    assert.equal(render('{{#list}}{{name}},{{/list}}', {list: [{name: "N1"},{name:"N2"}]}), 'N1,N2,');
    assert.equal(render('{{# list }}{{ name }},{{/ list }}', {list: []}), '');
    assert.equal(render('{{#simple1}}{{ simple2 }}{{/simple1}}', {simple1: 12, simple2: 23}), '23');


    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: 1, bar: 2}), 'X:2/[object Object]');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: 1, bar: 2}), '');
    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: 0, bar: 2}), '');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: 0, bar: 2}), 'X:2/[object Object]');

    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: true, bar: 3}), 'X:3/[object Object]');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: true, bar: 3}), '');
    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: false, bar: 3}), '');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: false, bar: 3}), 'X:3/[object Object]');

    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: null, bar: 3}), '');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: null, bar: 3}), 'X:3/[object Object]');
    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {bar: 3}), '');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {bar: 3}), 'X:3/[object Object]');

    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: "", bar: 3}), '');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: "", bar: 3}), 'X:3/[object Object]');
    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: "z", bar: 3}), 'X:3/[object Object]');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: "z", bar: 3}), '');

    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: [], bar: 3}), '');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: [], bar: 3}), 'X:3/[object Object]');
    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: [4,5], bar: 3}), 'X:/4X:/5');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: [4,5], bar: 3}), '');

    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: {}, bar: 3}), 'X:/[object Object]');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: {}, bar: 3}), '');
    assert.equal(render('{{#foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: {bar:5}, bar: 3}), 'X:5/[object Object]');
    assert.equal(render('{{^foo}}X:{{bar}}/{{.}}{{/foo}}', {foo: {bar:5}, bar: 3}), '');
});

test("Poirot.builtins", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    assert.equal(render('{{#noop}}NOOP:{{foo}}{{/noop}}', {foo: 'test'}), 'NOOP:test');
    assert.equal(render('{{#if foo.name}}{{foo.name}}{{/if}}', {foo: {name: "Me & Myself"}}), 'Me &amp; Myself');
    assert.equal(render('{{#each foo.list}}{{id}},{{/each}}', {foo: {list: [{'id':1},{'id':2}]}}), '1,2,');
    assert.equal(render('{{#each empty}}GOT{{^}}NOTHING{{/each}}', {empty: []}), 'NOTHING');
    assert.equal(render('{{#each empty}}GOT{{^}}NOTHING{{/each}}', {empty: {}}), 'NOTHING');
    assert.equal(render('{{#each empty}}GOT{{^}}NOTHING{{/each}}', {empty: false}), 'NOTHING');
    assert.equal(render('{{#with foo}}foo.name: {{name}}{{/with}}', {foo: {name: "Me & Myself"}}), 'foo.name: Me &amp; Myself');
    assert.equal(render('{{#with empty}}GOT{{^}}NOTHING{{/with}}', {empty: false}), 'NOTHING');
    assert.equal(render('{{#unless val}}P1{{^}}P2{{/unless}}', {val: 1}), 'P2');
    assert.equal(render('{{#unless val}}P1{{^}}P2{{/unless}}', {val: false}), 'P1');
    assert.equal(render('{{#if foo.bar}}IF{{^}}NOT: {{foo.name}}{{/if}}', {foo: {name: "Me & Myself"}}), 'NOT: Me &amp; Myself');
    assert.equal(render('{{#if foo.bar}}IF{{else}}NOT: {{foo.name}}{{/if}}', {foo: {name: "Me & Myself"}}), 'NOT: Me &amp; Myself');
    assert.equal(render('{{^foo.bar}}NOT: {{foo.name}}{{/foo.bar}}', {foo: {name: "Me & Myself"}}), 'NOT: Me &amp; Myself');

    assert.equal(render('{{lookup foo "name"}}', {foo: {name: "Me & Myself"}}), 'Me &amp; Myself');
    assert.equal(render('{{#each list}}{{lookup ../list @index}},{{/each}}', {list: ['a','b','c']}), 'a,b,c,');
    assert.equal(render('{{#each obj}}{{#if @index}},{{/if}}{{lookup ../obj @key}}={{.}}{{/each}}', {obj:{'a':'A','b':'B'}}), 'A=A,B=B');
    assert.equal(render('{{#each obj}}qq{{^}}zz{{/each}}', {obj:{}}), 'zz');
    /*
    assert.equal(render('{{lookup foo "name"}}', {foo: {name: function(){return '(foo)';}}}), '(foo)');
    assert.equal(render('{{lookup foo "name"}}',
                      // getter returns object with getter
                      {foo: function(){return {name: function(){return '(foo)';}};}}),
               '(foo)');
    */
});

test("Poirot.func-values", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    var SafeString = Poirot.SafeString;
    assert.equal(render('{{val}}', {val: function() {return '<>';}}), '&lt;&gt;');
    assert.equal(render('{{{val}}}', {val: function() {return '<>';}}), '<>');
    assert.equal(render('{{val}}', {val: function() {return new SafeString('<>');}}), '<>');
    assert.equal(render('{{val}}', {val: function() {return this.foo;}, foo:'Foo'}), 'Foo');
    assert.equal(render('{{#with obj}} {{val}} {{/with}}', {foo:'Bad', obj:{foo:'Good', val: function() {return this.foo;}}}), ' Good ');
    assert.equal(render('{{#with obj}} {{../val}} {{/with}}',
                      {foo:'Good', val: function() {return this.foo;}, obj:{foo:'Bad', val: function() {return this.foo;}}}), ' Good ');
    assert.equal(render('{{val foo}}', {val: function(arg) {return arg;}, foo:'Foo'}), 'Foo');
});

test("Poirot.helpers", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    var SafeString = Poirot.SafeString;
    assert.equal(render('{{val}}', {val: function() {return '<>';}}), '&lt;&gt;');
    assert.equal(render('{{{val}}}', {val: function() {return '<>';}}), '<>');
    assert.equal(render('{{val}}', {val: function() {return new SafeString('<>');}}), '<>');
    assert.equal(render('{{val}}', {val: function() {return this.foo;}, foo:'Foo'}), 'Foo');
    assert.equal(render('{{#with obj}} {{val}} {{/with}}', {foo:'Bad', obj:{foo:'Good', val: function() {return this.foo;}}}), ' Good ');
    assert.equal(render('{{#with obj}} {{../val}} {{/with}}',
                      {foo:'Good', val: function() {return this.foo;}, obj:{foo:'Bad', val: function() {return this.foo;}}}), ' Good ');
});

test("Poirot.trim", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    assert.equal(render('a {{~key~}} b {{~key}} c {{key~}} d', {key: '!'}), 'a!b! c !d');
    assert.equal(render('a \n {{~key~}} \n b \n {{~key}} c {{key~}} \n d', {key: '!'}), 'a!b! c !d');
    assert.equal(render('a {{~ key ~}} b {{~ key }} c {{ key ~}} d {{key}}', {key: '!'}), 'a!b! c !d !');
    assert.equal(render('a {{~#key~}} b {{~.~}} c {{~/key~}} d', {key: ['!']}), 'ab!cd');
    assert.equal(render('a {{~# key ~}} b {{~ . ~}} c {{~/ key ~}} d', {key: ['!']}), 'ab!cd');
    assert.equal(render('a {{~#with key~}} b {{~attr~}} c {{~/with~}} d', {key: {attr: '!'}}), 'ab!cd');
    assert.equal(render('a {{~# with key ~}} b {{~ attr ~}} c {{~/ with ~}} d', {key: {attr: '!'}}), 'ab!cd');
});

test("Poirot.raw", function(assert) {
    var env = Poirot.create();
    var rawFunc = function Tag (arg, options) {
                            var raw = options.fn(this);
                            return '<<' + raw + '>>';
                       };
    env.registerHelper("rawhelper", rawFunc);

    assert.equal(env.render('{{{{rawhelper foo}}}} {{foo}} c {{{{/rawhelper}}}} d', {foo: '!'}),
                 '<< {{foo}} c >> d');
});

test("Poirot.atdata", function(assert) {
    var env = Poirot.create();

    assert.equal(env.render('{{#with foo}}{{a}}:{{@misc}}:{{@root.foo.b}}{{/with}}',
                            {foo: {a: "A", b: "B"}},
                            {data: {misc: "MISC"}}),
                 "A:MISC:B");
});

test("Poirot.options", function(assert) {
    var env = Poirot.create();

    assert.equal(env.render('{{qwe foo}}', {foo: '!'},
                            {helpers: { qwe: function (arg) { return 'qwe'+arg; } }}),
                 'qwe!');
    assert.equal(env.render('{{qwe foo}}', {foo: '!'},
                            {helpers: { qwe: function (arg) { return 'qwe'+arg; } }}),
                 'qwe!');
});

test("Poirot.errors", function(assert) {
    var render = function(tmpl, data) { return Poirot.render(tmpl, data); };
    var TemplateError = Poirot.TemplateError;
    var data = {a: 0, b: "<b>", c: null, str: '\\&<>"\'/\\'};

    // test errors
    assert.throws(function(){render('{{ foo[] }}', data);}, Error);
    assert.throws(function(){render('{{ foo[] }}', data);}, TemplateError);
    assert.throws(function(){render('{{ foo[a] }}', data);}, TemplateError);

    assert.throws(function(){render('{{ foo/../asd }}', data);}, TemplateError);
    assert.throws(function(){render('{{ ... }}', data);}, TemplateError);
    assert.throws(function(){render('{{ //qwe }}', data);}, TemplateError);
    assert.throws(function(){render('{{ foo//xfilt }}', data);}, TemplateError);

    assert.throws(function(){render('{{ @foo/../asd }}', data);}, TemplateError);
    assert.throws(function(){render('{{ @... }}', data);}, TemplateError);
    assert.throws(function(){render('{{ @//qwe }}', data);}, TemplateError);
    assert.throws(function(){render('{{ @foo//xfilt }}', data);}, TemplateError);

    assert.throws(function(){render('{{# foo }}', data);}, TemplateError);
    assert.throws(function(){render('{{# foo }}{{/ bar }}', data);}, TemplateError);
    assert.throws(function(){render('{{# }}', data);}, TemplateError);
    assert.throws(function(){render('{{/ bar }}', data);}, TemplateError);
    assert.throws(function(){render('{{^with foo}}', data);}, TemplateError);
    assert.throws(function(){render('{{^undef foo}}', data);}, TemplateError);

    assert.throws(function(){render('{{#if foo}}{{^}}{{^}}{{/if}}', data);}, TemplateError);
    assert.throws(function(){render('{{#if foo}}{{else}}{{^}}{{/if}}', data);}, TemplateError);

    assert.throws(function(){render('{{!  ', data);}, TemplateError);
    assert.throws(function(){render('{{!-- }} ', data);}, TemplateError);

    assert.throws(function(){render('{{> undef }} ', data);}, TemplateError);

    // positions
    assert.throws(function(){render('{{ "', data);}, /\[Line 1 col 4\]/);
    assert.throws(function(){render('1\n2\n{{ "', data);}, /\[Line 3 col 4\]/);
    assert.throws(function(){render('\n   {{ " ', data);}, /\[Line 2 col 7\]/);
});

test("Poirot.elif", function(assert) {
    var env = Poirot.create();

    assert.equal(env.render('<{{#if foo}} A {{else if bar}} B {{ else }} C {{/if}}>',
                            {foo: true, bar: true}), "< A >");
    assert.equal(env.render('<{{#if foo}} A {{else if bar}} B {{ else }} C {{/if}}>',
                            {foo: false, bar: true}), "< B >");
    assert.equal(env.render('<{{#if foo}} A {{else if bar}} B {{ else }} C {{/if}}>',
                            {foo: false, bar: false}), "< C >");

    assert.equal(env.render('<{{#with sub}}{{#if foo}} A:{{../../name}} {{else if bar}} B:{{../../name}} {{else}} C:{{../../name}} {{/if}}{{/with}}>',
                            {sub:{foo: true, bar: true}, name:"Name"}), "< A:Name >");
    assert.equal(env.render('<{{#with sub}}{{#if foo}} A:{{../../name}} {{else if bar}} B:{{../../name}} {{else}} C:{{../../name}} {{/if}}{{/with}}>',
                            {sub:{foo: false, bar: true}, name:"Name"}), "< B:Name >");
    assert.equal(env.render('<{{#with sub}}{{#if foo}} A:{{../../name}} {{else if bar}} B:{{../../name}} {{else}} C:{{../../name}} {{/if}}{{/with}}>',
                            {sub:{foo: false, bar: false}, name:"Name"}), "< C:Name >");

    assert.equal(env.render('<{{#if none}} A:{{none}} {{else with sub}} B:{{foo}} {{else}} C:{{baz}} {{/if}}>',
                            {sub:{foo: 'Foo'}, baz:"Baz"}), "< B:Foo >");
    assert.equal(env.render('<{{#if none}} A:{{none}} {{else with sub}} B:{{foo}} {{else}} C:{{baz}} {{/if}}>',
                            {baz:"Baz"}), "< C:Baz >");
});

})(typeof poirot !== 'undefined' ? poirot : require('./poirot'));


