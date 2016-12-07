import Ember from 'ember';
import DataSerializer from './data';

export default DataSerializer.extend({
  isNewSerializerAPI: true,
  normalizeArrayResponse: function(store, primaryModelClass, payload, id, requestType) {
    var that = this;
    var _payload = {};
    var _rootKey = Ember.String.pluralize(primaryModelClass.modelName);
    _payload[_rootKey] = (payload.rows || []).map(function (row) {
      row.id = that._getRowId(row);
      return that.addIds(row);
    });
    if(payload['meta']){
      _payload['meta'] = payload['meta'];
    }
    return this._super(store, primaryModelClass, _payload, id, requestType);
  },
  _getRowId: function(row) {
    return btoa(JSON.stringify(row.key));
  }
});