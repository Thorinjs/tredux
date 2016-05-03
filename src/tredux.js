'use strict';
const redux = require('redux'),
  reactRedux = require('react-redux'),
  { createStore, applyMiddleware, combineReducers } = redux,
  createLogger = require('redux-logger'),
  { createReducer } = require('./reducer'),
  thunk = require('redux-thunk').default;

const LOADED_REDUCERS = {},
  LISTENERS = {},
  PROXY_SUBSCRIPTIONS = [],
  PENDING_DISPATCHERS = [];

let storeObj = null;
export const actions = {};  // all the loaded actions.
/*
 * Proxy mount function that will add the <Provider> tag.
 * */
export function mount(rootComponent) {
  if (!storeObj) {
    init();
  }
  const Provider = reactRedux.Provider;
  return (
    <Provider store={storeObj}>
      {rootComponent}
    </Provider>
  )
}

/*
 * Proxy connect() to connect a given instance.
 * */
export function connect() {
  let args = Array.prototype.slice.call(arguments),
    Component = args.pop();
  let connectedFn = reactRedux.connect.apply(reactRedux, args);
  return connectedFn(Component);

}

/*
 * Registers a new reducer in the store.
 * */
export function reducer(name, initialState) {
  let ctx = createReducer(name, initialState);
  LOADED_REDUCERS[name] = ctx;
  return ctx;
}

/* Checks if any loaded reducer is waiting for a pending promise */
function hasReducerAction(actionType, status) {
  let names = Object.keys(LOADED_REDUCERS);
  for(let i=0; i < names.length; i++) {
    let reducerObj = LOADED_REDUCERS[names[i]];
    if(reducerObj.hasListenerStatus(actionType, status)) {
      return true;
    }
  }
  return false;
}


/* Boot up the tredux wrapper */
export function init() {
  const middleware = [thunk];
  if (NODE_ENV !== 'production') {
    middleware.push(createLogger());
  }
  middleware.push(proxyListener);
  const appReducers = combineReducers(prepareReducers());
  storeObj = createStore(appReducers, applyMiddleware.apply(redux, middleware));
  for(let i=0; i < PENDING_DISPATCHERS.length; i++) {
    dispatch.apply(this, PENDING_DISPATCHERS[i]);
  }
  return storeObj;
}

/*
 * Returns the inital state of the app
 * */
export function getInitialState() {
  const iState = {};
  Object.keys(LOADED_REDUCERS).forEach((rName) => {
    iState[rName] = LOADED_REDUCERS[rName].getInitialState();
  });
  return iState;
}

/* Dispatch proxy */
export function dispatch(actionType, payload) {
  if (!storeObj) {
    PENDING_DISPATCHERS.push(arguments);
    return;
  }
  // dispatch({type:, payload})
  if (typeof actionType === 'object' && actionType) {
    if (actionType.promise && typeof actionType.promise.then === 'function' && typeof actionType.promise.catch === 'function') {
      return dispatchPromise(actionType);
    }
    return storeObj.dispatch(actionType);
  }
  // dispatch('myType', {payload})
  if (typeof payload !== 'object' || !payload) payload = {};
  const dispatchData = {
    type: actionType,
    payload: payload
  };
  // check if we have a promise payload
  if (typeof payload.promise === 'object' && typeof payload.promise.catch === 'function') {
    return dispatchPromise(actionType, payload);
  }
  return storeObj.dispatch(dispatchData);
}

/* Dispatches a promise. It does so by dispatching 3 events on it. */
function dispatchPromise(action) {
  let isDone = false,
    promiseObj = action.promise;
  delete action.promise;
  let wrappedPayload = {
    type: action.type,
    status: 'pending'
  };
  let requestPayload;
  if (typeof action.payload === 'object' && action.payload) {
    requestPayload = Object.assign({}, action.payload);
  }
  if(hasReducerAction(wrappedPayload.type, 'pending')) {
    storeObj.dispatch(wrappedPayload);
  }
  if (requestPayload)wrappedPayload.request = requestPayload;
  promiseObj.then((res) => {
    if (isDone) return;
    isDone = true;
    wrappedPayload.status = 'success';
    wrappedPayload.payload = res;
    storeObj.dispatch(wrappedPayload);
  }, (err) => {
    if (isDone) return;
    isDone = true;
    wrappedPayload.status = 'error';
    wrappedPayload.payload = err;
    storeObj.dispatch(wrappedPayload);
  }).catch((e) => {
    if (isDone) return;
    isDone = true;
    wrappedPayload.status = 'error';
    wrappedPayload.payload = e;
    storeObj.dispatch(wrappedPayload);
  });
}

/* Proxy getState */
export function getState() {
  if (!storeObj) {
    console.warn('tredux: getState() is not yet available.');
    return null;
  }
  return storeObj.getState.apply(storeObj, arguments);
}

/* Proxy replaceReducer */
export function replaceReducer() {
  if (!storeObj) {
    console.warn('tredux: replaceReducer() is not yet available.');
    return;
  }
  return storeObj.replaceReducer.apply(storeObj, arguments);
}

/* proxy subscribe */
export function subscribe(fn) {
  if (storeObj) return storeObj.subscribe.apply(storeObj, arguments);
  PROXY_SUBSCRIPTIONS.push(fn);
  return this;
}

/* Exposes the given actions. */
export function addActions(reducerName, actionsMap) {
  if (typeof reducerName !== 'string') {
    console.warn('tredux.addAction: action must be a string.');
    return;
  }
  if (typeof actions[reducerName] === 'undefined') actions[reducerName] = {};
  Object.keys(actionsMap).forEach((actionName) => {
    if (typeof actionsMap[actionName] === 'function') {
      actions[reducerName][actionName] = actionsMap[actionName];
    }
  });
}

/*
 * Adds a listener to the event system.
 * It can either be called as:
 * - addListener(eventName, eventFunction)
 *   or
 * - addListener([
 *   eventName, eventFunction,
 *   eventName, eventFunction
 * ])
 * */
export function addListener(types, fn) {
  let events = {};  // this is our {actionType:fn} object.
  if (typeof types === 'string' && typeof fn === 'function') {
    events[types] = fn;
  } else if (types instanceof Array) {
    for (var i = 0; i < types.length - 1; i += 2) {
      let eventName = types[i],
        eventFn = types[i + 1];
      events[eventName] = eventFn;
    }
  }
  Object.keys(events).forEach((eName) => {
    let eFn = events[eName];
    if (typeof eName !== 'string') {
      console.warn("Received invalid event name in addListener:");
      console.warn(eFn);
      return;
    }
    if (typeof LISTENERS[eName] === 'undefined') LISTENERS[eName] = [];
    LISTENERS[eName].push(eFn);
  });
  let isUnsubscribed = false;
  return {
    remove: () => {
      if (isUnsubscribed) return;
      isUnsubscribed = true;
      setImmediate(() => {
        Object.keys(events).forEach((eName) => {
          let eFn = events[eName];
          if (typeof LISTENERS[eName] === 'undefined') return;
          for (let i = 0; i < LISTENERS[eName].length; i++) {
            if (LISTENERS[eName][i] !== eFn) continue;
            LISTENERS[eName].splice(i, 1);
            if (LISTENERS[eName].length === 0) {
              delete LISTENERS[eName];
            }
            return;
          }
        });
        events = null;
      });
    }
  }
}


/* This will "emit" an event / payload to any listeners. */
export function emit(eventName, payload) {
  if (typeof LISTENERS[eventName] === 'undefined') return;
  for (let i = 0; i < LISTENERS[eventName].length; i++) {
    LISTENERS[eventName][i](payload);
  }
}

/* Returns an object of all the prepared reducers. */
function prepareReducers() {
  const reducers = {};
  Object.keys(LOADED_REDUCERS).forEach((rName) => {
    reducers[rName] = LOADED_REDUCERS[rName].prepare();
  });
  return reducers;
}

function proxyListener(a) {
  return (next) => (action) => {
    let actionType = action.type;
    next(action);
    emit(actionType, action.payload);
  }
}
