/* globals blanket, module */

var options = {
  modulePrefix: 'ember-cli-couchdb',
  filter: '//.*ember-cli-couchdb/.*/',
  antifilter: '//.*(tests|template).*/',
  loaderExclusions: [],
  enableCoverage: true,
  cliOptions: {
    reporters: ['lcov'],
    autostart: true
  }
};
if (typeof exports === 'undefined') {
  blanket.options(options);
} else {
  module.exports = options;
}
