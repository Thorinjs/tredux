'use strict';
/**
 * This is our tredux-form specific integrations
 * */

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var stringify = require('json-stable-stringify');
/**
 * Generates a tredux form, using the given key-values
 * Note:
 * We can also register generic form structures, by passing a structureName as a string.
 * When defining a filter data, we need to pass structureName as an object with {type: 'filter'}
 * */
module.exports = function (tredux) {
  var FORM_STRUCTURES = {}; // map of {formStructureName:initialState}
  var PENDING_FORM_STRUCTURES = {}; // map of {formStructureName:array(formObjectsWaitingForStructure)}

  var fid = 0,
      lid = 0;
  tredux.filterData = function (initialState) {
    return tredux.formData(initialState, {
      type: 'filter'
    });
  };
  tredux.formData = function (initialState, structureName) {
    if ((typeof initialState === 'undefined' ? 'undefined' : _typeof(initialState)) === 'object' && initialState && typeof initialState.reset === 'function') return initialState;
    var formType = 'form';
    if (typeof structureName === 'string') {
      FORM_STRUCTURES[structureName] = JSON.stringify(initialState);
      if (PENDING_FORM_STRUCTURES[structureName]) {
        for (var i = 0; i < PENDING_FORM_STRUCTURES[structureName].length; i++) {
          PENDING_FORM_STRUCTURES[structureName][i].reset(JSON.parse(FORM_STRUCTURES[structureName]), true);
        }
        delete PENDING_FORM_STRUCTURES[structureName];
      }
    } else if ((typeof structureName === 'undefined' ? 'undefined' : _typeof(structureName)) === 'object' && structureName) {
      if (structureName.type) {
        formType = structureName.type;
      }
    }
    var formObj = {};
    var formId = fid;
    fid++;
    var _initial = '{}',
        _current = '{}',
        _listeners = [],
        _baseInitial = '{}',
        reducerName = void 0,
        FormAction = void 0;
    formObj.data = {};
    // Fetch a previous form structure
    if (typeof initialState === 'string') {
      var initStruct = FORM_STRUCTURES[initialState];
      if (initStruct) {
        initialState = JSON.parse(initStruct);
      } else {
        if (!PENDING_FORM_STRUCTURES[initialState]) PENDING_FORM_STRUCTURES[initialState] = [];
        PENDING_FORM_STRUCTURES[initialState].push(formObj);
        initialState = {};
      }
    }
    _baseInitial = JSON.stringify(initialState);
    /*
    * Returns the initial state
    * */
    formObj.getInitialState = function () {
      return JSON.parse(_initial);
    };

    /*
    * Resets to the base initial state.
    * */
    formObj.baseReset = function (ignoreDispatch) {
      var b = JSON.parse(_baseInitial);
      return formObj.reset(b, ignoreDispatch);
    };

    /*
    * Reset the initial data
    * */
    formObj.reset = function (initialData, ignoreDispatch) {
      if (typeof initialData === 'undefined' && _initial) {
        return formObj.reset(JSON.parse(_initial), ignoreDispatch);
      }
      if ((typeof initialData === 'undefined' ? 'undefined' : _typeof(initialData)) === 'object' && initialData) {
        _current = _initial = stringify(initialData);
        formObj.data = JSON.parse(_initial);
      } else {
        _initial = '{}';
        _current = '{}';
        formObj.data = {};
      }
      if (ignoreDispatch !== true && FormAction) {
        formDispatch(FormAction, formType, 'reset', undefined, formId);
        _change();
      }
    };

    /*
    * Resets a single field
    * */
    formObj.resetField = function (key) {
      if (typeof key !== 'string' || !key) return;
      var init = formObj.getInitialState() || {};
      formObj.field(key, init[key]);
    };

    /*
    * Returns the initial value of a field
    * */
    formObj.getInitialField = function (key) {
      var init = formObj.getInitialState() || {},
          v = init[key];
      if (typeof v === 'undefined') return null;
      return v;
    };

    /*
    * Sets/Gets a field's value
    * */
    formObj.field = function (key, val) {
      if (typeof key !== 'string' || !key) return null;
      if (typeof key === 'string' && typeof val === 'undefined') {
        return typeof formObj.data[key] === 'undefined' ? null : formObj.data[key];
      }
      if ((typeof key === 'undefined' ? 'undefined' : _typeof(key)) === 'object' && key) {
        return Object.keys(key).forEach(function (k) {
          formObj.field(k, key[k]);
        });
      }
      if (typeof val !== 'undefined') {
        formObj.data[key] = val;
        _current = stringify(formObj.data);
      }
    };

    /*
    * Change the form field and trigger an updateForm event
    * */
    formObj.change = function (key, val) {
      if (!FormAction) {
        console.warn('Clym: change(): form does not have an action set nor was it attached() for: ' + formId);
        return;
      }
      if (typeof key === 'string' || typeof key === 'number') {
        var payload = {};
        payload[key] = val;
        formDispatch(FormAction, formType, 'update', payload, formId);
      } else if ((typeof key === 'undefined' ? 'undefined' : _typeof(key)) === 'object' && key) {
        formDispatch(FormAction, formType, 'update', key, formId);
      }
      _change();
    };

    /*
    * Checks if the form has changes
    * Options:
    *   opt.ignore -> array of keys to ignore.
    * */
    formObj.changed = function (opt) {
      if ((typeof opt === 'undefined' ? 'undefined' : _typeof(opt)) !== 'object' || !opt || Object.keys(opt).length === 0) {
        return _initial !== _current;
      }
      if (typeof opt.ignore === 'string') opt.ignore = [opt.ignore];
      try {
        var iObj = JSON.parse(_initial),
            cObj = JSON.parse(_current),
            keys = Object.keys(cObj);
        for (var _i = 0; _i < keys.length; _i++) {
          if (opt.ignore instanceof Array && opt.ignore.indexOf(keys[_i]) !== -1) continue;
          if (iObj[keys[_i]] !== cObj[keys[_i]]) return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    };
    formObj.TYPE = {
      RESET: '',
      UPDATE: ''
    };
    /*
    * Attaches the UPDATE_FORM LISTENER to the reducer.
    * Note:
    * - keyName is the form name within the state.
    * */
    formObj.attach = function (reducerObj, keyName) {
      if (!keyName) keyName = formType;
      var actionObj = tredux.actions(reducerObj.name);
      var subType = formType.toUpperCase();
      subType += '_' + formId;
      if (actionObj && actionObj.TYPE) {
        var updateFnName = 'update' + subType.charAt(0) + formType.substr(1) + formId,
            updateActName = 'UPDATE_' + subType,
            resetFnName = 'reset' + subType.charAt(0) + formType.substr(1) + formId,
            resetActName = 'RESET_' + subType;
        actionObj.TYPE[updateActName] = reducerObj.name + '.' + keyName + formId;
        formObj.TYPE.UPDATE = actionObj.TYPE[updateActName];
        actionObj.TYPE['RESET_' + subType] = reducerObj.name + '.' + keyName + '.reset' + formId;
        formObj.TYPE.RESET = actionObj.TYPE['RESET_' + subType];
        reducerObj.handle(actionObj.TYPE['UPDATE_' + subType], handleUpdateForm(formObj, formType));
        reducerObj.handle(actionObj.TYPE['RESET_' + subType], handleResetForm(formObj, formType));
        FormAction = actionObj;
        reducerName = reducerObj.name;
        /*
        * Attach updateForm/resetForm/updateFilter/resetFilter
        * */
        FormAction[updateFnName] = function (payload) {
          return {
            type: actionObj.TYPE[updateActName],
            payload: payload
          };
        };
        FormAction[resetFnName] = function (payload) {
          return {
            type: actionObj.TYPE[resetActName],
            payload: payload
          };
        };
      }
    };

    /**
     * Listens to form changes.
     * */
    formObj.listen = function (callback) {
      if (typeof callback !== 'function') {
        console.warn('tredux: form.listen() requires a callback function');
        return false;
      }
      var id = lid++;
      for (var _i2 = 0; _i2 < _listeners.length; _i2++) {
        if (_listeners[_i2].fn === callback) {
          return _listeners[_i2];
        }
      }
      var l = {
        id: id,
        fid: formId,
        remove: function remove() {
          for (var _i3 = 0; _i3 < _listeners.length; _i3++) {
            if (_listeners[_i3].id === id) {
              _listeners.splice(_i3, 1);
              break;
            }
          }
        },
        fn: callback
      };
      _listeners.push(l);
      return l;
    };

    /*
    * INTERNAL FUNCTIONALITY
    * */
    var _cTimer = void 0;

    function _change() {
      if (_cTimer) clearTimeout(_cTimer);
      _cTimer = setTimeout(function () {
        for (var _i4 = 0, len = _listeners.length; _i4 < len; _i4++) {
          if (_listeners[_i4].fid !== formId) continue;
          _listeners[_i4].fn(formObj.data);
        }
      }, 50);
    }

    formObj.reset(initialState, true);
    return formObj;
  };

  /*
  * Form handles for: update/reset
  * */
  function handleUpdateForm(formObj) {
    return function (state, payload) {
      if ((typeof payload === 'undefined' ? 'undefined' : _typeof(payload)) !== 'object' || !payload) return;
      Object.keys(payload).forEach(function (field) {
        formObj.field(field, payload[field]);
      });
    };
  }

  function handleResetForm(formObj) {
    return function () {
      formObj.reset(undefined, true);
    };
  }

  function formDispatch(FormAction, formType, action, data, formId) {
    var key = action;
    key += formType.charAt(0).toUpperCase();
    key += formType.substr(1);
    key += formId;
    if (typeof FormAction[key] !== 'function') {
      console.warn('tredux: FormAction does not have action: ' + action + ' for ' + formType + ' - ' + formId);
      return;
    }
    var q = FormAction[key](data);
    tredux.dispatch(q);
  }
};