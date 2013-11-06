const PLATFORM_FRAGMENTS = {
  linux: 'linux-i686',
  linux64: 'linux-x86_64',
  mac: 'mac',
  mac64: 'mac64',
  win32: 'win32',
  win64: 'win64-x86_64'
};

var mciconf = angular.module('mciconf', []);

mciconf.controller('mainController', ['$scope', '$http', '$timeout',

]);

mciconf.directive('build', function () {
  return {
    restrict: 'AE',
    templateUrl: 'templates/build.html'
  }
});

mciconf.directive('document', function () {
  return {
    restrict: 'AE',
    templateUrl: 'templates/document.html'
  }
});

mciconf.directive('formPage', function () {
  return {
    restrict: 'AE',
    templateUrl: 'templates/form.html'
  }
});
