var gulp = require('gulp');
var ghPages = require('gulp-gh-pages');

gulp.task('deploy', function() {
  return gulp.src('./docs/**/*').pipe(ghPages({branch: 'gh-pages'}));
});