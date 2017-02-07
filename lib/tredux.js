'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.isReady = isReady;
exports.actions = actions;
exports.assign = assign;
exports.mount = mount;
exports.connect = connect;
exports.reducer = reducer;
exports.init = init;
exports.getInitialState = getInitialState;
exports.dispatch = dispatch;
exports.getState = getState;
exports.replaceReducer = replaceReducer;
exports.subscribe = subscribe;
exports.addActions = addActions;
exports.addListener = addListener;
exports.emit = emit;
var redux = require('redux');
var deepAssign = require('deep-assign');
var reactRedux = require('react-redux');
var createStore = redux.createStore;
var applyMiddleware = redux.applyMiddleware;
var combineReducers = redux.combineReducers;
var createLogger = require('redux-logger');

var _require = require('./reducer');

var createReducer = _require.createReducer;
var thunk = require('redux-thunk').default;

var LOADED_REDUCERS = {},
    LISTENERS = {},
    PROXY_SUBSCRIPTIONS = [],
    PENDING_DISPATCHERS = [];

var storeObj = null;
function isReady() {
  return storeObj != null;
}
function actions(name) {
  // all the loaded actions.
  return actions[name];
}
function assign() {
  return deepAssign.apply(this, arguments);
}
/*
 * Proxy mount function that will add the <Provider> tag.
 * */
function mount(rootComponent) {
  if (!storeObj) {
    init();
  }
  var Provider = reactRedux.Provider;
  return React.createElement(
    Provider,
    { store: storeObj },
    rootComponent
  );
}

/*
 * Proxy connect() to connect a given instance.
 * */
function connect() {
  var args = Array.prototype.slice.call(arguments),
      Component = args.pop();
  var connectedFn = reactRedux.connect.apply(reactRedux, args);
  return connectedFn(Component);
}

/*
 * Registers a new reducer in the store.
 * */
function reducer(name, initialState) {
  if (typeof LOADED_REDUCERS[name] !== 'undefined') {
    return LOADED_REDUCERS[name];
  }
  var ctx = createReducer(name, initialState);
  LOADED_REDUCERS[name] = ctx;
  return ctx;
}

/* Checks if any loaded reducer is waiting for a pending promise */
function hasReducerAction(actionType, status) {
  var names = Object.keys(LOADED_REDUCERS);
  for (var i = 0; i < names.length; i++) {
    var reducerObj = LOADED_REDUCERS[names[i]];
    if (reducerObj.hasListenerStatus(actionType, status)) {
      return true;
    }
  }
  return false;
}

/* Boot up the tredux wrapper */
function init() {
  var middleware = [thunk];
  if (NODE_ENV !== 'production') {
    middleware.push(createLogger());
  }
  middleware.push(proxyListener);
  var appReducers = combineReducers(prepareReducers());
  storeObj = createStore(appReducers, applyMiddleware.apply(redux, middleware));
  for (var i = 0; i < PENDING_DISPATCHERS.length; i++) {
    dispatch.apply(this, PENDING_DISPATCHERS[i]);
  }
  return storeObj;
}

/*
 * Returns the inital state of the app
 * */
function getInitialState() {
  var iState = {};
  Object.keys(LOADED_REDUCERS).forEach(function (rName) {
    iState[rName] = LOADED_REDUCERS[rName].getInitialState();
  });
  return iState;
}

/* Dispatch proxy */
function dispatch(actionType, payload) {
  if (!storeObj) {
    PENDING_DISPATCHERS.push(arguments);
    return;
  }

  // dispatch({type:, payload})
  if ((typeof actionType === 'undefined' ? 'undefined' : _typeof(actionType)) === 'object' && actionType) {
    if (actionType.promise && typeof actionType.promise.then === 'function' && typeof actionType.promise.catch === 'function') {
      return dispatchPromise(actionType);
    }
    return storeObj.dispatch(actionType);
  }
  // dispatch('myType', {payload})
  if ((typeof payload === 'undefined' ? 'undefined' : _typeof(payload)) !== 'object' || !payload) payload = {};
  var dispatchData = {
    type: actionType,
    payload: payload
  };
  // check if we have a promise payload
  if (_typeof(payload.promise) === 'object' && typeof payload.promise.catch === 'function') {
    return dispatchPromise(actionType, payload);
  }
  return storeObj.dispatch(dispatchData);
}

/* Dispatches a promise. It does so by dispatching 3 events on it. */
function dispatchPromise(action) {
  var isDone = false,
      promiseObj = action.promise;
  delete action.promise;
  var wrappedPayload = {
    type: action.type,
    status: 'pending'
  };
  var requestPayload = void 0;
  if (_typeof(action.payload) === 'object' && action.payload) {
    requestPayload = deepAssign({}, action.payload);
  }
  if (hasReducerAction(wrappedPayload.type, 'pending')) {
    storeObj.dispatch(wrappedPayload);
  }
  if (requestPayload) wrappedPayload.request = requestPayload;
  promiseObj.then(function (res) {
    if (isDone) return;
    isDone = true;
    wrappedPayload.status = 'success';
    wrappedPayload.payload = res;
    storeObj.dispatch(wrappedPayload);
  }, function (err) {
    if (isDone) return;
    isDone = true;
    wrappedPayload.status = 'error';
    wrappedPayload.payload = err;
    storeObj.dispatch(wrappedPayload);
  }).catch(function (e) {
    if (isDone) return;
    isDone = true;
    wrappedPayload.status = 'error';
    wrappedPayload.payload = e;
    storeObj.dispatch(wrappedPayload);
  });
  return promiseObj;
}

/* Proxy getState */
function getState() {
  if (!storeObj) {
    console.warn('tredux: getState() is not yet available.');
    return null;
  }
  return storeObj.getState.apply(storeObj, arguments);
}

/* Proxy replaceReducer */
function replaceReducer() {
  if (!storeObj) {
    console.warn('tredux: replaceReducer() is not yet available.');
    return;
  }
  return storeObj.replaceReducer.apply(storeObj, arguments);
}

/* proxy subscribe */
function subscribe(fn) {
  if (storeObj) return storeObj.subscribe.apply(storeObj, arguments);
  PROXY_SUBSCRIPTIONS.push(fn);
  return this;
}

/* Exposes the given actions. */
function addActions(reducerName, actionsMap) {
  if (typeof reducerName !== 'string') {
    console.warn('tredux.addAction: action must be a string.');
    return;
  }
  if (typeof actions[reducerName] === 'undefined') actions[reducerName] = {};
  Object.keys(actionsMap).forEach(function (actionName) {
    if (typeof actionsMap[actionName] === 'function' || _typeof(actionsMap[actionName]) === 'object' && actionsMap[actionName]) {
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
function addListener(types, fn) {
  var events = {}; // this is our {actionType:fn} object.
  if (typeof types === 'string' && typeof fn === 'function') {
    events[types] = fn;
  } else if (types instanceof Array) {
    for (var i = 0; i < types.length - 1; i += 2) {
      var eventName = types[i],
          eventFn = types[i + 1];
      events[eventName] = eventFn;
    }
  }
  Object.keys(events).forEach(function (eName) {
    var eFn = events[eName];
    if (typeof eName !== 'string') {
      console.warn("Received invalid event name in addListener:");
      console.warn(eFn);
      return;
    }
    if (typeof LISTENERS[eName] === 'undefined') LISTENERS[eName] = [];
    LISTENERS[eName].push(eFn);
  });
  var isUnsubscribed = false;
  return {
    remove: function remove() {
      if (isUnsubscribed) return;
      isUnsubscribed = true;
      setImmediate(function () {
        Object.keys(events).forEach(function (eName) {
          var eFn = events[eName];
          if (typeof LISTENERS[eName] === 'undefined') return;
          for (var _i = 0; _i < LISTENERS[eName].length; _i++) {
            if (LISTENERS[eName][_i] !== eFn) continue;
            LISTENERS[eName].splice(_i, 1);
            if (LISTENERS[eName].length === 0) {
              delete LISTENERS[eName];
            }
            return;
          }
        });
        events = null;
      });
    }
  };
}

/* This will "emit" an event / payload to any listeners. */
function emit(eventName, payload) {
  if (typeof LISTENERS[eventName] === 'undefined') return;
  for (var i = 0; i < LISTENERS[eventName].length; i++) {
    LISTENERS[eventName][i](payload);
  }
}

/* Returns an object of all the prepared reducers. */
function prepareReducers() {
  var reducers = {};
  Object.keys(LOADED_REDUCERS).forEach(function (rName) {
    reducers[rName] = LOADED_REDUCERS[rName].prepare();
  });
  return reducers;
}

function proxyListener(a) {
  return function (next) {
    return function (action) {
      var actionType = action.type;
      next(action);
      emit(actionType, action.payload);
    };
  };
}