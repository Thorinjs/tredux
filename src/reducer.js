'use strict';
const deepAssign = require('deep-assign');


export function createReducer(name, initialState, PERSISTERS) {
  if (typeof initialState !== 'object' || !initialState) initialState = {};
  const handlers = {};
  const ctx = {
    name: name,
    _persist: false
  };
  ctx.getInitialState = () => initialState;
  ctx.setInitialState = (v, merge) => {
    if (merge === true) {
      v = Object.assign({}, initialState, v || {});
    }
    initialState = v;
  };

  ctx.hasListenerStatus = function HasPendingPromiseListener(actionType, status) {
    if (typeof handlers[actionType] === 'undefined') return false;
    for (let i = 0; i < handlers[actionType].length; i++) {
      if (handlers[actionType][i].status === status) return true;
    }
    return false;
  }

  /* Register a new reducer handle. */
  ctx.handle = function HandleAction(code, fn, _handlePromiseStatus) {
    if (typeof code === 'undefined') {
      console.warn(`Context ${name} encountered invalid code`);
      return ctx;
    }
    if (typeof handlers[code] === 'undefined') handlers[code] = [];
    let handleItem = {};
    if (typeof fn === 'function') {
      handleItem.fn = fn;
    } else if (typeof fn === 'object' && fn != null) {
      handleItem.fn = function onStaticChange() {
        return fn;
      }
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
    if(ctx._persist !== false) {
      for(let i=0; i < PERSISTERS.length; i++) {
        try {
          PERSISTERS[i](ctx._persist, initialState);
        } catch(e) {
          console.log(`tredux.persist() failed to save reducer state`);
          console.log(e);
        }
      }
    }
    return function Reduce(state = initialState, action = null) {
      if (typeof handlers[action.type] === 'undefined') return state;
      const handlerPayload = (typeof action.payload === 'object' ? action.payload : action);
      var handlerFns = handlers[action.type];
      let actionStatus = (typeof action.status === 'string' ? action.status : 'success'),
        finalState = deepAssign({}, state);
      for (let i = 0; i < handlerFns.length; i++) {
        let item = handlerFns[i];
        if (item.status !== actionStatus) continue;
        let res = item.fn(finalState, handlerPayload || {}, action.request || {});
        if (typeof res !== 'undefined' && typeof res === 'object' && res) {
          finalState = deepAssign({}, finalState, res);
        }
      }
      if (ctx._persist !== false) {
        for (let i = 0; i < PERSISTERS.length; i++) {
          try {
            PERSISTERS[i](ctx._persist, finalState);
          } catch (e) {
            console.log(`tredux.persist() failed to save reducer state`);
            console.log(e);
          }
        }
      }
      return finalState;
    }
  };
  return ctx;
}