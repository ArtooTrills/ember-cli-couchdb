import Ember from 'ember';
import DS from 'ember-data';

export default DS.RESTAdapter.extend({
  primaryKey: '_id',
  defaultSerializer: 'data',
  updateHandler: null,
  couchNamespace: null,
  
  acceptedKeys: ['reduce', 'key', 'startkey', 'endkey', 'keys', 'limit', 'skip', 'group_level', 'include_docs', 'descending'],
  
  getViewURL: function (category, view) {
    return `_design/${category}/_view/${view}`;
  },
  
  buildURL: function(type, id, snapshot, query) {
    var category, key, value, view;
    var namespace = this.get('namespace') || '';
    var couchNamespace = this.get('couchNamespace') || '';

    if (query && typeof(query) === 'object') {
      if(query.data && query.data.updateHandler){
        return `${namespace}/${couchNamespace}/_update/${query.data.updateHandler}/${id}`;
      }
      else if(!query.category && query.view){
        // all docs
        query.type = 'POST';
        //[todo] - for /_all_docs set the query object correctly
        return `${namespace}/${couchNamespace}/_all_docs`;
      }
      else {
        // _view
        category = query.category;
        view = query.view;
        delete query.category;
        delete query.view;
        
        // [todo] - handle query object formating of multiple startkey & endkey pairs  
        for (key in query) {
          value = query[key];
          if (key === 'startkey' || key === 'endkey') {
            if (typeof value === 'object') {
              query[key] = JSON.stringify(value);
            }
          }
        }

        // Clean keys in query
        let acceptedKeys = this.get('acceptedKeys') || [];
        query.data = {};
        for (key in query) {
          value = query[key];
          if(acceptedKeys.indexOf(key) < 0) {
            continue;
          }
          query.data[key] = query[key];
          delete query[key];
        }
        let viewUrl = this.getViewURL(category, view);
        // return `${namespace}/${couchNamespace}/_view/${category}/${view}`;
        return `${namespace}/${couchNamespace}/${viewUrl}`;
      }
    }  
    else if (id) {
      return `${namespace}/${couchNamespace}/${id}`;
    } else {
      return `${namespace}/${couchNamespace}`;
    }
  },

  findAll: function(store, type) {
    return Ember.assert(`Please do not call find() for ${type.typeKey} instead pass keys or startkey & endkey pair`, false);
  },

  findQuery: function(store, type, query) {
    if (this.sortQueryParams) {
      query = this.sortQueryParams(query);
    }
    var url = this.buildURL(type, null,null, query);
    type = query.type || 'GET';
    delete query.type;
    return this.ajax(url, type, query);
  },

  createRecord: function(store, type, snapshot) {
    var data = {};
    var serializer = store.serializerFor(type.typeKey);
    data = serializer.serialize(snapshot, { includeId: true });
    
    return this.ajax(this.buildURL(type.typeKey, null, snapshot), 'POST', function(json) {
      Ember.assert('Must contain ok key in save response', json.ok);
      delete json.ok;
      Ember.assert('Must contain id key in save response', json.id);
      Ember.assert('Must contain rev key in save response', json.rev);
      data._rev = json.rev;
      delete json.rev;
      json = Ember.$.extend(data, json);
      return json;
    }, {
      data: data
    });
  },

  updateRecord: function(store, type, snapshot) {
    var data = {};
    var id = snapshot.get('id');
    var serializer = store.serializerFor(type.typeKey);
    data = serializer.serialize(snapshot, { includeId: true });

    var query;
    if (this.updateHandler) {
      query = { data: { updateHandler: this.updateHandler }};
    }
    
    return this.ajax(this.buildURL(type.typeKey, id, snapshot, query), 'PUT', function(json) {
      Ember.assert('Must contain ok key in save response', json.ok);
      delete json.ok;
      Ember.assert('Must contain id key in save response', json.id);
      Ember.assert('Must contain rev key in save response', json.rev);
      data._rev = json.rev;
      delete json.rev;
      json = JSON.parse(JSON.stringify(Ember.$.extend(data, json)));
      return json;
    }, {
      data: data
    });
  },

  deleteRecord: function(store, type, snapshot) {
    var data, id, serializer;
    data = {};
    serializer = store.serializerFor(type.typeKey);
    serializer.serializeIntoHash(data, type, snapshot, {includeId: true});
    data._deleted = true;
    id = snapshot.get('id');

    return this.ajax(this.buildURL(type.typeKey, id, snapshot), 'PUT', function(json) {
      Ember.assert('Must contain ok key in save response', json.ok);
      delete json.ok;
      Ember.assert('Must contain rev key in save response', json.rev);
      data._rev = json.rev;
      delete json.rev;
      json = Ember.$.extend(data, json);
      return json;
    }, {
      data: data
    });
  },

  ajax: function(url, type, normalizeResponse, hash) {
    var adapter;
    adapter = this;
    if (normalizeResponse && !hash) {
      hash = normalizeResponse;
      normalizeResponse = null;
    }
    return new Ember.RSVP.Promise(function(resolve, reject) {
      hash = adapter.ajaxOptions(url, type, hash);
      hash.success = function(json/*, textStatus, jqXHR*/) {
        if (normalizeResponse && Ember.typeOf(normalizeResponse) === 'function') {
          json = normalizeResponse.call(adapter, json);
        }
        Ember.run(null, resolve, json);
      };
      hash.error = function(jqXHR, textStatus, errorThrown) {
        Ember.run(null, reject, adapter.ajaxError(jqXHR, jqXHR.responseText, errorThrown));
      };
      return Ember.$.ajax(hash);
    }, `DS: DataAdapter#ajax ${type} to ${url}`);
  }

});