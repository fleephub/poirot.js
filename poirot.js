/*
 * Handlebars HTML templates without eval().
 *
 * Syntax reference: http://handlebarsjs.com/
 *
 * Most of Mustache also applies, except tag-change, recursive lookup
 * and partials in data: https://mustache.github.io/mustache.5.html
 *
 * ### Handlebars basic syntax
 *
 *   {{ key }}                  - data[key] as escaped HTML
 *   {{{ key }}}                - data[key] as raw (unescaped) HTML
 *
 * ### Helper syntax
 *
 *   {{ helpername arg ... }}   - Call helper with args, don't escape output
 *
 * ### Block helper syntax
 *
 *   {{# helpername arg ... }}  - Call helper with args, helper decides how to launch block contents
 *      ...
 *   {{else blockhelper ... }}
 *      ...
 *   {{else}} or {{^}}
 *      ...
 *   {{/ helpername }}
 *
 * ### Subexpressions
 *
 *   {{ helper (helper2 foo 'bar' true) (helper3 "foo" 12.3) }}
 *
 * ### Whitespace control
 *
 *   {{~            - remove whitespace before tag
 *   ~}}            - remove whitespace after tag
 *
 * ### Built-in block helpers
 *
 *  {{#with arg}} .. {{/with}}  - Use 'arg' as new context, if arg is falsey runs {{else}} section
 *  {{#each arg}} .. {{/each}}  - Loop over 'arg', use elem as context, if falsey runs {{else}} section
 *  {{#if arg}} .. {{/if}       - Conditional, if falsey runs {{else}} section
 *  {{#unless arg}} .. {{/if}   - Reverse conditional, if not falsey runs {{else}} section
 *  {{#noop}} .. {{/noop}       - Just run block
 *
 * ### Mustache blocks
 *
 *  {{#val}} .. {{/val}}        - Checks if value is array, object or other.
 *                                array - loop over, use elem as context.
 *                                object - use object as context
 *                                simple val - keep old context
 *                                falsey - run {{else}} section
 *  {{^val}} .. {{/val}}        - Checks if value is array, object or other.
 *
 * ### Built-in simple helpers
 *
 *  {{lookup arg key}}              - Dynamic lookup
 *  {{log arg}}                     - Log stuff
 *
 * ### Fallback helpers, called when helper is not found
 *
 *  {{#blockHelperMissing .. }}     - Called when block helper is not found, implements old Mustache blocks
 *  {{helperMissing .. }}           - Called when simple helper is not found, throws error by default
 *
 * ### Argument syntax
 *
 *  key1.key2                   - Path lookup from context
 *  123123                      - Number constant
 *  "123" / '123'               - String constant
 *  true / false                - Boolean constant
 *
 * ### Path syntax
 *
 *   ident.[free-form ident]    - Refer key
 *   ident.[0]                  - Refer numeric index
 *   ../../key                  - Refer context 2 blocks up
 *   ./key or this.key          - Refer to current context
 */

/*
 * ## Internal API
 *
 * There are 3 calling protocols in use:
 *
 * "helper" - for registered and from context value helpers:
 *
 *      this - current context
 *      arg0..N - args given by user
 *      arg[N+1] - options, has 'data', 'hash', 'fn', 'inverse'
 *
 *      'options' has fields:
 *
 *          data    - local variables, maybe set by block helpers
 *          hash    - key=val arguments, or {}
 *          fn      - compiled template for inner block
 *          inverse - compiled template for "else" inner block
 *
 *      If helper wants to change 'data', it needs to create copy of it first:
 *
 *         options.data = createFrame(options.data);
 *
 * "value" - for function in data, without extra args:
 *
 *      this - local context
 *
 * "node" - Internal use for node functions:
 *
 *      this - HelperOptions, which has 'data' for local variables.
 *      arg0 - current context
 *
 * "current context" - context at the time of "{{"-tag start
 * "local context" - {{foo.func}} has 'foo' as local context
 */

(function (factory) {                       /* istanbul ignore next: UMD loader */
    if (typeof define === "function" && define.amd) {
        define([], factory);
    } else if (typeof exports === "object") {
        module.exports = factory();
    } else {
        this.poirot = factory();
    }
}(function () {

"use strict";

/*
 * Generic utilities.
 */

var objProto = Object.prototype;
var hasOwnProperty = objProto.hasOwnProperty;
var toString = objProto.toString;

// Return true if value is array.
var isArray = Array.isArray ||              /* istanbul ignore next: compat */
    function isArrayCompat (a) { return toString.call(a) === "[object Array]"; };

// Return true if object is function.
function isFunction(o) {
    return typeof(o) === "function";
}

/*
 * Detect is value is object, array, function or 'arguments'
 *
 * Returns false on 'null'.
 */
function isObject(o) {
    return (typeof o === "object" && o !== null) || isFunction(o);
}

/*
 * Detect "falsey" values
 * - Normal JavaScript falsey
 * - Empty list
 */
function isEmpty(o) {
    return !o || (isArray(o) && !o.length);
}

// shallow copy of object attributes
function extend(dstobj /* srcobj1, srcobj2 */) {
    var i, k, srcobj, args = arguments;
    for (i = 1; i < args.length; i++) {
        srcobj = args[i];
        for (k in srcobj) {
            if (hasOwnProperty.call(srcobj, k))
                dstobj[k] = srcobj[k];
        }
    }
    return dstobj;
}

// Create new options.data object from old one.
// To be used in places where hasOwnProperty check is not needed.
function createFrame(data) {
    /*jshint forin:false */
    var k, res = {};
    for (k in data)
        res[k] = data[k];
    return res;
}

/*
 * Tag string as already escaped.
 *
 * escapeExpression() and {{val}} tags will pass it
 * through without escaping.
 */

function SafeString(s) { this.string = s; }
SafeString.prototype.toString = function() { return this.string.toString(); };

/*
 * Exception class for syntax errors.
 */

function TemplateError(message) {
    this.name = "TemplateError";
    this.message = message;
    this.stack = (new Error(message)).stack;
}
TemplateError.prototype = Object.create ? Object.create(Error.prototype) : new Error();
TemplateError.prototype.constructor = TemplateError;

/*
 * Escape text for HTML, ignore SafeString.
 */

var ESC_MAP = { '&': "&amp;", '<': "&lt;", '>': "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeChar(match) { return ESC_MAP[match]; }

function escapeExpression(s) {
    if (s == null)
        return '';
    if (s instanceof SafeString)
        return s + '';
    s = s + '';
    if (/[&<>"']/.test(s))
        return s.replace(/[&<>"']/g, escapeChar);
    return s;
}

/*
 * Collect hash arguments.
 */

function load_hash_args(opts, ctx, hlist)
{
    var i, kw, nhash = hlist.length, hash = {};
    for (i = 0; i < nhash; i++) {
        kw = hlist[i];
        hash[kw[0]] = kw[1].call(opts, ctx);
    }
    return hash;
}

/*
 * Simple nodes.
 */

function make_const_node(val) {
    return function ConstNode () { return val; };
}

function make_this_node(isdata, uplev) {
    if (isdata) {
        if (uplev) {
            return function UpDataNode (/* ctx */) {
                return this._walk(uplev).data;
            };
        } else {
            return function ThisDataNode (/* ctx */) {
                return this.data;
            };
        }
    } else if (uplev) {
        return function UpThisNode (/* ctx */) {
            return this._walk(uplev - 1)._ctx;
        };
    } else {
        return function ThisNode (ctx) {
            return ctx;
        };
    }
}

function make_unquoted_node(node) {
    return function UnquotedNode (ctx) {
        var v = node.call(this, ctx);
        return v == null ? '' : v;
    };
}

function make_quoted_node(node) {
    return function QuotedNode (ctx) {
        return escapeExpression(node.call(this, ctx));
    };
}

function make_not_node(node) {
    return function NotNode (ctx) {
        return isEmpty(node.call(this, ctx));
    };
}

function got_undef(namelist, val) {
    if (logging.log_undefined) {
        var name = namelist.join('.');
        logging.log_undefined(name);
    }
    return val;
}

function make_value_node(namelist, local_ident, up_levels, runFunc) {
    var name;

    if (up_levels === 0 && namelist.length === 1) {
        name = namelist[0];
        if (local_ident) {
            return function LocalNodeSmall (/* context */) {
                return this.data[name];
            };
        } else {
            return function CtxNodeSmall (ctx) {
                var v = ctx[name];
                if (typeof v === 'undefined') return got_undef(namelist, v);
                return (runFunc && isFunction(v)) ? v = v.call(ctx) : v;
            };
        }
    }

    if (local_ident) {
        return function LocalNodeBig (/* context */) {
            var i, opts = this._walk(up_levels), v = opts.data;
            for (i = 0; v != null && i < namelist.length; i++)
                v = v[namelist[i]];
            return v;
        };
    } else {
        return function CtxNodeBig (context) {
            var i, ctx, v = up_levels ? this._walk(up_levels-1)._ctx : context;
            for (i = 0; v != null && i < namelist.length; i++) {
                ctx = v;
                v = ctx[namelist[i]];
            }
            if (typeof v === 'undefined') return got_undef(namelist, v);
            return (runFunc && isFunction(v)) ? v.call(ctx) : v;
        };
    }
}

function make_partial_node(partial_render, args, hash) {
    if (args.length + hash.length === 0) {
        return function SmallPartialNode (ctx) {
            // same context, pass HelperOptions
            return partial_render(ctx, this);
        };
    } else {
        return function FullPartialNode(ctx) {
            var newctx = ctx;

            // first positional arg is new context
            if (args.length > 0)
                newctx = args[0].call(this, ctx);

            // hash args are merged into context
            if (hash.length > 0)
                newctx = extend({}, newctx, load_hash_args(this, ctx, hash));

            // new context, pass HelperOptions
            return partial_render(newctx, this);
        };
    }
}

function make_blocklist_node(frag_list) {
    return function BlockListNode (ctx) {
        var i, res = '';
        for (i = 0; i < frag_list.length; i++)
            res += frag_list[i].call(this, ctx);
        return res;
    };
}

/*
 * Magic 'options' class.
 */

function HelperOptions(prev_opts, ctx, fn, inverse, hash, name) {

    if (prev_opts) {
        this._ctx = ctx;
        this._parent = prev_opts;
        this.data = prev_opts.data;
    } else {
        // make_renderer assumes new object
        this.data = {root: ctx};
    }
    if (name)
        this.name = name;
    if (fn)
        this.fn = fn;
    if (inverse)
        this.inverse = inverse;
    if (hash)
        this.hash = hash;
}

extend(HelperOptions.prototype, {

    // public API

    data: {},                       // current extra data
    hash: {},                       // key-value args for current helper call
    name: null,                     // ident that was used to reference helper
    fn: null,                       // runner for first block
    inverse: null,                  // runner for "else" block

    // rest is internal API

    _parent: null,                  // parent HelperOptions or null
    _ctx: {},                       // previous context

    // walk up in HelperOptions chain
    _walk: function WalkUp (levels) {
        var opts = this;
        while (levels--) {
            opts = opts._parent;
            if (!opts)
                return new HelperOptions(null, {});
        }
        return opts;
    }
});

/*
 * Complex nodes that handle helpers.
 */

// node that uses 'helper' protocol
function make_helper_node(hfunc, fnode, h_args, h_hash_args, cur_sect_func, inv_sect_func, missing_helper, name, skip_level) {
    if (hfunc && h_args.length === 1 && !h_hash_args.length) {
        return function SmallHelperNode(ctx) {
            var _parent = skip_level ? this._parent : this;
            var arg = h_args[0].call(this, ctx);
            var opts = new HelperOptions(_parent, ctx, cur_sect_func, inv_sect_func, null, name);
            return hfunc.call(ctx, arg, opts);
        };
    }
    return function FullHelperNode(ctx) {
        var _parent = skip_level ? this._parent : this;
        var i, args = [], hash;
        var func = hfunc;

        if (!func) {
            func = fnode.call(this, ctx);
            if (!isFunction(func)) {
                args.push(func);
                func = missing_helper;
            }
        }

        for (i = 0; i < h_args.length; i++)
            args.push(h_args[i].call(this, ctx));

        if (h_hash_args.length)
            hash = load_hash_args(this, ctx, h_hash_args);

        args.push(new HelperOptions(_parent, ctx, cur_sect_func, inv_sect_func, hash, name));

        return func.apply(ctx, args);
    };
}

// top-level renderer
function make_renderer(frag_list) {
    return function Render (ctx, options) {
        var i, res = '', newopts;

        // options is either plain dict with 'data' or HelperOptions
        // when called as partial
        if (options && options instanceof HelperOptions) {
            newopts = new HelperOptions(options, ctx);
        } else {
            newopts = new HelperOptions(null, ctx);
            if (options && options.data) {
                // this assumes HelperOptions creates new data object
                extend(newopts.data, options.data);
            }
        }

        for (i = 0; i < frag_list.length; i++)
            res += frag_list[i].call(newopts, ctx);

        return res;
    };
}

/*
 * Main compiler.
 */

// regex to match single token

// Non-word chars in idents:
// Allowed:     $-:?_
// Disallowed:  !"#%&'()*+,./;<=>@[\]^`{|}~

var NONIDENT = "\\x00-\\x20\\x7F\\s!\"#%&'()*+,.\\/;<=>@\\[\\\\\\]^`{|}~";
var NUMBER = "-?[0-9]+(?:[.][0-9]+)?\\b";
var STR1 = "'(?:[^'\\\\]|\\\\.)*'";
var STR2 = '"(?:[^"\\\\]|\\\\.)*"';

var TOKEN_REGEX =
    "("+STR1+"|"+STR2+"|"+NUMBER+")" +          // 1:CONST
    "|([^"+NONIDENT+"]+|\\[[^\\]]+\\])" +       // 2:IDENT
    "|(\\s+)" +                                 // 3:SPACE
    "|(.)";                                     // 4:OTHER

// Names for regex groups
var G_CONST = 1, G_IDENT = 2, G_SPACE = 3, G_OTHER = 4;

// Token codes
var IDENT = 1, SPACE = 2, DOT = 3, OPEN = 4, CLOSE = 5, EQ = 6;
var CONST = 7, TILDE = 8, END = 9, AT = 10, SLASH = 11;
var THIS = 12, TRUE = 13, FALSE = 14, ELSE = 15;

// Map token string to code
var TOKEN_MAP = {'.':DOT, '(':OPEN, ')':CLOSE, '=':EQ, '~':TILDE, '}':END, '@':AT, '/':SLASH };

// find tag start, or escaped char
var START_REGEX = "\\{\\{(?:(\\{\\{?)(~?)|(~?)(!--|[&#^/>!]?))|\\\\(.)";

// regex group names
var SG_BT1 = 1, SG_TILDE1 = 2, SG_TILDE2 = 3, SG_BT2 = 4, SG_ESCAPE = 5;

function real_compiler(tmpl, helpers, partials, knownHelpersOnly, noFunctionValues) {
    // regex objects
    var tokrx = new RegExp(TOKEN_REGEX, "g");
    var startrx = new RegExp(START_REGEX, "g");

    var mtok, mstart;       // match objects
    var tok;                // token code
    var tok_start_pos = 0;  // offset in tmpl for token start

    // throw error
    function syntax_error(msg) {
        // find position
        var line = 1, last = 0, cur;
        var xln = /\n/g;

        while (xln.exec(tmpl)) {
            cur = xln.lastIndex;
            if (cur > tok_start_pos)
                break;
            last = cur;
            line++;
        }

        // col as 1-based number
        cur = tok_start_pos - last + 1;

        throw new TemplateError(msg + " [Line " + line + " col " + cur + "]");
    }

    // run token regex, load token code
    function next_tok() {
        tok_start_pos = tokrx.lastIndex;
        mtok = tokrx.exec(tmpl);
        if (mtok) {
            if (mtok[G_IDENT]) {
                switch (mtok[G_IDENT]) {
                    case "else": tok = ELSE; break;
                    case "this": tok = THIS; break;
                    case "true": tok = TRUE; break;
                    case "false": tok = FALSE; break;
                    default: tok = IDENT; break;
                }
            } else if (mtok[G_SPACE]) {
                tok = SPACE;
            } else if (mtok[G_CONST]) {
                tok = CONST;
            } else {
                tok = TOKEN_MAP[mtok[G_OTHER]];
                if (tok == null)
                    syntax_error("Unknown symbol: "+mtok[G_OTHER]);
            }
        } else {
            syntax_error("Unexpected end of template");
        }
    }

    // consume token if matches
    function eat(exptok) {
        if (tok === exptok) {
            next_tok();
            return true;
        }
        return false;
    }

    // throw error if does not match
    function musteat(exptok) {
        if (tok === exptok) {
            next_tok();
        } else {
            syntax_error("Unexpected token "+mtok[0]);
        }
    }

    // list of idents
    function fetch_ident_list(req, keep_dots) {
        var k, res = [];
        if (tok !== IDENT) {
            if (req)
                syntax_error("Expect ident list");
            return null;
        }
        while (tok === IDENT) {
            k = mtok[G_IDENT];
            if (k.charAt(0) === '[')
                k = k.substring(1, k.length - 1);
            res.push(k);
            next_tok();
            if (tok !== DOT && tok !== SLASH)
                return res;
            if (keep_dots)
                res.push(mtok[0]);
            next_tok();
        }
        syntax_error("Expect IDENT after . or /");
        return null;
    }

    // parse value, create node that returns const
    function parse_const(dstlist) {
        var val;
        if (tok === CONST) {
            var s = mtok[G_CONST];
            var q = s.charAt(0);
            if (q === '"' || q === "'") {
                val = s.substring(1, s.length-1).replace(/\\(.)/g, "$1");
            } else {
                val = parseFloat(s);
            }
            next_tok();
        } else if (eat(TRUE)) {
            val = true;
        } else if (eat(FALSE)) {
            val = false;
        } else {
            return false;
        }
        dstlist.push(make_const_node(val));
        return true;
    }

    // value-ref of at-ref, but not const/subexpr
    function parse_value_simple(dstlist, runFunc) {
        var isdata = false;
        var curlev = false;
        var uplev = 0;
        var node;
        var idlist;

        if (noFunctionValues)
            runFunc = false;

        if (eat(AT))
            isdata = true;

        if (eat(THIS)) {
            curlev = true;
            if (!eat(DOT))
                node = make_this_node(isdata, uplev);
        } else {
            while (eat(DOT)) {
                if (eat(DOT)) {
                    uplev++;
                    if (!eat(SLASH)) {
                        node = make_this_node(isdata, uplev);
                        break;
                    }
                } else if (eat(SLASH)) {
                    curlev = true;
                } else {
                    node = make_this_node(isdata, uplev);
                    break;
                }
            }
        }

        if (!node) {
            idlist = fetch_ident_list(curlev || uplev);
            if (!idlist)
                return false;
            node = make_value_node(idlist, isdata, uplev, runFunc);
        }

        dstlist.push(node);
        return true;
    }

    // allow consts and subexprs
    function parse_value_extended(dstlist) {
        if (parse_value_simple(dstlist, true)) {
            return true;
        } else if (parse_const(dstlist)) {
            return true;
        } else if (eat(OPEN)) {
            eat(SPACE);
            dstlist.push(parse_maybe_helper());
            musteat(CLOSE);
            return true;
        }
        return false;
    }

    // helper arg may be ref or hash value
    function parse_helper_arg(arglist, hashlist) {
        var idlist = fetch_ident_list();

        // detect hash arguments (k=v)
        if (idlist) {
            if (idlist.length === 1 && eat(EQ)) {
                var pair = [idlist[0]];
                if (!parse_value_extended(pair)) {
                    syntax_error("No value after '='");
                }
                hashlist.push(pair);
            } else {
                arglist.push(make_value_node(idlist, false, 0, true));
            }
            return true;
        }

        // continue normally
        return parse_value_extended(arglist);
    }

    // simple ref or helper
    function parse_maybe_helper(is_block_helper, cur_sect_func, inv_sect_func, skip_level) {
        var idlist;
        var args = [], hash = [], fnode, tmplist = [];
        var hfunc;
        var hname;
        var start_pos = tok_start_pos;

        // parse ident carefully to resolve registered helpers
        idlist = fetch_ident_list();
        if (idlist) {
            if (idlist.length === 1 && helpers[idlist[0]]) {
                hfunc = helpers[idlist[0]];
            } else {
                fnode = make_value_node(idlist, false, 0, false);
            }
        } else if (parse_value_simple(tmplist, false)) {
            fnode = tmplist[0];
        } else {
            syntax_error("failed to parse expression");
        }

        // use first ident as section name
        hname = tmpl.substring(start_pos, tok_start_pos);
        if (is_block_helper)
            sect_name = hname;

        // parse helper args if possible
        while (eat(SPACE) && parse_helper_arg(args, hash)) { /* loop */ }

        // now decide calling protocol
        if (is_block_helper) {
            if (knownHelpersOnly && !hfunc)
                syntax_error("Only known helpers are allowed, got: "+hname);

            return make_helper_node(hfunc, fnode, args, hash, cur_sect_func, inv_sect_func, helpers.blockHelperMissing, hname, skip_level);
        } else if (!hfunc && (args.length + hash.length) === 0) {
            // this is ugly, but we need to reverse runFunc flag
            tokrx.lastIndex = start_pos;
            next_tok();
            tmplist = [];
            if (!parse_value_simple(tmplist, true))
                syntax_error("Retry failed");
            return tmplist[0];
        } else {
            if (knownHelpersOnly && !hfunc)
                syntax_error("Only known helpers are allowed, got: "+hname);
            // helper in non-block context
            return make_helper_node(hfunc, fnode, args, hash, null, null, helpers.helperMissing, hname);
        }
    }

    var trim_before = false, trim_after = false;
    var sect_name;
    var block_stack = [];

    var frag_list = [];
    var inv_frag_list = [];
    var cur_frag_list = frag_list;
    var in_else = false;

    function push_stack(def_list, inv_list) {
        // put current state to stack
        block_stack.push({
            sname: sect_name,
            flist: frag_list,
            invlist: inv_frag_list,
            curlist: cur_frag_list,
            in_else: in_else
        });

        // set up new state
        frag_list = cur_frag_list = def_list;
        inv_frag_list = inv_list;
        in_else = false;
    }

    // load old state from stack
    function pop_stack(close_name) {
        var old = block_stack.pop();
        if (!old)
            throw new TemplateError("unbalanced section close");
        if (old.sname !== close_name)
            throw new TemplateError("close section expects matching ident: old='"+old.sname+"' new='"+close_name+"'");

        // restore old state
        frag_list = old.flist;
        inv_frag_list = old.invlist;
        cur_frag_list = old.curlist;
        in_else = old.in_else;
    }

    function install_node(node) {
        cur_frag_list.push(node);
    }

    // require proper close tag
    function parse_end_tag(extra) {
        // skip whitespace
        eat(SPACE);

        // parse last '~'
        if (eat(TILDE))
            trim_after = true;

        while (extra--)
            musteat(END);
        musteat(END);

        // must be at '}'
        if (tok !== END)
            syntax_error("expect '}}' got "+mtok[0]);
    }

    function swap_else_sect() {
        if (in_else)
            syntax_error("Multiple else blocks");
        cur_frag_list = inv_frag_list;
        in_else = true;
        parse_end_tag();
    }

    // return node
    function parse_expr_simple(extra)
    {
        var node = parse_maybe_helper();
        parse_end_tag(extra);
        return node;
    }

    // install optional plaintext frag with trimming
    function add_plain(dstlist, str)
    {
        if (trim_after)
            str = str.replace(/^\s+/, '');
        if (trim_before)
            str = str.replace(/\s+$/, '');
        if (str)
            dstlist.push(make_const_node(str));
    }

    function frag_plaintext(str) {
        add_plain(cur_frag_list, str);
    }

    function frag_unquoted(extra) {
        var node = parse_expr_simple(extra || 0);
        install_node(make_unquoted_node(node));
    }

    function frag_unquoted_triple() {
        frag_unquoted(1);
    }

    function frag_quoted() {
        var node;
        if (eat(ELSE)) {
            if (!in_else && eat(SPACE) && tok !== TILDE && tok !== END) {
                // 'else' + block helper
                cur_frag_list = inv_frag_list;
                frag_sect(false, true);
                // keep it on same level
                block_stack.pop();
            } else {
                // ordinary else
                swap_else_sect();
            }
        } else {
            node = make_quoted_node(parse_expr_simple(0));
            install_node(node);
        }
    }

    // key lookup, start section if exists
    function frag_sect(not_sect, skip_level) {
        var new_list = [];
        var inv_list = [];
        var tmp_list = [];
        var node;

        var cur_func = make_blocklist_node(new_list);
        var inv_func = make_blocklist_node(inv_list);

        if (not_sect) {
            if (tok === TILDE || tok === END) {
                swap_else_sect();
                return;
            } else {
                var start_pos = tok_start_pos;

                if (parse_value_simple(tmp_list)) {
                    if (tmp_list.length !== 1)
                        syntax_error("'^' block can have max 1 arg");
                    node = make_helper_node(null, make_not_node(tmp_list[0]),
                                            [], [], cur_func, inv_func,
                                            helpers.blockHelperMissing);
                } else {
                    syntax_error("^-sect requires simple value");
                }
                sect_name = tmpl.substring(start_pos, tok_start_pos);
            }
        } else {
            node = parse_maybe_helper(true, cur_func, inv_func, skip_level);
        }
        install_node(node);

        push_stack(new_list, inv_list);

        parse_end_tag();
    }

    // Either {{^}} or Mustache {{^ident}}
    function frag_not_sect() {
        frag_sect(true);
    }

    // {{{{ handler ... }}}} ... {{{{/handler}}}}
    function frag_raw() {
        var node, raw_list = [];
        var end_pos, m, raw;

        // parse & install node
        node = parse_maybe_helper(true, make_blocklist_node(raw_list), null);
        install_node(node);
        parse_end_tag(2);

        var xsect = sect_name.replace(/[\[\](){}\\.?*+|^$]/g, '\\$&');
        var rx = new RegExp("\\{\\{\\{\\{(~)?/\\s*" + xsect + "\\s*(~)?\\}\\}\\}\\}", 'g');
        var start_pos = rx.lastIndex = tokrx.lastIndex;
        m = rx.exec(tmpl);
        if (!m)
            syntax_error("raw end tag mismatch");
        end_pos = rx.lastIndex;

        raw = tmpl.substring(start_pos, end_pos - m[0].length);
        trim_before = m[1];
        add_plain(raw_list, raw);
        trim_after = m[2];

        tokrx.lastIndex = end_pos;
    }

    // close section
    function frag_sect_end() {
        var close_name;
        var start_pos;

        start_pos = tok_start_pos;
        fetch_ident_list();
        close_name = tmpl.substring(start_pos, tok_start_pos);
        parse_end_tag();

        pop_stack(close_name);
    }

    // partial template
    function frag_partial() {
        var partial_name, partial_func;
        var args = [], hash = [], node;

        partial_name = fetch_ident_list(true, true).join('');
        partial_func = partials[partial_name];
        if (!partial_func)
            syntax_error("Missing partial: "+partial_name);
        if (!isFunction(partial_func)) {
            partial_func = real_compiler(partial_func, helpers, partials, knownHelpersOnly, noFunctionValues);
            partials[partial_name] = partial_func;
        }

        // parse args if possible
        while (eat(SPACE) && parse_helper_arg(args, hash)) { /* loop */ }

        parse_end_tag();

        node = make_partial_node(partial_func, args, hash);
        install_node(node);
    }

    var block_handler_map = {
        '{': frag_unquoted_triple,
        '&': frag_unquoted,
        '^': frag_not_sect,
        '#': frag_sect,
        '/': frag_sect_end,
        '>': frag_partial,
        '': frag_quoted,
        "{{": frag_raw
    };

    // empty or null template
    if (!tmpl)
        return make_const_node('');

    // loop over template
    var pos, pos2, plaintext = '';
    var btype, block_handler;
    for (pos = 0; pos < tmpl.length; ) {

        // find start of next tag
        trim_before = false;
        mstart = startrx.exec(tmpl);
        if (mstart == null) {
            // no tags, keep it simple then
            if (!pos)
                return make_const_node(tmpl);

            // last plaintext fragment
            plaintext += tmpl.substring(pos);
            frag_plaintext(plaintext);
            break;
        }

        // extract text parts
        pos2 = startrx.lastIndex;
        plaintext += tmpl.substring(pos, pos2 - mstart[0].length);

        // if escape seq, include escaped char in next plaintext
        if (mstart[SG_ESCAPE]) {
            pos = pos2 - 1;
            continue;
        }

        // parse tag type
        trim_before = mstart[SG_TILDE1] || mstart[SG_TILDE2];
        btype = mstart[SG_BT1] || mstart[SG_BT2];
        block_handler = block_handler_map[btype];

        // now plaintext can be added
        frag_plaintext(plaintext);
        trim_after = false;
        plaintext = '';

        // process tag body
        if (btype.charAt(0) === "!") {
            // handle comments separately
            var cmt_end = btype === '!' ? "}}" : "--}}";
            pos2 = tmpl.indexOf(cmt_end, pos2);
            if (pos2 < 0)
                syntax_error("Unterminated comment block");
            pos = pos2 + cmt_end.length;
        } else {
            // setup expression parser
            tokrx.lastIndex = pos2;
            next_tok();
            eat(SPACE);

            // actual logic
            block_handler();

            pos = tokrx.lastIndex;
        }
        startrx.lastIndex = pos;
    }

    // check block nesting
    if (block_stack.length > 0)
        syntax_error("Block still open: "+block_stack.pop().sname);

    // final renderer
    return make_renderer(frag_list);
}

/*
 * Builtin helpers.
 */

// check if arg count is correct
function req_args(args, num) {
    var got = args.length - 1;
    if (got !== num)
        throw new TemplateError("Wrong number of arguments to '" + args[got].name + "': got " + got + " expect " + num);
}

// Container for logging methods.
var logging = {
    // Callback for {{#log}} helper.
    log: function(msg) { console.log(msg); }
};

var builtin_helpers = {
    // Block helper - just execute first block.
    "noop": function Noop (options) {
        req_args(arguments, 0);
        return options.fn(this);
    },

    // Block helper - use arg as context.
    "with": function With (arg, options) {
        req_args(arguments, 1);
        return isEmpty(arg) ? options.inverse(this) : options.fn(arg);
    },

    // Block helper - conditional exec.
    "if": function If (arg, options) {
        req_args(arguments, 1);
        return isEmpty(arg) ? options.inverse(this) : options.fn(this);
    },

    // Block helper - inverse conditional exec
    "unless": function Unless (arg, options) {
        req_args(arguments, 1);
        return isEmpty(arg) ? options.fn(this) : options.inverse(this);
    },

    // Block helper - loop over array or object attributes
    "each": function Each (arg, options) {
        var i = 0, len, res = '';
        var data, k;

        req_args(arguments, 1);

        if (!isEmpty(arg)) {
            data = options.data = createFrame(options.data);
            data.first = true;
            if (isArray(arg)) {
                len = arg.length;
                data.last = false;
                for (; i < len; i++) {
                    // set @-variables
                    if (i === 1)
                        data.first = false;
                    if (i === (len - 1))
                        data.last = true;
                    data.index = i;

                    // run section
                    res += options.fn(arg[i]);
                }
            } else {
                for (k in arg) {
                    if (hasOwnProperty.call(arg, k)) {
                        // set @-variables
                        if (i === 1)
                            data.first = false;
                        data.key = k;
                        data.index = i++;

                        // run section
                        res += options.fn(arg[k]);
                    }
                }
            }
        }

        return (i > 0) ? res : options.inverse(this);
    },

    // simple helper: dynamic attribute lookup
    "lookup": function Lookup (arg, key /*, options */) {
        req_args(arguments, 2);
        return arg ? arg[key] : null;
    },

    // simple helper: log stuff, no output
    "log": function Log (arg /* , options */) {
        req_args(arguments, 1);
        logging.log(arg);
        return '';
    },

    // called with unknown block helper, implements Mustache blocks
    "blockHelperMissing": function Mustache (arg, options) {
        req_args(arguments, 1);

        if (isEmpty(arg))
            return options.inverse(this);

        if (isArray(arg))
            return builtin_helpers.each.call(this, arg, options);

        // replace context but only if Object
        return options.fn(isObject(arg) ? arg : this);
    },

    // called with unknown simple helper, throws error
    "helperMissing": function MissingValue (/* [args], options */) {
        var opts = arguments[arguments.length - 1];
        throw new TemplateError("Missing helper: "+opts.name);
    }

};

// Container for helpers, partials and template cache.
function Environment()
{
    this.cache = {};
    this.options = {
        helpers: extend({}, builtin_helpers),
        partials: {},
        knownHelpersOnly: false,
        noFunctionValues: false
    };
}

// Methods.  For simplicity, include all exports here.
extend(Environment.prototype, {
    // Create completely new env, separate from root one.
    create: function() {
        return new Environment();
    },

    // Compile template and return render function.
    compile_nocache: function(tmpl, options) {
        var env_options = this.options;
        var helpers = env_options.helpers;
        var partials = env_options.partials;
        var knownHelpersOnly = env_options.knownHelpersOnly;
        var noFunctionValues = env_options.noFunctionValues;
        if (options) {
            if (options.helpers)
                helpers = extend({}, helpers, options.helpers);
            if (options.partials)
                partials = extend({}, partials, options.partials);
            if (options.knownHelpersOnly != null)
                knownHelpersOnly = options.knownHelpersOnly;
            if (options.noFunctionValues != null)
                noFunctionValues = options.noFunctionValues;
        }
        if (noFunctionValues)
            knownHelpersOnly = true;
        return real_compiler(tmpl, helpers, partials, knownHelpersOnly, noFunctionValues);
    },

    // Compile and cache template.
    compile: function(tmpl, options) {
        var cache = this.cache;
        if (!cache[tmpl])
            cache[tmpl] = this.compile_nocache(tmpl, options);
        return cache[tmpl];
    },

    // Compile, cache and render.
    render: function(tmpl, context, options) {
        return this.compile(tmpl, options)(context, options);
    },

    // Add helper.
    registerHelper: function(name, func) {
        var helpers = this.options.helpers;
        if (isObject(name)) {
            extend(helpers, name);
        } else {
            helpers[name] = func;
        }
    },

    // Remove helper.
    unregisterHelper: function (name) {
        delete this.options.helpers[name];
    },

    // Add template fragment.
    registerPartial: function (name, func) {
        var partials = this.options.partials;
        if (isObject(name)) {
            extend(partials, name);
        } else {
            if (!isFunction(func))
                func = this.compile_nocache(''+func);
            partials[name] = func;
        }
    },

    // Remove partial template.
    unregisterPartial: function (name) {
        delete this.options.partials[name];
    },

    // export utilities
    TemplateError: TemplateError,
    SafeString: SafeString,
    escapeExpression: escapeExpression,
    createFrame: createFrame,
    logging: logging,

    // Container for additional utility functions.
    Utils: {
        isObject: isObject,
        isArray: isArray,
        isFunction: isFunction,
        isEmpty: isEmpty,
        toString: toString,
        extend: extend,
        escapeExpression: escapeExpression
    }
});

// export root env
return new Environment();

}));

