import Ember from 'ember';
import DataSerializer from './data';

export default DataSerializer.extend({
  extractArray: function(store, primaryType, payload) {
    var that = this;
    var _payload = {};
    var _rootKey = Ember.String.pluralize(primaryType.typeKey);
    _payload[_rootKey] = (payload.rows || []).map(function (row) {
      row.id = that._getRowId(row);
      return that.addIds(row);
    });

    return this._super(store, primaryType, _payload, true);
  },
  _getRowId: function(row) {
    return btoa(JSON.stringify(row.key));
  }
});