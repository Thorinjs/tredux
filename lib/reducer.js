'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.createReducer = createReducer;
var deepAssign = require('deep-assign');

function createReducer(name, initialState) {
  if ((typeof initialState === 'undefined' ? 'undefined' : _typeof(initialState)) !== 'object' || !initialState) initialState = {};
  var handlers = {};
  var ctx = {
    name: name
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

  /* Prepares the wrapper function */
  ctx.prepare = function ReducerWrapper() {

    return function Reduce() {
      var state = arguments.length <= 0 || arguments[0] === undefined ? initialState : arguments[0];
      var action = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      if (typeof handlers[action.type] === 'undefined') return state;
      var handlerPayload = _typeof(action.payload) === 'object' ? action.payload : action;
      var handlerFns = handlers[action.type];
      var actionStatus = typeof action.status === 'string' ? action.status : 'success',
          finalState = deepAssign({}, state);
      for (var i = 0; i < handlerFns.length; i++) {
        var item = handlerFns[i];
        if (item.status !== actionStatus) continue;
        var res = item.fn(finalState, handlerPayload || {}, action.request || {});
        if (typeof res !== 'undefined' && (typeof res === 'undefined' ? 'undefined' : _typeof(res)) === 'object' && res) {
          finalState = deepAssign({}, finalState, res);
        }
      }
      return finalState;
    };
  };
  return ctx;
}