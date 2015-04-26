(function (global, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        var mod = {
            exports: {}
        };
        factory(mod.exports);
        global.easyRouter = mod.exports;
    }
})(this, function (exports) {
    'use strict';

    var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

    var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

    Object.defineProperty(exports, '__esModule', {
        value: true
    });
    /**
     * Unobtrusive and ultra-lightweight router library 100% compatible with the Backbone.Router's style for declaring routes,
     * while providing the following advantages:
     * - Unobtrusive, it is designed from the beginning to be integrated with other libraries / frameworks (also vanilla).
     * - Great performance, only native functions are used.
     * - Small footprint, 5kb for minified version.
     * - No dependencies, no jQuery, no Underscore... zero dependencies.
     * - Supports both routes' styles, hash and the pushState of History API.
     * - Proper JSDoc used in the source code.
     * - Works with normal script include and as well in CommonJS style.
     * - Written in [ESNext](https://babeljs.io/) for the future and transpiled to ES5 with UMD format for right now.
     *
     * ¿Want to create a modern hibrid-app or a website using something like React, Web Components, Handlebars, vanilla JS, etc.?
     * ¿Have an existing Backbone project and want to migrate to a more modern framework?
     * Good news, EasyRouter will integrates perfectly with all of those!
     */

    /**
     * EasyRouter provides methods for routing client-side pages, and connecting them to actions.
     *
     * During page load, after your application has finished creating all of its routers,
     * be sure to call start() on the router instance to let know him you have already
     * finished the routing setup.
     */

    var root = typeof global === 'undefined' ? window : global;
    var document = root.document;

    // Cached regular expressions for matching named param parts and splatted
    // parts of route strings.
    var optionalParam = /\((.*?)\)/g;
    var namedParam = /(\(\?)?:\w+/g;
    var splatParam = /\*\w+/g;
    var escapeRegExp = /[\-{}\[\]+?.,\\\^$|#\s]/g;
    var trueHash = /#(.*)$/;
    var isRoot = /[^\/]$/;

    // Cached regex for stripping a leading hash/slash and trailing space.
    var routeStripper = /^[#\/]|\s+$/g;
    // Cached regex for stripping leading and trailing slashes.
    var rootStripper = /^\/+|\/+$/g;
    // Cached regex for removing a trailing slash.
    var trailingSlash = /\/$/;
    // Cached regex for stripping urls of hash.
    var pathStripper = /#.*$/;

    /**
     * Handles cross-browser history management, based on either
     * [pushState](http://diveintohtml5.info/history.html) and real URLs, or
     * [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
     * and URL fragments.
     * @constructor
     */

    var History = (function () {
        function History() {
            _classCallCheck(this, History);

            // Has the history handling already been started?
            this._started = false;
            this._checkUrl = this._checkUrl.bind(this);
            this._handlers = [];
            this._evtHandlers = {};
            this._location = root.location;
            this._history = root.history;
        }

        _createClass(History, [{
            key: 'atRoot',

            /**
             * Are we at the app root?
             * @returns {boolean} if we are in the root.
             */
            value: function atRoot() {
                return this._location.pathname.replace(isRoot, '$&/') === this._root;
            }
        }, {
            key: 'getHash',

            /**
             * Gets the true hash value. Cannot use location.hash directly due to bug
             * in Firefox where location.hash will always be decoded.
             * @returns {string} The hash.
             */
            value: function getHash() {
                var match = this._location.href.match(trueHash);
                return match ? match[1] : '';
            }
        }, {
            key: 'getFragment',

            /**
             * Get the cross-browser normalized URL fragment, either from the URL,
             * the hash, or the override.
             * @param {string} fragment The url fragment
             * @param {boolean} forcePushState flag to force the usage of pushSate
             * @returns {string} The fragment.
             */
            value: function getFragment(fragment, forcePushState) {
                var fragmentAux = fragment;
                if (fragmentAux === undefined || fragmentAux === null) {
                    if (this._hasPushState || !this._wantsHashChange || forcePushState) {
                        fragmentAux = root.decodeURI(this._location.pathname + this._location.search);
                        var rootUrl = this._root.replace(trailingSlash, '');
                        if (fragmentAux.lastIndexOf(rootUrl, 0) === 0) {
                            fragmentAux = fragmentAux.slice(rootUrl.length);
                        }
                    } else {
                        fragmentAux = this.getHash();
                    }
                } else {
                    fragmentAux = root.decodeURI(fragmentAux);
                }
                return fragmentAux.replace(routeStripper, '');
            }
        }, {
            key: 'start',

            /**
             * Start the route change handling, returning `true` if the current URL matches
             * an existing route, and `false` otherwise.
             * @param {Object} options Options
             * @returns {boolean} true if the current fragment matched some handler, false otherwise.
             */
            value: function start() {
                var options = arguments[0] === undefined ? {} : arguments[0];

                if (History._started) {
                    throw new Error('Router.history has already been started');
                }

                History._started = true;

                // Figure out the initial configuration. Is pushState desired ... is it available?
                this._opts = options;
                this._opts.root = this._opts.root || '/';
                this._root = this._opts.root;
                this._wantsHashChange = this._opts.hashChange !== false;
                this._wantsPushState = !!this._opts.pushState;
                this._hasPushState = !!(this._opts.pushState && this._history && this._history.pushState);
                var fragment = this.getFragment();

                // Normalize root to always include a leading and trailing slash.
                this._root = ('/' + this._root + '/').replace(rootStripper, '/');

                // Depending on whether we're using pushState or hashes, and whether
                // 'onhashchange' is supported, determine how we check the URL state.
                if (this._hasPushState) {
                    root.addEventListener('popstate', this._checkUrl);
                } else if (this._wantsHashChange && 'onhashchange' in root) {
                    root.addEventListener('hashchange', this._checkUrl);
                }

                // Determine if we need to change the base url, for a pushState link
                // opened by a non-pushState browser.
                this._fragment = fragment;

                // Transition from hashChange to pushState or vice versa if both are
                // requested.
                if (this._wantsHashChange && this._wantsPushState) {

                    // If we've started off with a route from a `pushState`-enabled
                    // browser, but we're currently in a browser that doesn't support it...
                    if (!this._hasPushState && !this.atRoot()) {
                        this._fragment = this.getFragment(null, true);
                        this._location.replace(this._root + '#' + this._fragment);
                        // Return immediately as browser will do redirect to new url
                        return true;
                        // Or if we've started out with a hash-based route, but we're currently
                        // in a browser where it could be `pushState`-based instead...
                    } else if (this._hasPushState && this.atRoot() && this._location.hash) {
                        this._fragment = this.getHash().replace(routeStripper, '');
                        this._history.replaceState({}, document.title, this._root + this._fragment);
                    }
                }

                return this._loadUrl();
            }
        }, {
            key: 'stop',

            /**
             * Disable Router.history, perhaps temporarily. Not useful in a real app,
             * but possibly useful for unit testing Routers.
             */
            value: function stop() {
                root.removeEventListener('popstate', this._checkUrl);
                root.removeEventListener('hashchange', this._checkUrl);
                History._started = false;
            }
        }, {
            key: '_addHandler',

            /**
             * Add a route to be tested when the fragment changes. Routes added later
             * may override previous routes.
             * @param {string} routeExp The route.
             * @param {Function} callback Method to be executed.
             * @private
             */
            value: function _addHandler(routeExp, callback) {
                this._handlers.unshift({ route: routeExp, callback: callback });
            }
        }, {
            key: '_checkUrl',

            /**
             * Checks the current URL to see if it has changed, and if it has,
             * calls `loadUrl`.
             * @returns {boolean} true if navigated, false otherwise.
             * @private
             */
            value: function _checkUrl() {
                var fragment = this.getFragment();
                if (fragment === this._fragment) {
                    return false;
                }
                this._loadUrl();
            }
        }, {
            key: '_loadUrl',

            /**
             * Attempt to load the current URL fragment. If a route succeeds with a
             * match, returns `true`. If no defined routes matches the fragment,
             * returns `false`.
             * @param {string} fragment E.g.: 'user/pepito'
             * @param {Object} message E.g.: {msg: 'Password changed', type: 'success'}
             * @returns {boolean} true if the fragment matched some handler, false otherwise.
             * @private
             */
            value: function _loadUrl(fragment, message) {
                this._fragment = this.getFragment(fragment);
                var n = this._handlers.length;
                var handler = undefined;
                for (var i = 0; i < n; i++) {
                    handler = this._handlers[i];
                    if (handler.route.test(this._fragment)) {
                        handler.callback(this._fragment, message);
                        return true;
                    }
                }
                return false;
            }
        }, {
            key: 'navigate',

            /**
             * Save a fragment into the hash history, or replace the URL state if the
             * 'replace' option is passed. You are responsible for properly URL-encoding
             * the fragment in advance.
             *
             * The options object can contain `trigger: true` if you wish to have the
             * route callback be fired (not usually desirable), or `replace: true`, if
             * you wish to modify the current URL without adding an entry to the history.
             * @param {string} fragment Fragment to navigate to
             * @param {Object=} message Options object.
             * @param {Object=} options Options object.
             * @returns {boolean} true if the fragment matched some handler, false otherwise.
             */
            value: function navigate(fragment, message) {
                var options = arguments[2] === undefined ? {} : arguments[2];

                if (!History._started) {
                    return false;
                }

                var fragmentAux = this.getFragment(fragment || '');

                var url = this._root + fragmentAux;

                // Strip the hash for matching.
                fragmentAux = fragmentAux.replace(pathStripper, '');

                if (this._fragment === fragmentAux) {
                    return false;
                }

                this._fragment = fragmentAux;

                // Don't include a trailing slash on the root.
                if (fragmentAux === '' && url !== '/') {
                    url = url.slice(0, -1);
                }

                // If pushState is available, we use it to set the fragment as a real URL.
                if (this._hasPushState) {
                    this._history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);
                    // If hash changes haven't been explicitly disabled, update the hash
                    // fragment to store history.
                } else if (this._wantsHashChange) {
                    this._updateHash(fragmentAux, options.replace);
                    // If you've told us that you explicitly don't want fallback hashchange-
                    // based history, then `navigate` becomes a page refresh.
                } else {
                    return this._location.assign(url);
                }

                if (options.trigger !== false) {
                    return this._loadUrl(fragmentAux, message);
                }

                return false;
            }
        }, {
            key: 'on',

            /**
             * Add event listener.
             * @param {string} evt Name of the event.
             * @param {Function} callback Method.
             * @returns {History} this history
             */
            value: function on(evt, callback) {
                if (this._evtHandlers[evt] === undefined) {
                    this._evtHandlers[evt] = [];
                }
                this._evtHandlers[evt].push(callback);
                return this;
            }
        }, {
            key: 'off',

            /**
             * Remove event listener.
             * @param {string} evt Name of the event.
             * @param {Function} callback Method.
             * @returns {History} this history
             */
            value: function off(evt, callback) {
                if (this._evtHandlers[evt]) {
                    var callbacks = this._evtHandlers[evt];
                    var n = callbacks.length;
                    for (var i = 0; i < n; i++) {
                        if (callbacks[i] === callback) {
                            callbacks.splice(i, 1);
                            if (callbacks.length === 0) {
                                delete this._evtHandlers[evt];
                            }
                            break;
                        }
                    }
                }
                return this;
            }
        }, {
            key: '_trigger',

            /**
             * Events triggering.
             * @param {string} evt Name of the event being triggered.
             * @private
             */
            value: function _trigger(evt) {
                var callbacks = this._evtHandlers[evt];
                if (callbacks === undefined) {
                    return;
                }
                var args = Array.prototype.slice.call(arguments, 1);
                var i = 0;
                var callbacksLength = callbacks.length;
                for (; i < callbacksLength; i++) {
                    callbacks[i].apply(this, args);
                }
            }
        }, {
            key: '_updateHash',

            /**
             * Update the hash location, either replacing the current entry, or adding
             * a new one to the browser history.
             * @param {string} fragment URL fragment
             * @param {boolean} replace flag
             * @private
             */
            value: function _updateHash(fragment, replace) {
                if (replace) {
                    var href = this._location.href.replace(/(javascript:|#).*$/, '');
                    this._location.replace(href + '#' + fragment);
                } else {
                    // Some browsers require that `hash` contains a leading #.
                    this._location.hash = '#' + fragment;
                }
            }
        }]);

        return History;
    })();

    var Router = (function () {

        /**
         * Constructor for the router.
         * Routers map faux-URLs to actions, and fire events when routes are
         * matched. Creating a new one sets its `routes` hash, if not set statically.
         * @param {Object} options options.root is a string indicating the site's context, defaults to '/'.
         * @constructor
         */

        function Router() {
            var options = arguments[0] === undefined ? {} : arguments[0];

            _classCallCheck(this, Router);

            this._evtHandlers = {};
            this._opts = options;
            this._bindHandlers();
        }

        _createClass(Router, [{
            key: 'addHandler',

            /**
             * Manually bind a single named route to a callback.
             * The route argument may be a routing string or regular expression, each matching capture
             * from the route or regular expression will be passed as an argument to the onCallback.
             * @param {Object} handler The handler entry.
             * @returns {Router} this router
             */
            value: function addHandler(handler) {

                var routeAux = Router._routeToRegExp(handler.route);
                var self = this;

                Router.history._addHandler(routeAux, function (fragment, message) {

                    var params = Router._extractParameters(routeAux, fragment);

                    var paramsAux = params.slice(0);

                    var evtRoute = {};
                    evtRoute['new'] = { fragment: fragment, params: paramsAux, message: message };

                    if (self._old) {
                        evtRoute.old = { fragment: self._old.fragment, params: self._old.params };
                    }

                    self._trigger('route:before', evtRoute);
                    Router.history._trigger('route:before', self, evtRoute);

                    if (evtRoute.canceled) {
                        return;
                    }

                    params.push(evtRoute);

                    if (self._old && self._old.handler.off) {
                        self._old.handler.off.apply(self._old.handler);
                    }

                    handler.on.apply(handler, params);

                    self._trigger('route:after', evtRoute);
                    Router.history._trigger('route:after', self, evtRoute);

                    self._old = { fragment: fragment, params: paramsAux, handler: handler };
                });

                return this;
            }
        }, {
            key: 'navigate',

            /**
             * Simple proxy to `Router.history` to save a fragment into the history.
             * @param {string} fragment Route to navigate to.
             * @param {Object=} message parameters
             * @param {Object=} options parameters
             * @returns {Router} this router
             */
            value: function navigate(fragment, message, options) {
                Router.history.navigate(fragment, message, options);
                return this;
            }
        }, {
            key: '_bindHandlers',

            /**
             * Bind all defined routes to `Router.history`. We have to reverse the
             * order of the routes here to support behavior where the most general
             * routes can be defined at the bottom of the route map.
             * @private
             */
            value: function _bindHandlers() {
                if (!this._opts.map) {
                    return;
                }
                var routes = this._opts.map;
                var routesN = routes.length - 1;
                for (var i = routesN; i >= 0; i--) {
                    this.addHandler(routes[i]);
                }
            }
        }], [{
            key: '_routeToRegExp',

            /**
             * Convert a route string into a regular expression, suitable for matching
             * against the current location fragment.
             * @param {string} route The route
             * @returns {RegExp} the obtained regex
             * @private
             */
            value: function _routeToRegExp(route) {
                var routeAux = route.replace(escapeRegExp, '\\$&').replace(optionalParam, '(?:$1)?').replace(namedParam, function (match, optional) {
                    return optional ? match : '([^/?]+)';
                }).replace(splatParam, '([^?]*?)');
                return new RegExp('^' + routeAux + '(?:\\?([\\s\\S]*))?$');
            }
        }, {
            key: '_extractParameters',

            /**
             * Given a route, and a URL fragment that it matches, return the array of
             * extracted decoded parameters. Empty or unmatched parameters will be
             * treated as `null` to normalize cross-browser behavior.
             * @param {RegExp} route The alias
             * @param {string} fragment The url part
             * @returns {Array} the extracted parameters
             * @private
             */
            value: function _extractParameters(route, fragment) {
                var params = route.exec(fragment).slice(1);
                return params.map(function (param, i) {
                    // Don't decode the search params.
                    if (i === params.length - 1) {
                        return param;
                    }
                    return param === undefined ? undefined : decodeURIComponent(param);
                });
            }
        }]);

        return Router;
    })();

    /**
     * Copy event bus listeners.
     */
    Router.prototype._trigger = History.prototype._trigger;
    Router.prototype.on = History.prototype.on;
    Router.prototype.off = History.prototype.off;

    /**
     * Create the default Router.History.
     * @type {History}
     */
    Router.history = new History();

    exports.History = History;
    exports.Router = Router;
});
//# sourceMappingURL=easy-router.js.map