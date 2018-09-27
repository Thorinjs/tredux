'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.createReducer = createReducer;
var deepAssign = require('deep-assign');

function createReducer(name, initialState, PERSISTERS) {
  if ((typeof initialState === 'undefined' ? 'undefined' : _typeof(initialState)) !== 'object' || !initialState) initialState = {};
  var handlers = {};
  var ctx = {
    name: name,
    _persist: false
  };
  ctx.getInitialState = function () {
    return initialState;
  };
  ctx.setInitialState = function (v, merge) {
    if (merge === true) {
      v = Object.assign({}, initialState, v || {});
    }
    initialState = v;
  };

  ctx.hasListenerStatus = function HasPendingPromiseListener(actionType, status) {
    if (typeof handlers[actionType] === 'undefined') return false;
    for (var i = 0; i < handlers[actionType].length; i++) {
      if (handlers[actionType][i].status === status) return true;
    }
    return false;
  };

  /* Register a new reducer handle. */
  ctx.handle = function HandleAction(code, fn, _handlePromiseStatus) {
    if (typeof code === 'undefined') {
      console.warn('Context ' + name + ' encountered invalid code');
      return ctx;
    }
    if (typeof handlers[code] === 'undefined') handlers[code] = [];
    var handleItem = {};
    if (typeof fn === 'function') {
      handleItem.fn = fn;
    } else if ((typeof fn === 'undefined' ? 'undefined' : _typeof(fn)) === 'object' && fn != null) {
      handleItem.fn = function onStaticChange() {
        return fn;
      };
    }
    if (typeof _handlePromiseStatus === 'undefined') _handlePromiseStatus = 'success';
    handleItem.status = _handlePromiseStatus;
    handlers[code].push(handleItem);
    return ctx;
  };

  ctx.persist = function (key) {
    if (typeof key === 'string' && key) {
      ctx._persist = key;
    } else {
      ctx._persist = false;
    }
    return ctx;
  };

  /* Prepares the wrapper function */
  ctx.prepare = function ReducerWrapper() {
    if (ctx._persist !== false) {
      for (var i = 0; i < PERSISTERS.length; i++) {
        try {
          PERSISTERS[i](ctx._persist, initialState);
        } catch (e) {
          console.log('tredux.persist() failed to save reducer state');
          console.log(e);
        }
      }
    }
    return function Reduce() {
      var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : initialState;
      var action = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      if (typeof handlers[action.type] === 'undefined') return state;
      var handlerPayload = _typeof(action.payload) === 'object' ? action.payload : action;
      var handlerFns = handlers[action.type];
      var actionStatus = typeof action.status === 'string' ? action.status : 'success',
          finalState = deepAssign({}, state);
      for (var _i = 0; _i < handlerFns.length; _i++) {
        var item = handlerFns[_i];
        if (item.status !== actionStatus) continue;
        var res = item.fn(finalState, handlerPayload || {}, action.request || {});
        if (typeof res !== 'undefined' && (typeof res === 'undefined' ? 'undefined' : _typeof(res)) === 'object' && res) {
          finalState = deepAssign({}, finalState, res);
        }
      }
      if (ctx._persist !== false) {
        for (var _i2 = 0; _i2 < PERSISTERS.length; _i2++) {
          try {
            PERSISTERS[_i2](ctx._persist, finalState);
          } catch (e) {
            console.log('tredux.persist() failed to save reducer state');
            console.log(e);
          }
        }
      }
      return finalState;
    };
  };
  return ctx;
}