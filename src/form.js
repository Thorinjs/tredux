'use strict';
/**
 * This is our tredux-form specific integrations
 * */
const stringify = require('json-stable-stringify');
/**
 * Generates a tredux form, using the given key-values
 * Note:
 * We can also register generic form structures, by passing a structureName as a string.
 * When defining a filter data, we need to pass structureName as an object with {type: 'filter'}
 * */
module.exports = (tredux) => {
  const FORM_STRUCTURES = {}; // map of {formStructureName:initialState}
  const PENDING_FORM_STRUCTURES = {}; // map of {formStructureName:array(formObjectsWaitingForStructure)}

  let fid = 0,
    lid = 0;
  tredux.filterData = (initialState) => {
    return tredux.formData(initialState, {
      type: 'filter'
    });
  };
  tredux.formData = (initialState, structureName) => {
    if (typeof initialState === 'object' && initialState && typeof initialState.reset === 'function') return initialState;
    let formType = 'form';
    if (typeof structureName === 'string') {
      FORM_STRUCTURES[structureName] = JSON.stringify(initialState);
      if (PENDING_FORM_STRUCTURES[structureName]) {
        for (let i = 0; i < PENDING_FORM_STRUCTURES[structureName].length; i++) {
          PENDING_FORM_STRUCTURES[structureName][i].reset(JSON.parse(FORM_STRUCTURES[structureName]), true);
        }
        delete PENDING_FORM_STRUCTURES[structureName];
      }
    } else if (typeof structureName === 'object' && structureName) {
      if (structureName.type) {
        formType = structureName.type;
      }
    }
    let formObj = {};
    let formId = fid;
    fid++;
    let _initial = '{}',
      _current = '{}',
      _listeners = [],
      _baseInitial = '{}',
      reducerName,
      FormAction;
    formObj.data = {};
    // Fetch a previous form structure
    if (typeof initialState === 'string') {
      let initStruct = FORM_STRUCTURES[initialState];
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
    formObj.getInitialState = () => {
      return JSON.parse(_initial);
    };

    /*
    * Resets to the base initial state.
    * */
    formObj.baseReset = (ignoreDispatch) => {
      let b = JSON.parse(_baseInitial);
      return formObj.reset(b, ignoreDispatch);
    };

    /*
    * Reset the initial data
    * */
    formObj.reset = (initialData, ignoreDispatch) => {
      if (typeof initialData === 'undefined' && _initial) {
        return formObj.reset(JSON.parse(_initial), ignoreDispatch);
      }
      if (typeof initialData === 'object' && initialData) {
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
    formObj.resetField = (key) => {
      if (typeof key !== 'string' || !key) return;
      let init = formObj.getInitialState() || {};
      formObj.field(key, init[key]);
    };

    /*
    * Returns the initial value of a field
    * */
    formObj.getInitialField = (key) => {
      let init = formObj.getInitialState() || {},
        v = init[key];
      if (typeof v === 'undefined') return null;
      return v;
    };

    /*
    * Sets/Gets a field's value
    * */
    formObj.field = (key, val) => {
      if (typeof key !== 'string' || !key) return null;
      if (typeof key === 'string' && typeof val === 'undefined') {
        return typeof formObj.data[key] === 'undefined' ? null : formObj.data[key];
      }
      if (typeof key === 'object' && key) {
        return Object.keys(key).forEach((k) => {
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
    formObj.change = (key, val) => {
      if (!FormAction) {
        console.warn(`Clym: change(): form does not have an action set nor was it attached() for: ${formId}`);
        return;
      }
      if (typeof key === 'string' || typeof key === 'number') {
        const payload = {};
        payload[key] = val;
        formDispatch(FormAction, formType, 'update', payload, formId);
      } else if (typeof key === 'object' && key) {
        formDispatch(FormAction, formType, 'update', key, formId);
      }
      _change();
    };

    /*
    * Checks if the form has changes
    * Options:
    *   opt.ignore -> array of keys to ignore.
    * */
    formObj.changed = (opt) => {
      if (typeof opt !== 'object' || !opt || Object.keys(opt).length === 0) {
        return _initial !== _current;
      }
      if (typeof opt.ignore === 'string') opt.ignore = [opt.ignore];
      try {
        let iObj = JSON.parse(_initial),
          cObj = JSON.parse(_current),
          keys = Object.keys(cObj);
        for (let i = 0; i < keys.length; i++) {
          if (opt.ignore instanceof Array && opt.ignore.indexOf(keys[i]) !== -1) continue;
          if (iObj[keys[i]] !== cObj[keys[i]]) return true;
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
    formObj.attach = (reducerObj, keyName) => {
      if (!keyName) keyName = formType;
      const actionObj = tredux.actions(reducerObj.name);
      let subType = formType.toUpperCase();
      subType += '_' + formId;
      if (actionObj && actionObj.TYPE) {
        let updateFnName = 'update' + subType.charAt(0) + formType.substr(1) + formId,
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
        FormAction[updateFnName] = (payload) => {
          return {
            type: actionObj.TYPE[updateActName],
            payload
          }
        };
        FormAction[resetFnName] = (payload) => {
          return {
            type: actionObj.TYPE[resetActName],
            payload
          }
        };
      }
    };

    /**
     * Listens to form changes.
     * */
    formObj.listen = (callback) => {
      if (typeof callback !== 'function') {
        console.warn(`tredux: form.listen() requires a callback function`);
        return false;
      }
      let id = lid++;
      for (let i = 0; i < _listeners.length; i++) {
        if (_listeners[i].fn === callback) {
          return _listeners[i];
        }
      }
      let l = {
        id: id,
        fid: formId,
        remove: () => {
          for (let i = 0; i < _listeners.length; i++) {
            if (_listeners[i].id === id) {
              _listeners.splice(i, 1);
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
    let _cTimer;

    function _change() {
      if (_cTimer) clearTimeout(_cTimer);
      _cTimer = setTimeout(() => {
        for (let i = 0, len = _listeners.length; i < len; i++) {
          if (_listeners[i].fid !== formId) continue;
          _listeners[i].fn(formObj.data);
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
    return (state, payload) => {
      if (typeof payload !== 'object' || !payload) return;
      Object.keys(payload).forEach((field) => {
        formObj.field(field, payload[field]);
      });
    };
  }

  function handleResetForm(formObj) {
    return () => {
      formObj.reset(undefined, true);
    }
  }

  function formDispatch(FormAction, formType, action, data, formId) {
    let key = action;
    key += formType.charAt(0).toUpperCase();
    key += formType.substr(1);
    key += formId;
    if (typeof FormAction[key] !== 'function') {
      console.warn(`tredux: FormAction does not have action: ${action} for ${formType} - ${formId}`);
      return;
    }
    let q = FormAction[key](data);
    tredux.dispatch(q);
  }

};