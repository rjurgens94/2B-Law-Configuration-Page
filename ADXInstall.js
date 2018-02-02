///<reference path="../adx_framework/adx.xrm.ts"/>
///<reference path="adx.configuration.ts"/>
///<reference path="adx.xrm.packages.ts"/>
///<reference path="adx.xrm.solutions.ts"/>
///<reference path="adx.xrm.repositories.ts"/>
var adx;
(function (adx) {
    var xrm;
    (function (xrm) {
        var installer;
        (function (installer) {
            var _ = window["_"];
            var $ = window["$"];
            var installedSolutions = [];
            var packagesToImport = [];
            var orderedPackagesToImport = [];
            var repositories = []; // TODO: Persist these for re-entry
            var installCount = 0;
            var activeRepository = null;
            var installerVersion = null;
            var existingWebsites = [];
            function initialize() {
                $(document).ready(function () {
                    if (!validateBrowser()) {
                        return;
                    }
                    license.initialize();
                    if (!license.validate()) {
                        return;
                    }
                    $("#repositories").empty();
                    $.validator.addMethod("uniqueWebsite", function (value) {
                        // check possible duplicate entry
                        var userSpecifiedNameCount = 0;
                        $("#attribute-value-assignment input[data-entity='adx_website'][data-attribute='adx_name']").each(function () {
                            if ($(this).val() == value) {
                                userSpecifiedNameCount++;
                            }
                        });
                        if (userSpecifiedNameCount > 1)
                            return false;
                        // check existing data
                        var existingWebsiteNames = [];
                        $.each(existingWebsites, function (websiteIndex, website) {
                            if (typeof website.attributes.adx_name != 'undefined') {
                                existingWebsiteNames[existingWebsiteNames.length++] = website.attributes.adx_name;
                            }
                        });
                        return !_.contains(existingWebsiteNames, value);
                    }, 'A website with that name already exists. Please specify a different name.');
                    getInstalledSolutions().then(function () {
                        return LoadGalleryRepositories().then(function (repositoryList) {
                            if (typeof repositoryList != 'undefined' && repositoryList != null) {
                                $.each(repositoryList, function (repIndex, rep) {
                                    if (typeof rep.Manifest != 'undefined' && rep.Manifest != null) {
                                        addRepository(rep);
                                    }
                                });
                            }
                            if (!repositories || repositories.length == 0) {
                                // If repositories could not be retrieved from the discovery service, then load the main repository from static setting
                                var settings = new adx.configuration.settings();
                                var repository = new adx.xrm.repositories.repository(settings.URL);
                                window.console.log("Loading repository from URL defined in local settings " + settings.URL);
                                repository.load(installerVersion).then(function () {
                                    repository.render();
                                    addRepository(repository);
                                    setActiveRepository(repository);
                                    activateRegisteredProtocol();
                                    $("#repositories .packages button[type='button']").prop('disabled', false);
                                    $("#install").prop('disabled', false);
                                    checkForInstallerUpdate();
                                    adx.xrm.installer.ui.hideLoading();
                                }, function () {
                                    adx.xrm.installer.ui.showTemplateMessage("#load-repository-failure", "", "", true, false, {});
                                });
                                return;
                            }
                            setActiveRepository(repositories[0]);
                            activateRegisteredProtocol();
                            updateSolutionDetailsWithInstalledInfo();
                            $("#repositories .packages button[type='button']").prop('disabled', false);
                            $("#install").prop('disabled', false);
                            checkForInstallerUpdate();
                            adx.xrm.installer.ui.hideLoading();
                        });
                    });
                    $("#repositories .packages div.desc").on("show.bs.collapse", function () {
                        $(this).parent().find("i.fa.fa-caret-right").removeClass("fa-caret-right").addClass("fa-caret-down");
                    }).on("hide.bs.collapse", function (e) {
                        $(this).parent().find("i.fa.fa-caret-down").removeClass("fa-caret-down").addClass("fa-caret-right");
                    });
                    $(document).on("click", "#repositories .packages button[type=button]", function (e) {
                        e.preventDefault();
                        var $button = $(this);
                        if ($button.attr("data-type") == "update") {
                            $button.toggleClass("btn-info");
                        }
                        $button.toggleClass("btn-success");
                        $button.toggleClass("select");
                        adx.xrm.installer.updatePackageAction($button);
                    });
                    $(document).on("click", "#view-repository li a", function (e) {
                        e.preventDefault();
                        var uri = $(this).attr("data-id");
                        var index = adx.xrm.indexOf(repositories, "URI", uri);
                        if (index != -1) {
                            var rep = repositories[index];
                            setActiveRepository(rep);
                            unhideNonActivePackages();
                        }
                    });
                    $(document).on("click", "#repositories .packages a[data-toggle='collapse']", function (e) {
                        e.preventDefault();
                    });
                    $("#view-repository-link").on("click", function (e) {
                        e.preventDefault();
                        if ($(this).hasClass("disabled")) {
                            return;
                        }
                    });
                    $("#install-list-count").on("click", function (e) {
                        e.preventDefault();
                        if ($(this).hasClass("disabled")) {
                            return;
                        }
                        displayInstallQueue();
                    });
                    $("#install").click(function (e) {
                        e.preventDefault();
                        packages.imports.execute();
                    });
                    $("#add-repository-url").click(function (e) {
                        e.preventDefault();
                        if ($(this).is(":disabled")) {
                            return;
                        }
                        var $input = $("#input-repository-url");
                        if ($input.length == 0) {
                            return;
                        }
                        var uri = $input.val();
                        if (!uri || uri == "") {
                            return;
                        }
                        AddNewGalleryURI(uri);
                        $input.val('');
                    });
                });
                function activateRegisteredProtocol() {
                    var search = window.location.search;
                    if (!search) {
                        return;
                    }
                    var query = decodeURIComponent(search);
                    if (query.indexOf("data=web+adxstudioinstaller") == -1) {
                        return;
                    }
                    var uri = query.replace("?data=web+adxstudioinstaller:", "");
                    uri = decodeURIComponent(decodeURIComponent(uri));
                    AddNewGalleryURI(uri);
                }
                function confirmExit() {
                    var confirm = $("body").attr("data-confirm-exit");
                    if (confirm == "enabled") {
                        var message = "You have attempted to leave or refresh this page. Your installation may not complete. To stay on the page to to complete the installation, click Stay.";
                        return message;
                    }
                }
                ;
                window.onbeforeunload = confirmExit;
                function validateBrowser() {
                    var ua = window.navigator.userAgent;
                    var msie = ua.indexOf("MSIE ");
                    if (msie > 0) {
                        var msieVersion = parseInt(ua.substring(msie + 5, ua.indexOf(".", msie)));
                        if (msieVersion < 10) {
                            adx.xrm.installer.ui.showErrorOverlay("#browser-ieversionfailure");
                            return false;
                        }
                    }
                    return true;
                }
            }
            installer.initialize = initialize;
            function AddNewGalleryURI(uri) {
                if (!adx.xrm.validateURI(uri)) {
                    adx.xrm.installer.ui.showErrorMessage("Failed to add new gallery URI [" + uri + "]. Format is invalid. ", true, false, true);
                    window.console.error("Failed to add new gallery URI. Format is invalid. " + uri);
                    return;
                }
                var url = GetRepositoryURLFromGalleryURI(uri);
                var packageURI = GetPackageURIFromGalleryURI(uri);
                var index = adx.xrm.indexOf(repositories, "URI", url);
                if (index != -1) {
                    // repository has already been added
                    setActiveRepository(repositories[index]);
                    if (packageURI) {
                        setActivePackage(packageURI);
                    }
                }
                else {
                    // repository has not been added yet
                    var newRepository = new adx.xrm.repositories.repository(url);
                    newRepository.load(installerVersion).then(function () {
                        newRepository.render();
                        addRepository(newRepository);
                        setActiveRepository(newRepository);
                        if (packageURI) {
                            setActivePackage(packageURI);
                        }
                        adx.xrm.installer.updateSolutionDetailsWithInstalledInfo();
                    }, function () { adx.xrm.installer.ui.showTemplateMessage("#load-repository-failure", "", "", true, false, {}); });
                }
            }
            installer.AddNewGalleryURI = AddNewGalleryURI;
            function GetRepositoryURLFromGalleryURI(uri) {
                if (uri.indexOf("#") == -1) {
                    return uri;
                }
                var url = uri.substring(0, uri.indexOf('#'));
                if (window.location.protocol == "https:") {
                    url = url.replace(/^http:\/\//i, 'https://');
                }
                return url;
            }
            installer.GetRepositoryURLFromGalleryURI = GetRepositoryURLFromGalleryURI;
            function GetPackageURIFromGalleryURI(uri) {
                if (uri.indexOf("#") == -1) {
                    return "";
                }
                return uri.substring(uri.indexOf('#'));
            }
            installer.GetPackageURIFromGalleryURI = GetPackageURIFromGalleryURI;
            function LoadGalleryRepositories() {
                var _this = this;
                var settings = new adx.configuration.settings();
                var deferred = $.Deferred();
                $.ajax({
                    type: "GET",
                    dataType: 'json',
                    url: settings.RepositoryDiscoveryURL
                }).done(function (json) {
                    if (!json || !json.Repositories || json.Repositories.length == 0) {
                        window.console.error("Repository discovery service response is null.");
                        deferred.resolve();
                        return;
                    }
                    if (!json.hasOwnProperty("Repositories")) {
                        window.console.error("Repository discovery service data format is invalid.");
                        deferred.resolve();
                        return;
                    }
                    var deferredCollection = [];
                    var remaining = 0;
                    var repositoryList = [];
                    $.each(json.Repositories, function (repIndex, rep) {
                        var repository = new adx.xrm.repositories.repository(rep.URL);
                        repositoryList.push(repository);
                        deferredCollection.push(repository.load(installerVersion).then(function () {
                            if (typeof repository.Manifest != 'undefined' && repository.Manifest != null) {
                                repository.render();
                                repository.hide();
                            }
                        }, function () { window.console.error("Repository failed to load. Either the URL is invalid or the service is not responding. " + rep.URL); }).always(function () {
                            remaining--;
                            if (!remaining)
                                deferred.resolve(repositoryList);
                        }));
                    });
                    remaining = deferredCollection.length;
                    $.when.apply(_this, deferredCollection).then(function () {
                        deferred.resolve(repositoryList);
                    });
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    window.console.error("Repository discovery service failed to load. Make sure your internet connection is working and try again. " + errorThrown);
                    deferred.resolve(errorThrown);
                });
                return deferred.promise();
            }
            installer.LoadGalleryRepositories = LoadGalleryRepositories;
            function getInstalledSolutions() {
                var deferred = $.Deferred();
                adx.xrm.solutions.getInstalledSolutions()
                    .then(function (response) {
                        if (!response || !response.results || !response.results.EntityCollection || !response.results.EntityCollection.entities || response.results.EntityCollection.entities.length == 0) {
                            deferred.resolve();
                            return;
                        }
                        var solutions = response.results.EntityCollection.entities;
                        for (var i = 0, j = solutions.length; i < j; i++) {
                            var solution = solutions[i];
                            var solutionPkg = new adx.xrm.packages.pkg("", solution.attributes.uniquename, solution.attributes.friendlyname, solution.attributes.version, "Solution", "", "", "", {}, []);
                            installedSolutions[i] = solutionPkg;
                            if (solutionPkg.UniqueName == "AdxstudioInstaller") {
                                installerVersion = solutionPkg.Version;
                            }
                        }
                        deferred.resolve();
                    }, function (exception) {
                        deferred.resolve(exception);
                        adx.xrm.installer.ui.showErrorMessage(exception);
                    });
                return deferred.promise();
            }
            installer.getInstalledSolutions = getInstalledSolutions;
            function checkForInstallerUpdate() {
                var installerPackage = getPackageByUniqueNameFromRepositories("AdxstudioInstaller");
                if (installerPackage == null) {
                    window.console.error("Repository manifests loaded do not contain a definition for AdxstudioInstaller.");
                    return;
                }
                var installerSolution = getSolutionByUniqueNameFromInstalledSolutions("AdxstudioInstaller");
                if (installerSolution == null) {
                    window.console.error("Installed solutions did not contain AdxstudioInstaller.");
                    return;
                }
                installerVersion = installerSolution.Version;
                $("#version").text("v" + installerVersion);
                var versionComparison = adx.xrm.versionCompare(installerSolution.Version, installerPackage.Version);
                if (versionComparison == -1) {
                    window.console.log("AdxstudioInstaller (" + installerSolution.Version + ") solution installed has a new version available (" + installerPackage.Version + ").");
                    var source = $("#installer-update-message-template").html();
                    var template = Handlebars.compile(source);
                    var data = {
                        Name: "Adxstudio Installer",
                        CurrentVersion: installerSolution.Version,
                        NewVersion: installerPackage.Version
                    };
                    DisableControls();
                    $("<div />").addClass("message").html(template(data)).appendTo("#messages").show();
                    $("#repositories").hide();
                    $("#update-installer").on("click", function (e) {
                        e.preventDefault();
                        $("#repositories .packages button[type=button][data-id='" + installerPackage.URI + "']").addClass("active");
                        packages.imports.execute();
                    });
                }
                else {
                    window.console.log("AdxstudioInstaller (" + installerSolution.Version + ") solution installed is up to date.");
                }
            }
            installer.checkForInstallerUpdate = checkForInstallerUpdate;
            function setActivePackage(uri) {
                var $button = $("#repositories .packages button[type=button][data-id='" + uri + "']");
                if ($button.attr("data-type") == "update") {
                    $button.removeClass("btn-info");
                }
                $button.addClass("active").addClass("btn-success").addClass("select");
                adx.xrm.installer.updatePackageAction($button);
                hideNonActivePackages();
                $("#repositories .packages tr[data-id='" + uri + "'] .desc.collapse").addClass("in");
            }
            installer.setActivePackage = setActivePackage;
            function hideNonActivePackages() {
                if (activeRepository == null) {
                    return;
                }
                $("#repositories .repository[data-id='" + activeRepository.URI + "'] .packages button[type=button]:not(.active)").parents("tr").hide();
            }
            installer.hideNonActivePackages = hideNonActivePackages;
            function unhideNonActivePackages() {
                if (activeRepository == null) {
                    return;
                }
                $("#repositories .repository[data-id='" + activeRepository.URI + "'] .packages button[type=button]:not(.active)").parents("tr").show();
            }
            installer.unhideNonActivePackages = unhideNonActivePackages;
            function setActiveRepository(repository) {
                if (!repository) {
                    window.console.error("Could not set active repository. Repository is undefined");
                    return;
                }
                activeRepository = repository;
                $("#view-repository-title").text(activeRepository.Title);
                activeRepository.show();
                $.each(repositories, function (i, repos) {
                    if (repos.URI != activeRepository.URI) {
                        repos.hide();
                    }
                });
            }
            installer.setActiveRepository = setActiveRepository;
            function addRepository(repository) {
                var index = adx.xrm.indexOf(repositories, "URI", repository.URI);
                if (index == -1) {
                    repositories[repositories.length] = repository;
                }
                else {
                    repositories[index] = repository;
                }
                if ($("#view-repository li a[data-id='" + repository.URI + "']").length == 0) {
                    $("#view-repository").append("<li><a href='#' data-id='" + repository.URI + "'>" + repository.Title + "</a></li>");
                }
            }
            installer.addRepository = addRepository;
            function getPackageByIdFromRepositories(id) {
                var packages = [];
                $.each(repositories, function (i, r) {
                    if (r.Manifest != null) {
                        $.merge(packages, r.Manifest.Packages);
                    }
                });
                var index = adx.xrm.packages.getPackageIndex(packages, id);
                if (index >= 0) {
                    var pkg = packages[index];
                    return pkg;
                }
                else {
                    return null;
                }
            }
            installer.getPackageByIdFromRepositories = getPackageByIdFromRepositories;
            function getPackageByUniqueNameFromRepositories(uniqueName) {
                var packages = [];
                $.each(repositories, function (i, r) {
                    if (r.Manifest != null) {
                        $.merge(packages, r.Manifest.Packages);
                    }
                });
                var index = adx.xrm.indexOf(packages, "UniqueName", uniqueName);
                if (index >= 0) {
                    var pkg = packages[index];
                    return pkg;
                }
                else {
                    return null;
                }
            }
            installer.getPackageByUniqueNameFromRepositories = getPackageByUniqueNameFromRepositories;
            function getSolutionByUniqueNameFromInstalledSolutions(uniqueName) {
                var index = adx.xrm.indexOf(installedSolutions, "UniqueName", uniqueName);
                if (index >= 0) {
                    var solution = installedSolutions[index];
                    return solution;
                }
                else {
                    return null;
                }
            }
            installer.getSolutionByUniqueNameFromInstalledSolutions = getSolutionByUniqueNameFromInstalledSolutions;
            function displayInstallQueue() {
                var $dialog = $("#install-queue");
                var $content = $dialog.find(".modal-body").empty();
                if (installCount > 0) {
                    var packages = getOrderPackagesToBeInstalled();
                    var source = $("#install-queue-template").html();
                    Handlebars.registerHelper('package_icon', function (options) {
                        switch (this.Type) {
                            case "Data":
                                return "<i class='fa fa-files-o'></i>";
                            case "Solution":
                                return "<i class='fa fa-cog'></i>";
                            default:
                                return "";
                        }
                    });
                    var template = Handlebars.compile(source);
                    var data = {
                        count: installCount,
                        Packages: packages
                    };
                    $("<div />").html(template(data)).appendTo($content);
                }
                else {
                    $("<div />").html("<p>There are no items to be installed.</p>").appendTo($content);
                }
                $dialog.modal("show");
            }
            function updatePackageAction($button) {
                var currentPackage = getPackageByIdFromRepositories($button.attr("data-id"));
                var selectedPackages = [];
                var selectedPackagesIndex = 0;
                $("#repositories .packages button[type=button]").each(function () {
                    if ($(this).hasClass("active")) {
                        var selectedPackage = getPackageByIdFromRepositories($(this).attr("data-id"));
                        selectedPackages[selectedPackagesIndex] = selectedPackage;
                        selectedPackagesIndex++;
                        // auto activate component install
                        $(this).parents("tr").find(".components button[type=button]").each(function () {
                            if ($button.attr("data-id") != $(this).attr("data-id")) {
                                $(this).addClass("active").addClass("btn-success");
                            }
                        });
                    }
                    else {
                        $(this).parents("tr").find(".components button[type=button]").each(function () {
                            if ($button.attr("data-id") != $(this).attr("data-id")) {
                                $(this).removeClass("active").removeClass("btn-success");
                            }
                        });
                    }
                });
                if (!$button.hasClass("component")) {
                    var pendingOrInstalledSolutions = adx.xrm.packages.Union(installedSolutions, selectedPackages);
                    if ($button.hasClass("active")) {
                        if (currentPackage.Dependencies.length == 0) {
                            updateInstallCount();
                            return;
                        }
                        var missingDependencies = [];
                        var missingDependenciesIndex = 0;
                        $.each(currentPackage.Dependencies, function (dependencyIndex, dependency) {
                            var dependencyFound = false;
                            var dependencyPackage = getDependencyPackageDefinition(dependency);
                            $.each(pendingOrInstalledSolutions, function (pendingOrInstalledSolutionIndex, pendingOrInstalledSolution) {
                                if (pendingOrInstalledSolution.URI == dependencyPackage.URI || pendingOrInstalledSolution.UniqueName == dependencyPackage.UniqueName) {
                                    var versionComparison = adx.xrm.versionCompare(pendingOrInstalledSolution.Version, dependencyPackage.Version);
                                    if (versionComparison == 0 || versionComparison == 1) {
                                        // Version of the pending or installed solution is equal to or greater than the dependency version
                                        dependencyFound = true;
                                        // disable dependency from being removed
                                        addDependencyInfo(currentPackage, dependencyPackage);
                                    }
                                }
                            });
                            if (!dependencyFound) {
                                missingDependencies[missingDependenciesIndex] = dependency;
                                missingDependenciesIndex++;
                            }
                        });
                        if (missingDependencies.length > 0) {
                            // disable dependencies from being removed
                            $.each(missingDependencies, function (missingDependencyIndex, missingDependency) {
                                var missingDependencyPackage = getDependencyPackageDefinition(missingDependency);
                                addDependencyInfo(currentPackage, missingDependencyPackage);
                            });
                        }
                        updateInstallCount();
                        return;
                    }
                    $.each(currentPackage.Dependencies, function (dependencyIndex, dependency) {
                        // enable dependencies now that the dependent item has been removed
                        removeDependencyInfo(currentPackage, dependency);
                    });
                }
                else {
                    var $parentButton = $button.parents("tr").find("button[type=button]:not(.component)");
                    updatePackageAction($parentButton);
                }
                updateInstallCount();
            }
            installer.updatePackageAction = updatePackageAction;
            function addDependencyInfo(dependentPackage, dependencyPackage) {
                var $btn = $("#repositories .packages button[type=button][data-id='" + dependencyPackage.URI + "']");
                if ($btn && $btn.length > 0) {
                    $btn.addClass("active").addClass("btn-success").attr("disabled", "disabled");
                    if ($btn.attr("data-type") == "update") {
                        $btn.removeClass("btn-info");
                    }
                    // auto activate component install
                    $btn.parents("tr").find(".components button[type=button]").each(function () {
                        if ($btn.attr("data-id") != $(this).attr("data-id")) {
                            $(this).addClass("active").addClass("btn-success");
                        }
                    });
                    // Update dependency info
                    var $row = $("#repositories .packages tr[data-id='" + dependencyPackage.URI + "']");
                    var $info = $row.find("h3.dependencyinfo");
                    if ($info && $info.length > 0) {
                        var dependents = $info.attr("data-dependents");
                        if (dependents) {
                            if (!dependents.match(/,\s*$/)) {
                                dependents = dependents + ",";
                            }
                            if (dependents.indexOf(dependentPackage.DisplayName + ",") == -1) {
                                var dependentsArray = dependents.split(',');
                                var dataDependentsArray = _.without(dependentsArray, "");
                                dataDependentsArray[dataDependentsArray.length] = dependentPackage.DisplayName;
                                var dependentsString = dataDependentsArray.join();
                                var $dependencyList = $("<ul/>").addClass("dependencyinfo");
                                $.each(dataDependentsArray, function (i, dependencyName) {
                                    $dependencyList.append("<li>" + dependencyName + "</li>");
                                });
                                var $dependencyHtml = $("<div><h5>Required by</h5></div>").append($dependencyList);
                                $info.attr("data-dependents", dependentsString);
                                $info.popover("destroy");
                                $info.popover({ html: true, content: $dependencyHtml.html() });
                            }
                        }
                    }
                    else {
                        $row.find("td").first().next().next().next().html("<h3 class='text-primary dependencyinfo' style='margin:0;cursor:pointer;' data-dependents='" + dependentPackage.DisplayName + "' data-toggle='popover' data-original-title='Dependency Info' data-placement='left'><i class='fa fa-info-circle'></i></h3>");
                        var $list = $("<ul/>").addClass("dependencyinfo");
                        $list.append("<li>" + dependentPackage.DisplayName + "</li>");
                        var $popoverHtml = $("<div><h5>Required by</h5></div>").append($list);
                        $row.find("h3.dependencyinfo").popover({ html: true, content: $popoverHtml.html() });
                    }
                }
                // add dependency info for each dependency package's dependencies
                $.each(dependencyPackage.Dependencies, function (dependencyIndex, dependency) {
                    var pkg = getDependencyPackageDefinition(dependency);
                    addDependencyInfo(dependencyPackage, pkg);
                });
            }
            installer.addDependencyInfo = addDependencyInfo;
            function removeDependencyInfo(pkg, dependency) {
                var $btn = $("#repositories .packages button[type=button][data-id='" + dependency.URI + "']");
                if ($btn.hasClass("active")) {
                    var $row = $("#repositories .packages tr[data-id='" + dependency.URI + "']");
                    var $info = $row.find("h3.dependencyinfo");
                    if ($info && $info.length > 0) {
                        var dependents = $info.attr("data-dependents");
                        if (!dependents) {
                            resetPackageButton($btn);
                            $info.popover("destroy");
                            $row.find("td").first().next().next().next().empty();
                            return;
                        }
                        var dependentsArray = dependents.split(',');
                        if (dependentsArray.length > 1) {
                            var newDependentsArray = _.without(dependentsArray, pkg.DisplayName);
                            var dataDependentsArray = _.without(newDependentsArray, " ");
                            var dependentsString = dataDependentsArray.join();
                            var $list = $("<ul/>").addClass("dependencyinfo");
                            $.each(dataDependentsArray, function (i, d) {
                                $list.append("<li>" + d + "</li>");
                            });
                            var $dependencyHtml = $("<div><h5>Required by</h5></div>").append($list);
                            $info.attr("data-dependents", dependentsString);
                            $info.popover("destroy");
                            $info.popover({ html: true, content: $dependencyHtml.html() });
                        }
                        else {
                            resetPackageButton($btn);
                            $info.popover("destroy");
                            $info.remove();
                        }
                    }
                    else {
                        resetPackageButton($btn);
                    }
                }
            }
            installer.removeDependencyInfo = removeDependencyInfo;
            function resetPackageButton($btn) {
                $btn.removeAttr("disabled");
            }
            installer.resetPackageButton = resetPackageButton;
            function removeAllInactiveDependencies() {
                $("#repositories .packages button[type=button]:not(.active)").each(function (i) {
                    var $row = $(this).parents("tr");
                    var $info = $row.find("h3.dependencyinfo");
                    if ($info && $info.length > 0) {
                        $info.popover("destroy");
                        $info.remove();
                    }
                });
            }
            installer.removeAllInactiveDependencies = removeAllInactiveDependencies;
            function getDependencyPackageDefinition(dependency) {
                var pkg = getPackageByIdFromRepositories(dependency.URI);
                if (pkg != null) {
                    return pkg;
                }
                return new adx.xrm.packages.pkg(dependency.URI, "", dependency.DisplayName, dependency.Version, "");
            }
            installer.getDependencyPackageDefinition = getDependencyPackageDefinition;
            function updateSolutionDetailsWithInstalledInfo() {
                if (installedSolutions.length == 0) {
                    return;
                }
                var installerUpdateRequired = false;
                var updatesAvailable = false;
                var $packages = $("#repositories .packages tbody");
                for (var i = 0, j = installedSolutions.length; i < j; i++) {
                    var packages = [];
                    $.each(repositories, function (k, r) {
                        if (r.Manifest != null) {
                            $.merge(packages, r.Manifest.Packages);
                        }
                    });
                    var index = adx.xrm.indexOf(packages, "UniqueName", installedSolutions[i].UniqueName);
                    if (index == -1) {
                        continue; // ignore - installed solution is not in the repository listing
                    }
                    var pkg = packages[index];
                    var $row = $packages.find("tr[data-id='" + pkg.URI + "']");
                    var versionComparison = adx.xrm.versionCompare(installedSolutions[i].Version, pkg.Version);
                    switch (versionComparison) {
                        case -1:
                            $row.find("td").first().next().html("<span class='text-info'>" + pkg.Version + "</span>");
                            $row.find("td").first().next().next().html("<button type='button' name='packages' class='btn btn-info btn-sm option' data-toggle='button' data-type='update' data-id='" + pkg.URI + "' value='" + index + "'>Update</button>");
                            $row.find("td").first().next().next().next().html("<h3 class='text-info versioninfo' style='margin:0;cursor:pointer;' data-toggle='popover' data-original-title='Version Info' data-placement='left'><i class='fa fa-info-circle'></i></h3>");
                            var $popoverHtml = $("<div><p>Version installed is " + installedSolutions[i].Version + "</p><p>An update to version " + pkg.Version + " is available.</p></div>");
                            $row.find("h3.versioninfo").popover({ html: true, content: $popoverHtml.html() });
                            if (installedSolutions[i].UniqueName == "AdxstudioInstaller") {
                                installerUpdateRequired = true;
                            }
                            updatesAvailable = true;
                            break;
                        case 0:
                            $row.addClass("active");
                            $row.find("td").first().next().addClass("text-muted").text(installedSolutions[i].Version);
                            $row.find("td").first().next().next().addClass("text-muted").text("Installed");
                            break;
                        case 1:
                            $row.find("td").first().next().html("<span class='text-warning'>" + installedSolutions[i].Version + "</span>");
                            $row.find("td").first().next().next().text("Installed");
                            $row.find("td").first().next().next().next().html("<h3 class='text-warning versioninfo' style='margin:0;cursor:pointer;' ' data-content='Version installed " + installedSolutions[i].Version + " is newer than the available version " + pkg.Version + "' ' data-toggle='popover' data-original-title='Version Info' data-placement='left'><i class='fa fa-info-circle'></i></h3>");
                            $row.find("h3.versioninfo").popover();
                            break;
                    }
                }
                if (!installerUpdateRequired && updatesAvailable) {
                    $("#select-all-updates").removeAttr("disabled");
                    $(document).off("click", "#select-all-updates");
                    $(document).on("click", "#select-all-updates", function (e) {
                        e.preventDefault();
                        if ($(this).attr("data-state") == "select") {
                            $("#repositories .packages button[data-type=update]").addClass("active").removeClass("btn-info").addClass("btn-success");
                            $(this).attr("data-state", "unselect").text("Unselect all updates");
                        }
                        else {
                            $("#repositories .packages button[data-type=update]").removeClass("active").removeClass("btn-success").addClass("btn-info").removeAttr("disabled");
                            $(this).attr("data-state", "select").text("Select all updates");
                        }
                        updateInstallCount();
                    });
                }
                if ($("#repositories .packages button[type=button]").length == 0) {
                    $("#install").prop('disabled', true);
                    $("#select-all-updates").prop('disabled', true);
                }
            }
            installer.updateSolutionDetailsWithInstalledInfo = updateSolutionDetailsWithInstalledInfo;
            function updateInstallCount() {
                var list = _.map($("#repositories .packages button[type=button].active"), function (e) { return $(e).data("id"); });
                var uniqueList = _.uniq(list);
                var count = uniqueList.length;
                if (count >= 0) {
                    installCount = count;
                }
                else {
                    installCount = 0;
                }
                $("#install-count").text(installCount);
            }
            installer.updateInstallCount = updateInstallCount;
            function resetInstallCount() {
                installCount = 0;
                $("#install-count").text(installCount);
            }
            installer.resetInstallCount = resetInstallCount;
            function getPackagesToBeInstalled() {
                var selectedPackages = [];
                var selectedPackagesIndex = 0;
                $("#repositories .packages button[type=button].active").each(function () {
                    var selectedPackage = getPackageByIdFromRepositories($(this).attr("data-id"));
                    selectedPackages[selectedPackagesIndex] = selectedPackage;
                    selectedPackagesIndex++;
                });
                return selectedPackages;
            }
            installer.getPackagesToBeInstalled = getPackagesToBeInstalled;
            function getOrderPackagesToBeInstalled() {
                var packages = getPackagesToBeInstalled();
                if (packages.length == 0) {
                    return [];
                }
                var orderedPackages = [];
                $.each(packages, function (packageIndex, pkg) {
                    // Order packages to be imported based on the order of dependencies
                    if (adx.xrm.indexOf(orderedPackages, "URI", pkg.URI) != -1) {
                        // package is already in the ordered list
                        return true;
                    }
                    if (pkg.Dependencies.length == 0) {
                        orderedPackages[orderedPackages.length] = pkg;
                        return true;
                    }
                    var dependenciesValid = false;
                    $.each(pkg.Dependencies, function (dependencyIndex, dependency) {
                        var dependencyPackage = new adx.xrm.packages.pkg(dependency.URI, "", dependency.DisplayName, dependency.Version, "");
                        if (adx.xrm.indexOf(orderedPackages, "URI", dependencyPackage.URI) != -1) {
                            // package is already in the ordered list
                            dependenciesValid = true;
                            return true;
                        }
                        var manifestDependencyPackage = getPackageByIdFromRepositories(dependencyPackage.URI);
                        if (manifestDependencyPackage == null) {
                            // package definition could not be found in the manifest
                            dependenciesValid = false;
                            return true;
                        }
                        if (adx.xrm.indexOf(packages, "URI", dependencyPackage.URI) == -1) {
                            // package is not in the list to be installed
                            if (adx.xrm.indexOf(installedSolutions, "UniqueName", manifestDependencyPackage.UniqueName) == -1) {
                                // package is not installed
                                dependenciesValid = false;
                                return true;
                            }
                            // package is already installed
                            dependenciesValid = true;
                            return true;
                        }
                        orderedPackages[orderedPackages.length] = manifestDependencyPackage;
                        dependenciesValid = true;
                        return true;
                    });
                    if (!dependenciesValid) {
                        return true;
                    }
                    orderedPackages[orderedPackages.length] = pkg;
                    return true;
                });
                return orderedPackages;
            }
            installer.getOrderPackagesToBeInstalled = getOrderPackagesToBeInstalled;
            function EnableControls() {
                $("#install").prop('disabled', false);
                $("#select-all-updates").prop('disabled', false);
                $("#repositories.packages button[type='button']").prop('disabled', false);
                $("#view-repository-link").removeClass("disabled").removeClass("text-muted");
                $("#install-list-count").removeClass("disabled").removeClass("text-muted").addClass("text-primary");
                $("#input-repository-url").prop('disabled', false);
                $("#add-repository-url").prop('disabled', false);
                $(".navbar-nav").removeClass("disabled");
            }
            installer.EnableControls = EnableControls;
            function DisableControls() {
                $("#install").prop('disabled', true);
                $("#select-all-updates").prop('disabled', true);
                $("#messages .message").slideUp(100);
                $("#repositories.packages button[type='button']").prop('disabled', true);
                $("#view-repository-link").addClass("disabled").addClass("text-muted");
                $("#install-list-count").addClass("disabled").addClass("text-muted").removeClass("text-primary");
                $("#input-repository-url").prop('disabled', true);
                $("#add-repository-url").prop('disabled', true);
                $(".navbar-nav").addClass("disabled");
            }
            installer.DisableControls = DisableControls;
            function writeImportLogFile(xml) {
                var parts = [xml];
                var blob = new Blob(parts, { type: 'application/vnd.ms-excel' });
                window.saveAs(blob, "importlog.xml");
            }
            installer.writeImportLogFile = writeImportLogFile;
            function writeDataImportLogFile(json) {
                var parts = [json];
                var blob = new Blob(parts, { type: 'text/plain' });
                window.saveAs(blob, "importlog.txt");
            }
            installer.writeDataImportLogFile = writeDataImportLogFile;
            var packages;
            (function (packages) {
                var imports;
                (function (imports) {
                    var progress;
                    var packagesRequiringUserInput = [];
                    var packagesRequiringWebsiteAssignment = [];
                    var packagesRequiringAttributeAssignment = [];
                    var uniquePackagesRequiringWebsiteAssignment = [];
                    var uniquePackagesRequiringAttributeAssignment = [];
                    var websiteId = null;
                    var produceDataIdMappings = false;
                    function execute() {
                        $('#messages').empty();
                        progress = new ui.progress(0);
                        packagesToImport = getPackagesToBeInstalled();
                        if (packagesToImport.length == 0) {
                            return;
                        }
                        var orderedPackagesToImportIndex = 0;
                        var valid = false;
                        orderedPackagesToImport = [];
                        packagesRequiringUserInput = [];
                        packagesRequiringWebsiteAssignment = [];
                        packagesRequiringAttributeAssignment = [];
                        uniquePackagesRequiringWebsiteAssignment = [];
                        uniquePackagesRequiringAttributeAssignment = [];
                        $.each(packagesToImport, function (packageIndex, pkg) {
                            if (pkg.ReferenceReplacementTargets && pkg.ReferenceReplacementTargets.length > 0) {
                                packagesRequiringWebsiteAssignment[packagesRequiringWebsiteAssignment.length++] = pkg;
                                packagesRequiringUserInput[packagesRequiringUserInput.length++] = pkg;
                            }
                            if (pkg.AttributeReplacementTargets && pkg.AttributeReplacementTargets.length > 0) {
                                packagesRequiringAttributeAssignment[packagesRequiringAttributeAssignment.length++] = pkg;
                                packagesRequiringUserInput[packagesRequiringUserInput.length++] = pkg;
                            }
                            // Order packages to be imported based on the order of dependencies
                            if (adx.xrm.indexOf(orderedPackagesToImport, "URI", pkg.URI) != -1) {
                                // package is already in the ordered list
                                valid = true;
                                return true;
                            }
                            if (pkg.Dependencies.length == 0) {
                                orderedPackagesToImport[orderedPackagesToImportIndex] = pkg;
                                orderedPackagesToImportIndex++;
                                valid = true;
                                return true;
                            }
                            var dependenciesValid = false;
                            $.each(pkg.Dependencies, function (dependencyIndex, dependency) {
                                var dependencyPackage = new adx.xrm.packages.pkg(dependency.URI, "", dependency.DisplayName, dependency.Version, "");
                                if (adx.xrm.indexOf(orderedPackagesToImport, "URI", dependencyPackage.URI) != -1) {
                                    // package is already in the ordered list
                                    dependenciesValid = true;
                                    return true;
                                }
                                var manifestDependencyPackage = getPackageByIdFromRepositories(dependencyPackage.URI);
                                if (!manifestDependencyPackage) {
                                    // package definition could not be found in the manifest
                                    ui.showErrorMessage("<strong>" + pkg.DisplayName + "</strong> has a missing dependency. <strong>" + dependencyPackage.DisplayName + "</strong> is not installed and is not available to be installed by this application. ");
                                    dependenciesValid = false;
                                    return false;
                                }
                                if (adx.xrm.indexOf(packagesToImport, "URI", dependencyPackage.URI) == -1) {
                                    // package is not in the list to be installed
                                    if (adx.xrm.indexOf(installedSolutions, "UniqueName", manifestDependencyPackage.UniqueName) == -1) {
                                        // package is not installed
                                        ui.showErrorMessage("<strong>" + pkg.DisplayName + "</strong> has a missing dependency. <strong>" + dependencyPackage.DisplayName + "</strong> is not installed and has not been added to the install queue. ");
                                        dependenciesValid = false;
                                        return false;
                                    }
                                    // package is already installed
                                    dependenciesValid = true;
                                    return true;
                                }
                                orderedPackagesToImport[orderedPackagesToImportIndex] = manifestDependencyPackage;
                                orderedPackagesToImportIndex++;
                                dependenciesValid = true;
                                return true;
                            });
                            if (!dependenciesValid) {
                                valid = false;
                                return false;
                            }
                            orderedPackagesToImport[orderedPackagesToImportIndex] = pkg;
                            orderedPackagesToImportIndex++;
                            valid = true;
                            return true;
                        });
                        uniquePackagesRequiringWebsiteAssignment = _.uniq(packagesRequiringWebsiteAssignment, function (p) { return p.URI; });
                        uniquePackagesRequiringAttributeAssignment = _.uniq(packagesRequiringAttributeAssignment, function (p) { return p.URI; });
                        if (!valid) {
                            return;
                        }
                        if (packagesRequiringUserInput.length > 0) {
                            if (installedSolutions.length == 0 || (adx.xrm.indexOf(installedSolutions, "UniqueName", "AdxstudioPortals") == -1)) {
                                var $packagesRequiringUserInputList = $("#package-prerequisite-error .modal-body ul");
                                $packagesRequiringUserInputList.empty();
                                $.each(uniquePackagesRequiringWebsiteAssignment, function (packageIndex, pkg) {
                                    $packagesRequiringUserInputList.append($("<li>" + pkg.DisplayName + "</li>"));
                                });
                                $("#package-prerequisite-error").modal();
                                return;
                            }
                            if (uniquePackagesRequiringWebsiteAssignment.length > 0) {
                                getWebsiteReferenceReplacementData();
                            }
                            else {
                                getAttributeValueReplacementData();
                            }
                            return;
                        }
                        processImport();
                    }
                    imports.execute = execute;
                    function getWebsiteReferenceReplacementData() {
                        existingWebsites = [];
                        adx.xrm.data.getExistingWebsites()
                            .then(function (response) {
                                var websites = [];
                                if (response && response.results && response.results.EntityCollection && response.results.EntityCollection.entities && response.results.EntityCollection.entities.length > 0) {
                                    websites = response.results.EntityCollection.entities;
                                }
                                if (websites.length > 0) {
                                    existingWebsites = websites;
                                    var $packagesList = $("#select-website .modal-body ul");
                                    $packagesList.empty();
                                    $.each(uniquePackagesRequiringWebsiteAssignment, function (packageIndex, pkg) {
                                        $packagesList.append($("<li>" + pkg.DisplayName + "</li>"));
                                    });
                                    var $continueButton = $("#select-website .modal-footer .btn-primary");
                                    var $websitesSelect = $("#select-website .modal-body select");
                                    $websitesSelect.empty().append($("<option></option>")).off("change").on("change", function () {
                                        if (!$(this).val() || $(this).val() == '') {
                                            $continueButton.prop("disabled", true);
                                            return;
                                        }
                                        $continueButton.prop("disabled", false);
                                    });
                                    $.each(websites, function (websiteIndex, website) {
                                        $websitesSelect.append($("<option value='" + website.attributes.adx_websiteid + "'>" + website.attributes.adx_name + "</option>"));
                                    });
                                    $continueButton.prop("disabled", true).off("click").on("click", function () {
                                        websiteId = $("#select-website option:selected").val();
                                        if (!websiteId || websiteId == '')
                                            return;
                                        var getRootPage = false;
                                        var getPublishingState = false;
                                        var getWeblinkSets = false;
                                        var weblinkSetNames = [];
                                        var getPageTemplates = false;
                                        var pageTemplateRewriteUrls = [];
                                        var deferreds = [];
                                        $.each(uniquePackagesRequiringWebsiteAssignment, function (i, pkg) {
                                            var referenceReplacementTargets = pkg.ReferenceReplacementTargets;
                                            $.each(referenceReplacementTargets, function (j, item) {
                                                if (item.LogicalName == "adx_webpage" && item.Operation == "FindRootPage") {
                                                    getRootPage = true;
                                                }
                                                else if (item.LogicalName == "adx_publishingstate" && item.Operation == "FindVisibleState") {
                                                    getPublishingState = true;
                                                }
                                                else if (item.LogicalName == "adx_weblinkset" && item.Operation == "FindByName") {
                                                    getWeblinkSets = true;
                                                    weblinkSetNames.push(item.Name);
                                                }
                                                else if (item.LogicalName == "adx_pagetemplate" && item.Operation == "FindByAttribute") {
                                                    getPageTemplates = true;
                                                    pageTemplateRewriteUrls.push(item.Value);
                                                }
                                            });
                                        });
                                        if (getRootPage) {
                                            deferreds.push(adx.xrm.data.getRootPage(websiteId).then(function (getRootPageResponse) {
                                                var rootPages = [];
                                                var rootPage = null;
                                                if (getRootPageResponse && getRootPageResponse.results && getRootPageResponse.results.EntityCollection && getRootPageResponse.results.EntityCollection.entities && getRootPageResponse.results.EntityCollection.entities.length > 0) {
                                                    rootPages = getRootPageResponse.results.EntityCollection.entities;
                                                }
                                                if (rootPages.length > 0) {
                                                    rootPage = rootPages[0];
                                                }
                                                return rootPage;
                                            }, function (exception) {
                                                adx.xrm.installer.ui.showErrorMessage(exception.faultString);
                                            }));
                                        }
                                        if (getPublishingState) {
                                            deferreds.push(adx.xrm.data.getPublishingState(websiteId, 1).then(function (getPublishingStateResponse) {
                                                var publishingStates = [];
                                                var publishingState = null;
                                                if (getPublishingStateResponse && getPublishingStateResponse.results && getPublishingStateResponse.results.EntityCollection && getPublishingStateResponse.results.EntityCollection.entities && getPublishingStateResponse.results.EntityCollection.entities.length > 0) {
                                                    publishingStates = getPublishingStateResponse.results.EntityCollection.entities;
                                                }
                                                if (publishingStates.length > 0) {
                                                    publishingState = publishingStates[0];
                                                }
                                                return publishingState;
                                            }, function (exception) {
                                                adx.xrm.installer.ui.showErrorMessage(exception.faultString);
                                            }));
                                        }
                                        if (getWeblinkSets) {
                                            $.each(_.uniq(weblinkSetNames), function (i, name) {
                                                deferreds.push(adx.xrm.data.getWeblinkSetByName(websiteId, name).then(function (getWeblinkSetResponse) {
                                                    var weblinkSets = [];
                                                    var weblinkSet = null;
                                                    if (getWeblinkSetResponse && getWeblinkSetResponse.results && getWeblinkSetResponse.results.EntityCollection && getWeblinkSetResponse.results.EntityCollection.entities && getWeblinkSetResponse.results.EntityCollection.entities.length > 0) {
                                                        weblinkSets = getWeblinkSetResponse.results.EntityCollection.entities;
                                                    }
                                                    if (weblinkSets.length > 0) {
                                                        weblinkSet = weblinkSets[0];
                                                    }
                                                    return weblinkSet;
                                                }, function (exception) {
                                                    adx.xrm.installer.ui.showErrorMessage(exception.faultString);
                                                }));
                                            });
                                        }
                                        if (getPageTemplates) {
                                            $.each(_.uniq(pageTemplateRewriteUrls), function (i, rewriteUrl) {
                                                deferreds.push(adx.xrm.data.getPageTemplateByRewriteUrl(websiteId, rewriteUrl).then(function (getPageTemplateByRewriteUrlResponse) {
                                                    var pageTemplates = [];
                                                    var pageTemplate = null;
                                                    if (getPageTemplateByRewriteUrlResponse && getPageTemplateByRewriteUrlResponse.results && getPageTemplateByRewriteUrlResponse.results.EntityCollection && getPageTemplateByRewriteUrlResponse.results.EntityCollection.entities && getPageTemplateByRewriteUrlResponse.results.EntityCollection.entities.length > 0) {
                                                        pageTemplates = getPageTemplateByRewriteUrlResponse.results.EntityCollection.entities;
                                                    }
                                                    if (pageTemplates.length > 0) {
                                                        pageTemplate = pageTemplates[0];
                                                    }
                                                    return pageTemplate;
                                                }, function (exception) {
                                                    adx.xrm.installer.ui.showErrorMessage(exception.faultString);
                                                }));
                                            });
                                        }
                                        if (deferreds.length > 0) {
                                            produceDataIdMappings = true;
                                        }
                                        $.when.apply(null, deferreds).done(function () {
                                            $("#select-website").modal("hide");
                                            if (uniquePackagesRequiringAttributeAssignment.length > 0) {
                                                getAttributeValueReplacementData(arguments);
                                            }
                                            else {
                                                processImport(arguments);
                                            }
                                        }).fail(function () {
                                            $("#select-website").modal("hide");
                                        });
                                    });
                                    $("#select-website").modal();
                                }
                                else {
                                    var $packagesRequiringUserInputList = $("#package-prerequisite-error .modal-body ul");
                                    $packagesRequiringUserInputList.empty();
                                    $.each(uniquePackagesRequiringWebsiteAssignment, function (packageIndex, pkg) {
                                        $packagesRequiringUserInputList.append($("<li>" + pkg.DisplayName + "</li>"));
                                    });
                                    $("#package-prerequisite-error").modal();
                                }
                                return;
                            }, function (exception) {
                                adx.xrm.installer.ui.showErrorMessage(exception.faultString);
                            });
                    }
                    function getAttributeValueReplacementData(websiteReferenceReplacementData) {
                        if (uniquePackagesRequiringAttributeAssignment.length > 0) {
                            var existingWebsitesRetrievalRequired = false;
                            $.each(uniquePackagesRequiringAttributeAssignment, function (pkgIndex, pkg) {
                                $.each(pkg.AttributeReplacementTargets, function (aIndex, a) {
                                    if (a.EntityLogicalName == "adx_website" && a.AttributeLogicalName == "adx_name") {
                                        existingWebsitesRetrievalRequired = true;
                                    }
                                });
                            });
                            if (existingWebsites.length == 0 && existingWebsitesRetrievalRequired) {
                                adx.xrm.data.getExistingWebsites()
                                    .then(function (response) {
                                        var websites = [];
                                        if (response && response.results && response.results.EntityCollection && response.results.EntityCollection.entities && response.results.EntityCollection.entities.length > 0) {
                                            websites = response.results.EntityCollection.entities;
                                        }
                                        if (websites.length > 0) {
                                            existingWebsites = websites;
                                        }
                                        getAttributeValueReplacements(websiteReferenceReplacementData);
                                    });
                            }
                            else {
                                getAttributeValueReplacements(websiteReferenceReplacementData);
                            }
                        }
                    }
                    function getAttributeValueReplacements(websiteReferenceReplacementData) {
                        var attributeData = { Packages: uniquePackagesRequiringAttributeAssignment };
                        var source = $("#attribute-replacement-template").html();
                        var template = Handlebars.compile(source);
                        Handlebars.registerHelper('input', function (pkgUniqueName, pkgUri) {
                            var type = Handlebars.Utils.escapeExpression(this.Type);
                            var id = pkgUniqueName + '.' + this.InputId;
                            var input = null;
                            var required = '';
                            if (this.Required) {
                                required = ' required ';
                            }
                            switch (type) {
                                case "select":
                                    input = '<select class="form-control" id="' + id + '" name = "' + id + '"' + required + ' data-id="' + this.Id + '" data-entity="' + this.EntityLogicalName + '" data-attribute="' + this.AttributeLogicalName + '" data-uri="' + pkgUri + '">';
                                    for (var i = 0, l = this.Options.length; i < l; i++) {
                                        if (this.Options[i].Value == this.DefaultValue) {
                                            input += '<option selected value="' + this.Options[i].Value + '">' + this.Options[i].Text + '</option>';
                                        }
                                        else {
                                            input += '<option value="' + this.Options[i].Value + '">' + this.Options[i].Text + '</option>';
                                        }
                                    }
                                    input += '</select>';
                                    break;
                                case "checkbox":
                                    if (this.DefaultValue == true) {
                                        input = '<input class="checkbox" id="' + id + '" name = "' + id + '" type="checkbox" checked ' + ' data-id="' + this.Id + '" data-entity="' + this.EntityLogicalName + '" data-attribute="' + this.AttributeLogicalName + '" data-uri="' + pkgUri + '" />';
                                    }
                                    else {
                                        input = '<input class="checkbox" id="' + id + '" name = "' + id + '" type="checkbox" data-id="' + this.Id + '" data-entity="' + this.EntityLogicalName + '" data-attribute="' + this.AttributeLogicalName + '" data-uri="' + pkgUri + '" />';
                                    }
                                    break;
                                case "number":
                                    input = '<input class="form-control" id="' + id + '" name = "' + id + '" type="' + type + '" value="' + (this.DefaultValue || '') + '" min="' + (this.Min || 0) + '" max="' + (this.Max || '') + '" step="' + (this.Step || 1) + '" placeholder="' + (this.Placeholder || '') + '"' + required + ' data-id="' + this.Id + '" data-entity="' + this.EntityLogicalName + '" data-attribute="' + this.AttributeLogicalName + '" data-uri="' + pkgUri + '" />';
                                    break;
                                case "textarea":
                                    input = '<textarea class="form-control" id="' + id + '" name = "' + id + '" value="' + (this.DefaultValue || '') + '" maxlength="' + (this.MaxLength || '') + '" rows="' + (this.Rows || 5) + '" cols="' + (this.Cols || 20) + '" placeholder="' + (this.Placeholder || '') + '"' + required + ' data-id="' + this.Id + '" data-entity="' + this.EntityLogicalName + '" data-attribute="' + this.AttributeLogicalName + '" data-uri="' + pkgUri + '" />';
                                    break;
                                default:
                                    input = '<input class="form-control" id="' + id + '" name = "' + id + '" type="' + type + '" value="' + (this.DefaultValue || '') + '" maxlength="' + (this.MaxLength || '') + '" placeholder="' + (this.Placeholder || '') + '"' + required + ' data-id="' + this.Id + '" data-entity="' + this.EntityLogicalName + '" data-attribute="' + this.AttributeLogicalName + '" data-uri="' + pkgUri + '" />';
                                    break;
                            }
                            return new Handlebars.SafeString(input);
                        });
                        $("#attribute-value-assignment .modal-body").empty().html(template(attributeData));
                        var validateOptions = {
                            highlight: function (element) {
                                $(element).closest('.form-group').removeClass('has-success').addClass('has-error');
                            },
                            success: function (element) {
                                $(element).closest('.form-group').removeClass('has-error').addClass('has-success');
                            },
                            errorClass: 'help-block',
                            submitHandler: function (form) {
                                var attributeValueReplacementData = [];
                                $.each(form.elements, function (eIndex, el) {
                                    if (!el.id) {
                                        return;
                                    }
                                    var value = el.value;
                                    if (el.type == "checkbox") {
                                        if (el.checked) {
                                            value = "true";
                                        }
                                        else {
                                            value = "false";
                                        }
                                    }
                                    var item = { "name": el.id, "value": value, "id": el.getAttribute("data-id"), "entity": el.getAttribute("data-entity"), "attribute": el.getAttribute("data-attribute"), "uri": el.getAttribute("data-uri") };
                                    attributeValueReplacementData[attributeValueReplacementData.length++] = item;
                                });
                                $("#attribute-value-assignment").modal("hide");
                                processImport(websiteReferenceReplacementData, attributeValueReplacementData);
                            },
                            rules: null
                        };
                        var validateRules = {};
                        $.each(uniquePackagesRequiringAttributeAssignment, function (pkgIndex, pkg) {
                            $.each(pkg.AttributeReplacementTargets, function (aIndex, a) {
                                if (a.EntityLogicalName == "adx_website" && a.AttributeLogicalName == "adx_name") {
                                    var name = pkg.UniqueName + '.' + a.InputId;
                                    validateRules[name] = "uniqueWebsite";
                                }
                            });
                        });
                        validateOptions.rules = validateRules;
                        $("#attribute-value-assignment form").validate(validateOptions);
                        var $continueButton = $("#attribute-value-assignment .modal-footer .btn-primary");
                        $continueButton.off("click").on("click", function () {
                            $("#attribute-value-assignment form").submit();
                        });
                        $("#attribute-value-assignment").modal();
                        return;
                    }
                    function processImport(websiteReferenceReplacementData, attributeValueReplacementData) {
                        $("body").attr("data-confirm-exit", "enabled");
                        $("#repositories").slideUp(100);
                        progress.show();
                        DisableControls();
                        $.each(orderedPackagesToImport, function (key, pkg) {
                            pkg.UI = new ui.ImportPackageRow(pkg);
                            progress.$content.append(pkg.UI.getElement());
                        });
                        if (packagesRequiringAttributeAssignment.length > 0 && attributeValueReplacementData) {
                            $.each(packagesRequiringAttributeAssignment, function (i, pkg) {
                                var attributeValueReplacements = [];
                                $.each(attributeValueReplacementData, function (j, attr) {
                                    if (attr.uri == pkg.URI) {
                                        attributeValueReplacements[attributeValueReplacements.length++] = attr;
                                    }
                                });
                                var orderedPackagesToImportIndex = adx.xrm.indexOf(orderedPackagesToImport, "URI", pkg.URI);
                                if (orderedPackagesToImportIndex != -1) {
                                    orderedPackagesToImport[orderedPackagesToImportIndex].AttributeValueReplacements = attributeValueReplacements;
                                }
                            });
                        }
                        if (produceDataIdMappings && websiteReferenceReplacementData) {
                            $.each(packagesRequiringWebsiteAssignment, function (i, pkg) {
                                var pkgIdMap = new adx.xrm.copy.IdMap();
                                var referenceReplacementTargets = pkg.ReferenceReplacementTargets;
                                $.each(referenceReplacementTargets, function (j, item) {
                                    if (item.LogicalName == "adx_website" && websiteId != null) {
                                        // idMap.add(data package entity reference to be replaced, user selected entity reference to use in replacement)
                                        pkgIdMap.add(new adx.sdk.EntityReference(item.LogicalName, item.Id), new adx.sdk.EntityReference("adx_website", websiteId));
                                    }
                                    else {
                                        $.each(websiteReferenceReplacementData, function (j, arg) {
                                            if (arg != null && arg.logicalName == item.LogicalName) {
                                                if (item.Operation == "FindByName") {
                                                    if (item.Name == arg.attributes["adx_name"]) {
                                                        pkgIdMap.add(new adx.sdk.EntityReference(item.LogicalName, item.Id), arg.toEntityReference());
                                                    }
                                                }
                                                else if (item.Operation == "FindByAttribute") {
                                                    if (item.Value == arg.attributes[item.Attribute]) {
                                                        pkgIdMap.add(new adx.sdk.EntityReference(item.LogicalName, item.Id), arg.toEntityReference());
                                                    }
                                                }
                                                else {
                                                    pkgIdMap.add(new adx.sdk.EntityReference(item.LogicalName, item.Id), arg.toEntityReference());
                                                }
                                            }
                                        });
                                    }
                                });
                                var orderedPackagesToImportIndex = adx.xrm.indexOf(orderedPackagesToImport, "URI", pkg.URI);
                                if (orderedPackagesToImportIndex != -1) {
                                    orderedPackagesToImport[orderedPackagesToImportIndex].DataIdMap = pkgIdMap;
                                }
                            });
                        }
                        var packagesImporter = new adx.xrm.packages.Importer(orderedPackagesToImport);
                        packagesImporter.executeImport().fail(function (progress) { return onFail(progress); }).done(function () { return onDone(); });
                    }
                    function onFail(result) {
                        var details = "";
                        if (result instanceof adx.xrm.solutions.ImportProgress) {
                            details = result.errors ? _.map(result.errors, function (element) {
                                return "[" + $(element).prop("tagName").toLowerCase() + "] " + $(element).attr("id") + " - " + $(element).children("result").attr("errortext");
                            }).join("\n") : null;
                            if (result.importJobId) {
                                if (window.saveAs === undefined) {
                                    $("a.download-logfile").prop('disabled', true);
                                    $("div.download-not-supported").show();
                                }
                                else {
                                    $("a.download-logfile").show();
                                    $(document).off("click", "a.download-logfile");
                                    $(document).on("click", "a.download-logfile", function (e) {
                                        e.preventDefault();
                                        adx.xrm.solutions.retrieveFormattedImportJobResults(result.importJobId).done(function (response) {
                                            if (!response || !response.results || !response.results.FormattedResults) {
                                                window.console.error("Failed to retrieve formatted import job results for importjobid " + result.importJobId.toString());
                                                return;
                                            }
                                            var xml = response.results.FormattedResults;
                                            writeImportLogFile(xml);
                                        });
                                    });
                                }
                            }
                            else {
                                $("a.download-logfile").hide();
                            }
                        }
                        else if (result && result.status != undefined && result.statusText != undefined) {
                            $("a.download-logfile").hide();
                            if (result.status == 404) {
                                details = "The requested file could not be found.";
                            }
                        }
                        else if (result && result.innerException != undefined && result.innerException.faultString != undefined) {
                            $(document).off("click", "a.download-logfile");
                            $(document).on("click", "a.download-logfile", function (e) {
                                e.preventDefault();
                                var json = JSON.stringify(result);
                                writeDataImportLogFile(json);
                            });
                            details = result.innerException.faultString;
                        }
                        ui.showTemplateMessage("#import-failure-message", "", "", true, false, { details: details });
                        $("body").removeAttr("data-confirm-exit");
                        $("#install-navbar").hide();
                        $("#finish-navbar").show();
                        onFinish();
                    }
                    function onDone() {
                        ui.showTemplateMessage("#import-success");
                        $("body").removeAttr("data-confirm-exit");
                        $("#install-navbar").hide();
                        $("#finish-navbar").show();
                        onFinish();
                    }
                    function onFinish() {
                        $("#finish").on("click", function () {
                            window.location.reload();
                        });
                        resetInstallCount();
                    }
                })(imports = packages.imports || (packages.imports = {}));
            })(packages = installer.packages || (installer.packages = {}));
            var license;
            (function (license_1) {
                function initialize() {
                    $("#license").on("show.bs.modal", function () {
                        $("#license .modal-body").load("eula.html");
                    });
                    $("#license-accept").on("click", function () {
                        accept();
                    });
                    $("#license-decline").on("click", function () {
                        decline();
                    });
                    var licenseAccepted = checkLicenseCookie();
                    if (!licenseAccepted) {
                        displayLicenseDialog();
                    }
                }
                license_1.initialize = initialize;
                function validate() {
                    return checkLicenseCookie();
                }
                license_1.validate = validate;
                function accept() {
                    setLicenseCookie();
                    adx.xrm.installer.ui.showLoading();
                    installer.initialize();
                }
                license_1.accept = accept;
                function decline() {
                    parent.window.close();
                }
                license_1.decline = decline;
                function setCookie(cname, cvalue, exdays) {
                    var d = new Date();
                    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
                    var expires = "expires=" + d.toUTCString();
                    document.cookie = cname + "=" + cvalue + "; " + expires;
                }
                function getCookie(cname) {
                    var name = cname + "=";
                    var ca = document.cookie.split(';');
                    for (var i = 0; i < ca.length; i++) {
                        var c = ca[i].trim();
                        if (c.indexOf(name) == 0)
                            return c.substring(name.length, c.length);
                    }
                    return "";
                }
                function checkLicenseCookie() {
                    var accepted = false;
                    var license = getCookie("AdxstudioInstallerLicenseAccepted");
                    if (license != "" && license == "true") {
                        accepted = true;
                    }
                    return accepted;
                }
                function setLicenseCookie() {
                    setCookie("AdxstudioInstallerLicenseAccepted", "true", 365);
                }
                function displayLicenseDialog() {
                    adx.xrm.installer.ui.hideLoading();
                    $("#license").modal({
                        backdrop: 'static',
                        keyboard: false,
                        show: true
                    });
                }
            })(license = installer.license || (installer.license = {}));
            var ui;
            (function (ui) {
                var ImportPackageRow = (function () {
                    function ImportPackageRow(pkg) {
                        this.$row = $('<div class="row row-import-package"/>');
                        this.$label = $('<span class="text-muted"/>');
                        this.$title = $('<div class="col-sm-8">');
                        this.progressBar = new ui.ProgressBar();
                        this.$row.append(this.$title.append(this.$label.text(pkg.DisplayName))).append(this.progressBar.getElement());
                    }
                    ImportPackageRow.prototype.getElement = function () {
                        return this.$row;
                    };
                    ImportPackageRow.prototype.onProgress = function (state, percentage) {
                        if (state == adx.xrm.AsyncState.Started) {
                            this.$label.append("<span class='processing'>&nbsp;<i class='fa fa-spinner fa-spin'></i>&nbsp;importing...</span>");
                        }
                        this.$label.removeClass("text-muted");
                        this.progressBar.onProgress(percentage);
                    };
                    ImportPackageRow.prototype.onDone = function () {
                        this.$label.find("span.processing").remove();
                        this.$label.removeClass("text-muted")
                            .addClass("text-success")
                            .append("&nbsp;<i class='fa fa-check-circle'></i>&nbsp;");
                        this.progressBar.onDone();
                    };
                    ImportPackageRow.prototype.onFail = function (result) {
                        var message = "";
                        if (result instanceof adx.xrm.solutions.ImportProgress) {
                            if (!result.error) {
                                message = "Solution import failed";
                            }
                        }
                        else if (result.statusText != undefined) {
                            message = result.statusText;
                        }
                        else if (result.message != undefined) {
                            message = result.message;
                        }
                        this.$label.find("span.processing").remove();
                        this.$label.removeClass("text-muted")
                            .addClass("text-danger")
                            .append("&nbsp;<i class='fa fa-exclamation-circle'></i>&nbsp;<span>" + message + "</span>");
                        this.progressBar.onFail(result);
                    };
                    return ImportPackageRow;
                })();
                ui.ImportPackageRow = ImportPackageRow;
                var ProgressBar = (function () {
                    function ProgressBar() {
                        this.$container = $('<div class="progress progress-striped active"/>');
                        this.$bar = $('<div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0;"/>');
                        this.$sr = $('<span class="sr-only"></span>');
                        this.$container.append(this.$bar.append(this.$sr));
                    }
                    ProgressBar.prototype.getElement = function () {
                        return this.$container;
                    };
                    ProgressBar.prototype.onProgress = function (percentage) {
                        if (typeof percentage === "number") {
                            var fixed = percentage.toFixed(0);
                            this.$bar.css("width", fixed + "%");
                            this.$bar.attr("aria-valuenow", fixed);
                            this.$sr.text(fixed + "% Complete");
                        }
                    };
                    ProgressBar.prototype.onDone = function () {
                        this.onProgress(100);
                        this.$container.removeClass("progress-striped").removeClass("active");
                    };
                    ProgressBar.prototype.onFail = function (result) {
                        this.$container.removeClass("progress-striped").removeClass("active").addClass("progress-bar-danger");
                        window.console.log(result);
                    };
                    return ProgressBar;
                })();
                ui.ProgressBar = ProgressBar;
                var progress = (function () {
                    function progress(value) {
                        this.$container = $("#progress");
                        this.$content = $("#progress .content");
                        this.$progress = $("#progress .progress");
                        this.$progressbar = $("#progress .progress-bar");
                        this.$sr = $("#progress .progress-bar span.sr-only");
                        this.Value = 0;
                        this.Value = value;
                        this.$content.empty();
                        this.$progress.addClass("progress-striped");
                        this.$progressbar.removeClass("progress-bar-danger");
                    }
                    progress.prototype.show = function () {
                        this.$container.fadeIn();
                    };
                    progress.prototype.hide = function () {
                        this.$container.fadeOut();
                    };
                    progress.prototype.update = function (value) {
                        this.Value = value;
                        this.$progressbar.css('width', value.toFixed(0) + '%');
                        this.$progressbar.attr('aria-valuenow', value.toFixed(0));
                        this.$sr.text(value.toFixed(0) + '%');
                        if (value == 100) {
                            this.$progress.removeClass("progress-striped");
                        }
                    };
                    progress.prototype.error = function () {
                        this.$progress.removeClass("progress-striped");
                        this.$progressbar.addClass("progress-bar-danger");
                    };
                    return progress;
                })();
                ui.progress = progress;
                function showLoading() {
                    $("#loading").fadeIn();
                }
                ui.showLoading = showLoading;
                function hideLoading() {
                    $("#loading").fadeOut();
                }
                ui.hideLoading = hideLoading;
                function showTemplateMessage(sourceSelector, dataid, cssClass, scrollto, autoHide, params) {
                    if (dataid === void 0) { dataid = ""; }
                    if (cssClass === void 0) { cssClass = ""; }
                    if (scrollto === void 0) { scrollto = true; }
                    if (autoHide === void 0) { autoHide = false; }
                    if (params === void 0) { params = null; }
                    var $messagePanel = $('#messages');
                    var $source = $(sourceSelector);
                    if (!$source || $source.length == 0) {
                        return;
                    }
                    var $messageBox = $($source.html()).addClass(cssClass).addClass('message').prependTo($messagePanel);
                    configureMessageBox($messageBox, dataid, scrollto, autoHide, params);
                    this.hideLoading();
                }
                ui.showTemplateMessage = showTemplateMessage;
                function showMessage(message, dataid, cssClass, scrollto, autoHide, dismiss, params) {
                    if (dataid === void 0) { dataid = ""; }
                    if (cssClass === void 0) { cssClass = ""; }
                    if (scrollto === void 0) { scrollto = true; }
                    if (autoHide === void 0) { autoHide = false; }
                    if (dismiss === void 0) { dismiss = false; }
                    if (params === void 0) { params = null; }
                    var $messagePanel = $('#messages');
                    var $messageBox = $("<div />").addClass(cssClass).addClass('message').html(message).prependTo($messagePanel);
                    if (dismiss) {
                        $messageBox.prepend("<a class='close' data-dismiss='alert' href='#' aria-hidden='true'>&times;</a>");
                    }
                    configureMessageBox($messageBox, dataid, scrollto, autoHide, params);
                    this.hideLoading();
                }
                ui.showMessage = showMessage;
                function configureMessageBox($messageBox, dataid, scrollto, autoHide, params) {
                    if (dataid === void 0) { dataid = ""; }
                    if (scrollto === void 0) { scrollto = true; }
                    if (autoHide === void 0) { autoHide = false; }
                    if (params === void 0) { params = null; }
                    if (dataid != "") {
                        $messageBox.attr("data-id", dataid);
                    }
                    $('.show-details', $messageBox).hide();
                    $('.details', $messageBox).removeClass('expanded');
                    if (params) {
                        for (var param in params) {
                            $('.param.' + param, $messageBox).text(params[param] || '');
                        }
                        if (params.info) {
                            $('.info', $messageBox).text(params.info.toString());
                        }
                        if (params.details) {
                            $('.show-details', $messageBox).show().click(function () {
                                $('.details', $messageBox).toggleClass('expanded');
                            });
                        }
                    }
                    $messageBox.slideDown(100);
                    if (autoHide) {
                        setTimeout(function () { $messageBox.slideUp(100); }, 4000);
                    }
                    if (scrollto) {
                        scrollTo(0, $messageBox.position().top);
                    }
                }
                function showInfoMessage(message, scrollto, autoHide, dismiss, params) {
                    if (scrollto === void 0) { scrollto = true; }
                    if (autoHide === void 0) { autoHide = false; }
                    if (dismiss === void 0) { dismiss = false; }
                    if (params === void 0) { params = null; }
                    this.showMessage(message, '', 'alert alert-block alert-info', scrollto, autoHide, dismiss, params);
                }
                ui.showInfoMessage = showInfoMessage;
                function showWarningMessage(message, scrollto, autoHide, dismiss, params) {
                    if (scrollto === void 0) { scrollto = true; }
                    if (autoHide === void 0) { autoHide = false; }
                    if (dismiss === void 0) { dismiss = false; }
                    if (params === void 0) { params = null; }
                    this.showMessage(message, '', 'alert alert-block alert-warning', scrollto, autoHide, dismiss, params);
                }
                ui.showWarningMessage = showWarningMessage;
                function showErrorMessage(message, scrollto, autoHide, dismiss, params) {
                    if (scrollto === void 0) { scrollto = true; }
                    if (autoHide === void 0) { autoHide = false; }
                    if (dismiss === void 0) { dismiss = false; }
                    if (params === void 0) { params = null; }
                    this.showMessage(message, '', 'alert alert-block alert-danger', scrollto, autoHide, dismiss, params);
                }
                ui.showErrorMessage = showErrorMessage;
                function showSuccessMessage(message, scrollto, autoHide, dismiss, params) {
                    if (scrollto === void 0) { scrollto = true; }
                    if (autoHide === void 0) { autoHide = false; }
                    if (dismiss === void 0) { dismiss = false; }
                    if (params === void 0) { params = null; }
                    this.showMessage(message, '', 'alert alert-block alert-success', scrollto, autoHide, dismiss, params);
                }
                ui.showSuccessMessage = showSuccessMessage;
                function ajaxError(jqXhr, textStatus, errorThrown) {
                    if (jqXhr.status == 0) {
                        if (errorThrown) {
                            this.showErrorMessage('<p>' + errorThrown + '</p>');
                        }
                        else {
                            this.showErrorMessage('<p>Could not connect. Please Check Your Network.</p>');
                        }
                    }
                    else if (jqXhr.status == 404) {
                        this.showErrorMessage('<p>Requested URL not found.</p>');
                    }
                    else if (jqXhr.status == 500) {
                        this.showErrorMessage('<p>Internel Server Error.' + jqXhr.responseText + '</p>');
                    }
                    else if (errorThrown == 'parsererror') {
                        this.showErrorMessage('<p>Parsing JSON Request failed.</p>');
                    }
                    else if (errorThrown == 'timeout') {
                        this.showErrorMessage('<p>Request Time out.</p>');
                    }
                    else if (errorThrown == 'abort') {
                        this.showErrorMessage('<p>Request was aborted.</p>');
                    }
                    else {
                        if (errorThrown && errorThrown != 'error') {
                            this.showErrorMessage('<p>' + errorThrown + '</p>');
                        }
                        else {
                            this.showErrorMessage('<p>Unknown Error:' + jqXhr.responseText + '</p>');
                        }
                    }
                    this.hideLoading();
                }
                ui.ajaxError = ajaxError;
                function showErrorOverlay(selector, error, beforeShow) {
                    if (error === void 0) { error = null; }
                    if (beforeShow === void 0) { beforeShow = null; }
                    var $element = $(selector);
                    if (!$element || $element.length == 0) {
                        return;
                    }
                    if (error) {
                        for (var param in error) {
                            $('.param.' + param).text(error[param] || '');
                        }
                        if (error.details) {
                            $('.show-details', $element).show().click(function () {
                                $('.details', $element).toggleClass('expanded');
                            });
                        }
                    }
                    if ($.isFunction(beforeShow)) {
                        beforeShow();
                    }
                    $element.show();
                    this.hideLoading();
                }
                ui.showErrorOverlay = showErrorOverlay;
            })(ui = installer.ui || (installer.ui = {}));
        })(installer = xrm.installer || (xrm.installer = {}));
    })(xrm = adx.xrm || (adx.xrm = {}));
})(adx || (adx = {}));

