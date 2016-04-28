'use strict';

export function createReducer(name, initialState) {
  if(typeof initialState !== 'object' || !initialState) initialState = {};
  const handlers = {};
  const ctx = {
    name: name
  };
  ctx.getInitialState = () => initialState;
  ctx.setInitialState = (v) => initialState = v;

  /* Register a new reducer handle. */
  ctx.handle = function HandleAction(code, fn, _handlePromiseStatus) {
    if(typeof code === 'undefined') {
      console.warn(`Context encountered invalid code: ${code}`);
      return ctx;
    }
    if(typeof handlers[code] === 'undefined') handlers[code] = [];
    let handleItem = {};
    if(typeof fn === 'function') {
      handleItem.fn = fn;
    } else if(typeof fn === 'object' && fn != null) {
      handleItem.fn = function onStaticChange() {
        return fn;
      }
    }
    if(typeof _handlePromiseStatus === 'undefined') _handlePromiseStatus = 'success';
    handleItem.status = _handlePromiseStatus;
    handlers[code].push(handleItem);
    return ctx;
  };

  /* Prepares the wrapper function */
  ctx.prepare = function ReducerWrapper() {

    return function Reduce(state = initialState, action = null) {
      if(typeof handlers[action.type] === 'undefined') return state;
      const handlerPayload = (typeof action.payload === 'object' ? action.payload : action);
      var res,
        handlerFns = handlers[action.type];
      let actionStatus = (typeof action.status === 'string' ? action.status : 'success'),
        finalState = Object.assign({}, state, res),
        hasChanges = false;
      for(let i=0; i < handlerFns.length; i++) {
        let item = handlerFns[i];
        if(item.status !== actionStatus) continue;
        let res = item.fn(state, handlerPayload || {}, action.original || {});
        if(typeof res === 'object' && res) {
          hasChanges = true;
          finalState = Object.assign({}, finalState, res);
        }
      }
      if(!hasChanges) return state;
      return finalState;
    }
  };
  return ctx;
}