const PLATFORM_FRAGMENTS = {
  linux: 'linux-i686',
  linux64: 'linux-x86_64',
  mac: 'mac',
  mac64: 'mac64',
  win32: 'win32',
  win64: 'win64-x86_64'
};
const STATE = {
  NOT_CHECKED: 0,
  FOUND: 1,
  NOT_FOUND: 2
}

function notAdded(value) {
  return !value.added;
}

var mciconf = angular.module('mciconf', []);

mciconf.controller('mainController', ['$scope', '$rootScope', '$http',
  function mciconf($scope, $rootScope, $http) {
    $rootScope.builds = [];
    $rootScope.iconClasses = ["icon-question-sign", "icon-ok", "icon-remove"];
    $rootScope.buttonClasses = ["btn-warning", "btn-success", "btn-danger"];
    $rootScope.locales = ["en-US"];
    $rootScope.ff_versions = [];
    //START Retrieving data
    $http.get('data/dashboards.json').then(function (res){
      $rootScope.dashboards = res.data.dashboards;
      $rootScope.dashboardsbuildUrl = res.data.dashboardsbuildUrl;
      $rootScope.dashboard = $scope.dashboards[0];
    });

    $http.get('http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/', {headers:{'Accept':'text/html'}}).then(function (res){
      var doc = document.createElement('div');
      doc.innerHTML = res.data.split('<table>')[1].split('</table>')[0];
      var links = doc.getElementsByTagName('a');
      for (var link in links) {
        if (links[link].innerText && links[link].innerText.indexOf('-candidates') !== -1)
          $rootScope.ff_versions.push(links[link].innerText.split('-candidates/')[0]);
      };
      $rootScope.ff_versions.sort(function(a,b){
        return parseInt(b)-parseInt(a);
      });
    });

    $http.get('https://l10n.mozilla.org/shipping/api/status?tree=fx_beta').then(function (res){
      res.data.items.forEach(function (locale) {
        if (locale.type === "Build")
          $rootScope.locales.push(locale.locale);
      });
    });

    $http.get('data/platforms.json').then(function (res){
      $rootScope.platforms = res.data;

      $scope.initForm();
    });

    $http.get('data/testruns.json').then(function (res){
      $rootScope.testruns = res.data;
      $rootScope.testrun = $rootScope.testruns[2];
    });
    //END Retrieving data

    $scope.addBuild = function () {
      var newEmptyBuild = {};
      newEmptyBuild.firefox_versions = [{name: "",
                                         locale: "",
                                         exists: 0}];

      newEmptyBuild.platform = $rootScope.platforms.filter(notAdded)[0];
      newEmptyBuild.platform_version =  newEmptyBuild.platform.versions.filter(notAdded)[0];
      newEmptyBuild.platform_version.added = true;
      if (!newEmptyBuild.platform.versions.filter(notAdded).length) {
        newEmptyBuild.platform.added = true;
      }
      $rootScope.builds.push(newEmptyBuild);


      $scope.$watch(function () {
        return newEmptyBuild.platform_version
      }, function (newVersion, oldVersion) {
        oldVersion.added = false;
        newVersion.added = true;
      });
      $scope.$watch(function () {
        return newEmptyBuild.platform
      }, function (newVersion, oldVersion) {
        oldVersion.added = false;
        if (!newVersion.versions.filter(notAdded).length) {
          newVersion.added = true;
        }
      });
    };

    $scope.checkAll = function () {
      $rootScope.$broadcast('checkAll');
    }

    $scope.clear = function () {
      $rootScope.testrun = $rootScope.testruns[0];
      $rootScope.dashboard = $rootScope.dashboards[0];
      $rootScope.target_build_id = "";
      $rootScope.update_channel = "";
      $rootScope.builds = [];
    }

    $scope.initForm = function () {
      if ($rootScope.builds.length < 1) {
        $scope.addBuild();
      }
    };

    $scope.isUpdate = function () {
      if ($rootScope.testrun)
        return $rootScope.testrun.script === 'update';
      else return false;
    };
  }
]);

mciconf.directive('build', function () {
  return {
    restrict: 'AE',
    templateUrl: 'templates/build.html',
    controller: function ($scope, $rootScope, $timeout) {

      $scope.addVersion = function (aIndex) {
        $rootScope.builds[aIndex].firefox_versions.push({exists: STATE.NOT_CHECKED});
      };

      $scope.checkBuild = function (aVersionIndex, aBuildIndex) {
        // If there is no version and locales then we have to invalidate the build and return early
        if (!$rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].name &&
            !$rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].locale) {
          $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].exists = STATE.NOT_FOUND;
          return;
        }

        var candidate = $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].name.indexOf("#") !== -1;

        var build = (candidate) ? $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].name.split("#")[1] : undefined;
        var foundBuilds = 0;
        var locales = $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].locale.split(" ");
        var url = "http://ftp.mozilla.org/pub/mozilla.org/firefox/";
        var version = $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].name.split("#")[0];

        url += (candidate) ? "candidates/" : "releases/";
        url += version + ((candidate) ? "-candidates/build" + build + "/" : "/");
        url += PLATFORM_FRAGMENTS[$rootScope.builds[aBuildIndex].platform_version.platform ||
                                  $rootScope.builds[aBuildIndex].platform.platform] + "/";
        locales.forEach(function (locale) {
          var buildUrl = url + locale + "/";
          switch ($rootScope.builds[aBuildIndex].platform.platform) {
            case "linux":
              buildUrl += "firefox-";
              buildUrl += version;
              buildUrl += ".tar.bz2";
              break;
            case "mac":
              buildUrl += "Firefox%20";
              buildUrl += version;
              buildUrl += ".dmg";
              break;
            case "win32":
              buildUrl += "Firefox%20Setup%20";
              buildUrl += version;
              buildUrl += ".exe";
              break;
          }

          var x = new XMLHttpRequest();
          x.open("GET", buildUrl);
          x.onreadystatechange = function () {
            if (x.readyState === 2 && x.status === 200) {
              foundBuilds += 1;
              if (foundBuilds === locales.length) {
                $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].exists = STATE.FOUND;
                $scope.$emit('notify', {type: 'success',
                                        message: 'Build "' + buildUrl + '" exists.'});

                // Because we change this outside angular world we have to call the apply function to check models
                if (!$rootScope.$$phase)
                  $rootScope.$apply();
              }
              x.abort();
            } else if ((x.readyState == 2 && x.status !== 200) || x.status === 0) {
              $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].exists = STATE.NOT_FOUND;
              $scope.$emit('notify', {type: 'error',
                                      message: 'No Build was found at ' + buildUrl});
              // Because we change this outside angular world we have to call the apply function to check models
              if (!$rootScope.$$phase)
                $rootScope.$apply();
            }
          };
          x.send();
        });
      };

      $scope.checkLocales = function (aVersionIndex, aBuildIndex) {
        $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].exists = STATE.NOT_CHECKED;
        $timeout.cancel($scope.checker);
        var locales = $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].locale.split(" ");
        $scope.checker = $timeout(function() {
          for (var i = 0; i < locales.length; i += 1) {
            if ($rootScope.locales.indexOf(locales[i]) === -1) {
              $scope.$emit('notify', {type: 'error',
                                      message: 'Locale "' + locales[i] + '" was not found!'});
              locales.splice(i, 1);
              i -= 1; // If we remove one item the next one will be on the same index
            }
          }
          $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].locale = locales.join(" ");
        }, 3000, true);
      };

      $scope.checkVersion = function (aVersionIndex, aBuildIndex) {
        $rootScope.builds[aBuildIndex].firefox_versions[aVersionIndex].exists = STATE.NOT_CHECKED;
      };

      $scope.updatePlatformVersion = function (aIndex) {
        $rootScope.builds[aIndex].platform_version = $rootScope.builds[aIndex].platform.versions.filter(notAdded)[0];
      };

      $scope.removeBuild = function(index) {
        $rootScope.builds[index].platform.added = false;
        $rootScope.builds[index].platform_version.added = false;
        $rootScope.builds.splice(index, 1);
      };

      $scope.removeVersion = function (aVersionIndex, aBuildIndex) {
        $rootScope.builds[aBuildIndex].firefox_versions.splice(aVersionIndex, 1);
      };

      $scope.$on('checkAll', function () {
        var length = $scope.this.build.firefox_versions.length;
        for (var i = 0; i < length; i += 1) {
          $scope.checkBuild(i, $scope.$index);
        }
      });
    }
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
    templateUrl: 'templates/form.html',
    controller: function ($scope, $rootScope) {
      $scope.checkAllBuilds = function () {
        var returnValue = STATE.FOUND;
        $rootScope.builds.some(function (build) {
          build.firefox_versions.some(function (version) {
            if (version.exists === STATE.NOT_FOUND)
              returnValue = STATE.NOT_FOUND;
            else if (version.exists === STATE.NOT_CHECKED)
              returnValue = STATE.NOT_CHECKED;
            return returnValue === STATE.NOT_FOUND
          });
          return returnValue === STATE.NOT_FOUND;
        });
        return returnValue;
      }

      $scope.platformsLeft = function () {
        if (!$rootScope.platforms)
          return false;
        return $rootScope.platforms.filter(notAdded).length
      }
    }
  }
});

mciconf.directive('notification', function () {
  return {
    restrict: 'AE',
    templateUrl: 'templates/logger.html',
    controller: function ($scope, $rootScope) {
      $scope.alerts = [{type: "error", message: "Demo alert"},
                       {type: "success", message: "Demo alert"},
                       {type: "warning", message: "Demo alert"}];
      $scope.history = [];
      $scope.closeAlert = function (aIndex) {
        $scope.alerts.splice(aIndex, 1);
      }
      $rootScope.$on('notify', function (aEvent, aMessage) {
        $scope.alerts.reverse();
        $scope.alerts.push({type: aMessage.type, message: aMessage.message});
        $scope.alerts.reverse();
        if ($scope.alerts.length > 3)
          $scope.history.push($scope.alerts.pop());
      });
    }
  }
});

/*
 * This filter should return all elements that are not already added
 * including the current element
 */
mciconf.filter('added', function(){

  return function (items, current) {
    var filteredArray = [];
    items.forEach(function (item) {
      if (!item.added || angular.equals(item, current))
        filteredArray.push(item);
    });

    return filteredArray;
  };
});
