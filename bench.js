#! /usr/bin/env node

var Benchmark = require('benchmark');
var Poirot = require('./dist/poirot.min.js');
var Handlebars2 = require('./other/handlebars.min-v2.0.0.js');
var Handlebars4 = require('./other/handlebars.min-v4.0.1.js');

var EXPAND = 4, PRELOOP = 100;

var testcases = [
    {name: "Deep ifs",
     tmpl: "Bazoo {{#if myObject.attr.valid}} seg1 {{#if other.list.[1].valid }} seg2 {{/if}} seg3 {{/if}} END ",
     data: {myObject: {random: {}, attr: {name: 'tmp', valid: true}},
            other: {list: [{}, {name: 'tmp', valid: true}, {}]}}
    },
    {name: 'raw value', tmpl: '<html>{{{name}}}</html>', data: {name: 'Foo Bar Baz'}},
    {name: 'escaped safe value', tmpl: '<html>{{name}}</html>', data: {name: 'Foo Bar Baz'}},
    {name: 'escaped unsafe value', tmpl: '<html>{{name}}</html>', data: {name: 'Foo Bar Baz'}},
    {name: 'simple list', tmpl: '<html>{{#each lst}} {{@index}}:{{.}} {{/each}}</html>', data: {lst: [1,2,3,4,5,6]}},
    {name: "#each, thin list",
     tmpl: "{{#each lst}} {{{name}}} {{/each}},",
     data: {lst: [{name:"Boza"}, {name:"Bazawqeofyu"}, {name:"oiausdoay"},{name: "qweqwewqe"}]}
    },
    {name: "#each, medium object",
     tmpl: "Bazoo {{#each obj}} seg1 {{#if @index }} seg2 {{/if}} seg3 {{{ @key }}} {{{name}}} {{/each}} END ",
     data: {obj: {"aaaaaa":{name:"Boza"}, "bbbbbb": {name:"Bazawqeofyu"}, "cccccc": {name:"oiausdoay"}, "dddddd": {name: "qweqwewqe"}}}
    },
    {name: "#each, medium list",
     tmpl: "Bazoo {{#each lst}} seg1 {{#if @index }} seg2 {{/if}} seg3 {{{name}}} {{/each}} END ",
     data: {lst: [{name:"Boza"}, {name:"Bazawqeofyu"}, {name:"oiausdoay"},{name: "qweqwewqe"}]}
    },
    {name: "Shallow ref, no quoting",
     tmpl: "Bazoo {{{var1}}} seg1 {{{var2}}} seg2 {{{var3}}} seg3 {{{var4}}} END ",
     data: {var1: "32649321874", var2: true, var3: 5.5, var4: "asicuais"}
    },
    {name: "Shallow ref, with escaping, unsafe data",
     tmpl: "Bazoo {{var1}} seg1 {{var2}} seg2 {{var3}} seg3 {{var4}} END ",
     data: {var1: "326>4932<1874", var2: true, var3: 5.5, var4: "asi&cuais"}
    },
    {name: "Shallow ref, with escaping, safe data",
     tmpl: "Bazoo {{var1}} seg1 {{var2}} seg2 {{var3}} seg3 {{var4}} END ",
     data: {var1: "32649321874", var2: true, var3: 5.5, var4: "asicuais"}
    },
    {name: "Deep ifs",
     tmpl: "Bazoo {{#if myObject.attr.valid}} seg1 {{#if other.list.[1].valid }} seg2 {{/if}} seg3 {{/if}} END ",
     data: {myObject: {random: {}, attr: {name: 'tmp', valid: true}},
            other: {list: [{}, {name: 'tmp', valid: true}, {}]}}
    },
    {name: "Shallow ifs",
     tmpl: "Bazoo {{#if bool1}} seg1 {{#if bool2 }} seg2 {{/if}} seg3 {{/if}} END ",
     data: {bool1: true, bool2: [1]}
    }
];

function make_test(t, doCompiler) {
    var pfx = doCompiler ? "Compile - " : "Render - ";
    var suite = new Benchmark.Suite(pfx + t.name);
    var data = t.data;
    var tmpl = t.tmpl;
    var i;

    for (i = 0; i < EXPAND; i++)
        tmpl = tmpl + tmpl;

    if (doCompiler) {
        var pcompile = function() { var render = Poirot.compile_nocache(tmpl); render(data); };
        var hcompile2 = function() { var render = Handlebars2.compile(tmpl); render(data); };
        var hcompile4 = function() { var render = Handlebars4.compile(tmpl); render(data); };
        for (i = 0; i < PRELOOP; i++) {
            pcompile();
            hcompile2();
            hcompile4();
        }
        suite.add('poirot', pcompile);
        suite.add('handlebars2', hcompile2);
        suite.add('handlebars4', hcompile4);
    } else {
        var prender = Poirot.compile_nocache(tmpl);
        var hrender2 = Handlebars2.compile(tmpl);
        var hrender4 = Handlebars4.compile(tmpl);
        for (i = 0; i < PRELOOP; i++) {
            prender(data);
            hrender2(data);
            hrender4(data);
        }
        suite.add('poirot', function(){ prender(data); });
        suite.add('handlebars2', function(){ hrender2(data); });
        suite.add('handlebars4', function(){ hrender4(data); });
    }
    suite.on('complete', function() {
        var base = 0;
        console.log("Test: "+this.name + "    [tmpl:"+tmpl.length+" bytes]");
        this.sort('fastest');
        this.forEach(function (b) {
            var v = b.stats.mean + b.stats.moe;
            if (b.name === 'handlebars4')
                base = v;
        });
        this.forEach(function (b) {
            var v = b.stats.mean + b.stats.moe;
            var p = v*100 / base;
            console.log("  "+p.toFixed(1)+"% (" + (base/v).toFixed(1)+"x): "+b);
        });
    });
    suite.run();
    console.log("");
}

function run_tests(tlist, doCompiler) {
    for (var i = 0; i < tlist.length; i++)
        make_test(tlist[i], doCompiler);
}

run_tests(testcases, true);

run_tests(testcases, false);

