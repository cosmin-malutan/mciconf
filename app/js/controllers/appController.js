mciconf.controller('mainController', ['$scope', '$rootScope', '$http', '$timeout',
  function mciconf($scope, $rootScope, $http, $timeout) {
    $rootScope.builds = [];
    $rootScope.buttonClasses = ["btn-primary", "btn-success", "btn-warning"];
    $rootScope.firefoxVersions = [];
    $rootScope.firefoxVersionsTypes = [];
    $rootScope.iconClasses = ["icon-question-sign", "icon-ok", "icon-remove"];
    $rootScope.locales = ["en-US"];
    $rootScope.updateChannels = ["aurora", "auroratest", "beta", "betatest", "default",
                                 "esr", "esrtest", "release", "releasetest", "nightly",
                                 "nightlytest"];
    $rootScope.updateChannel = "default";
    $rootScope.target_build_id = "..."
    $rootScope.targetBuildVersion = "";
    $rootScope.target_build_number = "build1";
    $rootScope.target_build_numbers = ["build1"];

    /**
     * Helper function to load data via FTP and parse it's elements with a filter callback
     * @param {string} aAddress
     *        Url of ftp directory in which to search
     * @param {string} aTag
     *        Tag of the elements to retrieve
     * @param {function} aPreHook
     *        A function to be called before we parse the DOM
     * @param {function} aWalkerCallback
     *        A function to be applied on each element, takes as the parameter the element
     * @param {function} aPostHook
     *        A function to be called after we parse the DOM
     * @param {function} aErrorCallback
     *        A function to be called in case we get an HTTP exception
     */
    $rootScope.parseAtAddress = function (aAddress, aTag, aPreHook, aWalkerCallback, aPostHook, aErrorCallback) {
      $http({method: 'GET', url: aAddress}).success(function (data) {
        if (aPreHook) {
          aPreHook();
        }
        var doc = document.createElement('div');
        doc.innerHTML = data;
        var elements = doc.getElementsByTagName(aTag);
        Array.prototype.forEach.call(elements, function (element) {
          if (aWalkerCallback(element))
            return;
        });
        if (aPostHook) {
          aPostHook();
        }
      }).error(function () {
        if (aErrorCallback) {
          aErrorCallback();
        }
      });
    }

    //START Retrieving data
    $http.get('data/dashboards.json').then(function (res){
      $rootScope.dashboards = res.data.dashboards;
      $rootScope.base_url = res.data.base_url;
      $rootScope.dashboard = $rootScope.dashboards[0];
    });

    $rootScope.parseAtAddress('http://ftp.mozilla.org/pub/mozilla.org/firefox/candidates/', 'a', undefined,
      function (link) {
        if (link.innerHTML && link.innerHTML.indexOf('-candidates') !== -1) {
          $rootScope.firefoxVersions.push(link.innerHTML.split('-candidates/')[0]);
        }
      },
      function () {
        $rootScope.firefoxVersions.sort(function (aFirstElement, aSecondElement) {
          return parseInt(aSecondElement) - parseInt(aFirstElement);
        });

        $rootScope.targetBuildVersion = $rootScope.firefoxVersions[0];
        $rootScope.updateTargetBuildNumber($rootScope.firefoxVersions[0]);

        $rootScope.parseAtAddress('http://ftp.mozilla.org/pub/mozilla.org/firefox/releases/', 'a', undefined,
          function (link) {
            if (link.innerHTML){
              var version = link.innerHTML.split('/')[0];
              if($rootScope.firefoxVersions.indexOf(version) !== -1) {
                $rootScope.firefoxVersionsTypes[$rootScope.firefoxVersions.indexOf(version)] = 'final';
              }
            }
          },
          function () {
            $rootScope.builds.forEach(function (build, buildIndex) {
              build.firefoxVersions.forEach(function (version, versionIndex) {
                if (!version.name) {
                  version.name = $rootScope.firefoxVersions[0];
                  version.type = 'final';
                  $rootScope.$emit('versionChanged',
                                   {versionIndex: versionIndex, buildIndex: buildIndex});
                }
              });
            });
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

    /**
     * Adds a new empty build
     */
    $scope.addBuild = function () {
      var version = {
        exists: STATE.NOT_CHECKED,
        name: ($rootScope.firefoxVersions.length) ? $rootScope.firefoxVersions[0] : "",
        type: $rootScope.firefoxVersionsTypes[0],
        locale: "",
        availableLocales: []
      };

      var newEmptyBuild = {
        firefoxVersions: [version],
        platform: $rootScope.platforms.filter(notAdded)[0]
      }

      // If we have only one available platform version we set the
      // platform as added too so we won't give it as an option anymore
      var availableVersions = newEmptyBuild.platform.versions.filter(notAdded);
      if (availableVersions.length === 1) {
        newEmptyBuild.platform.added = true;
      }
      newEmptyBuild.platformVersion = availableVersions[0];
      newEmptyBuild.platformVersion.added = true;

      $rootScope.builds.push(newEmptyBuild);

      // Watch when the platform version changes and it changes the "added" flag
      // which prevents us from adding the same platform version twice
      $scope.$watch(function () {
        return newEmptyBuild.platformVersion
      }, function (newVersion, oldVersion) {
        oldVersion.added = false;
        newVersion.added = true;
      });

      // Watch when the platform changes and it changes the "added" flag
      // which prevents us from adding the same platform twice
      $scope.$watch(function () {
        return newEmptyBuild.platform
      }, function (newVersion, oldVersion) {
        oldVersion.added = false;
        if (!newVersion.versions.filter(notAdded).length) {
          newVersion.added = true;
        }
      });
      $rootScope.$emit('versionChanged',
                       {versionIndex: 0, buildIndex: ($rootScope.builds.length -1)});
    }

    /**
     * Helper function to broadcast 'checkAll' so build directive can update itself
     */
    $scope.checkAll = function () {
      if ($rootScope.isUpdate() && $rootScope.retrieved_build_id === '...') {
        $scope.$emit('notify', {type: 'error',
                                message: "Target build-id has not been found"});
      }
      $rootScope.$broadcast('checkAll');
    }

    /**
     * Checks if the tipped locales are supported, if not it will get removed
     *
     * @param {number} aVersion
     *        Index of version
     */
    $rootScope.checkTargetBuild = function (aVersion) {
      var platforms = ['/linux_info.txt',
                       '/macosx64_info.txt',
                       '/win32_info.txt'];

      // Cancels the previous timeout handler
      $timeout.cancel($rootScope.targetChecker);
      $rootScope.target_build_id = "";
      // Setting a timeout handler to check the locales
      $rootScope.targetChecker = $timeout(function() {
        var version = aVersion.split('#')[0];
        var candidate = aVersion.split('#')[1];
        var re = /=(.*)/

        var found = false;
        function check(aPlatform) {
          $http({
            method: 'GET',
            url: 'http://ftp.mozilla.org/pub/mozilla.org/firefox/candidates/' + version + '-candidates/build' + candidate + aPlatform
          }).success(function (data) {
            $rootScope.target_build_id = re.exec(data)[1];
            if ($rootScope.isUpdate())
              $scope.$emit('notify', {type: 'success',
                                      message: "Target build Id has been found"});
            found = true;
          }).error(function () {
            check(platforms.pop());
          });
        };
        check(platforms.pop());

        $timeout(function() {
          if (!found && $rootScope.isUpdate()) {
            $scope.$emit('notify', {type: 'error',
                                    message: "Target build Id has not been found"});
          }
        }, TIMEOUT_CHECKING_LOCALES * 2);
      }, TIMEOUT_CHECKING_LOCALES, true);
    };

    /**
     * Clears all changes
     */
    $rootScope.clear = function () {
      $rootScope.testrun = $rootScope.testruns[0];
      $rootScope.dashboard = $rootScope.dashboards[0];
      $rootScope.target_build_id = "";
      $rootScope.updateChannel = "";
      $rootScope.platforms.forEach(function (platform) {
        platform.versions.forEach(function (version) {
          version.added = false
        });
        platform.added = false;
      });
      $rootScope.builds = [];
    }

    /**
     * Bootstrap the application by adding an new empty build
     */
    $scope.initForm = function () {
      if ($rootScope.builds.length < 1) {
        $scope.addBuild();
      }
    }

    /**
     * Checks if the current testrun is of an update type
     *
     * @returns {boolean}
     */
    $rootScope.isUpdate = function () {
      if ($rootScope.testrun)
        return $rootScope.testrun.script === 'update';
      else return false;
    }

    $rootScope.updateTargetBuildNumber = function (aVersion) {
      $rootScope.parseAtAddress("http://ftp.mozilla.org/pub/mozilla.org/firefox/candidates/" + aVersion + "-candidates/", "a", function () {
        $rootScope.target_build_numbers = [];
        $rootScope.target_build_id = "";
      }, function (link) {
        if (link.innerHTML && link.innerHTML.indexOf("build") !== -1) {
          $rootScope.target_build_numbers.push(link.innerHTML.split("/")[0]);
        }
      }, function () {
        $rootScope.target_build_number = $rootScope.target_build_numbers[$rootScope.target_build_numbers.length - 1];
        $rootScope.checkTargetBuild(aVersion + "#" + $rootScope.target_build_number.split("build")[1]);
      });
    }
}]);
