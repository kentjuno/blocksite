chrome.runtime.onInstalled.addListener(function initialization(){
	turnFilteringOff();

	chrome.storage.sync.set({'blockingMethod': "close_tab"});
	let timerData = { isTimerEnabled: false, blockUntilMilliseconds: 0};
	chrome.storage.sync.set({'timerData': timerData});
	
	chrome.storage.sync.get('blockedSites', function(data) {
		blockedSites = data.blockedSites;
		if(typeof blockedSites != "undefined" && blockedSites != null 
			&& blockedSites.length != null && blockedSites.length > 0){
			var defaultListConfirm = confirm("We have detected that our extension" 
				+ " was once installed on this device.\nDo you want to load your old filter list?");
			if (defaultListConfirm) {
				console.log("User confirmed keeping a previous filter list");
			} 
			else {
				console.log("User cancelled loading a previous filter list.");
				addDefaultFilters();
			}
		} 
		else {
			console.log("User didn't have any previous filters");
			addDefaultFilters();
		}
	});
});

function addDefaultFilters(){
	var blockedSites = [".weebly.com"];
	chrome.storage.sync.set({'blockedSites': blockedSites}, function() {
		console.log('Default blocked sites have been loaded.');
	});
};

chrome.runtime.onStartup.addListener(function() {
	chrome.storage.sync.get('isEnabled', function (data) {
		if(data.isEnabled){
			icon = 'img/on.png';
		}
		else if(!data.isEnabled){
			icon = 'img/off.png';
		}else{
			icon = 'img/icon.png';
		}
		chrome.browserAction.setIcon({path:{"16": icon}});
	});
});

chrome.browserAction.onClicked.addListener(function toggleBlocking(){
	chrome.storage.sync.get('timerData', function (data) {
		if(!data.timerData.isTimerEnabled){
			chrome.storage.sync.get('isEnabled', function(data){
				if(data.isEnabled){
					turnFilteringOff();
				}
				else{
					turnFilteringOn();
				}
			});
		}
		else{
			if(!updateTimer(data.timerData)){
				var now = new Date().getTime();
				var timeLeft = data.timerData.blockUntilMilliseconds - now;
				var hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
				var minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
				var seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
				alert("Timer mode enabled! " + hours + " hours "+ minutes + " minutes " + seconds + " seconds left.");
			}
		}
	});
});

/**
 * This function, given timerData, checks if the time of Timer mode is up. 
 * If it is, it switched the Mode and filtering off. Else it returns false.
 *
 * @param {Object} 'timerData' from chrome.storage.sync.get.
 *
 * @return {boolean} true if the time is up and filtering was turned off
 *				   				    false it time is not up yet
 */
function updateTimer(timerData){
	let timeLeft = timerData.blockUntilMilliseconds - Date.now();
	if (timeLeft <= 0){  //unblock
		timerData.isTimerEnabled = false;
		chrome.storage.sync.set({'timerData': timerData}, function() {
			turnFilteringOff();
		});
		return true;
	}
	return false;
}

chrome.tabs.onUpdated.addListener(function blockIfEnabled(tabId, info, tab) {
	chrome.storage.sync.get('isEnabled', function (data) {
		if (data.isEnabled) {
			chrome.storage.sync.get('timerData', function (data) {
				if(data.timerData.isTimerEnabled){
					if(!updateTimer(data.timerData)){
						runPageThroughFilter(tab);
					}
				}
				else{
					runPageThroughFilter(tab);
				}
			});
		}
	});
});

function runPageThroughFilter(tab){
	chrome.storage.sync.get('blockedSites', function (data) {
		data.blockedSites.forEach(function (site) {
			if (tab.url.includes(site)) {
				denyPage(tab.id);
			}
		});
	});
};

chrome.contextMenus.create({
	  id: "baFilterListMenu",
      title: "Mở list đã được chặn",
      contexts: ["browser_action"]
}, () => chrome.runtime.lastError);

chrome.contextMenus.create({
	  id: "baAddToFilterList",
      title: "Chọn Chặn:",
      contexts: ["browser_action"]
}, () => chrome.runtime.lastError);

chrome.contextMenus.create({
	  parentId: "baAddToFilterList",
	  id: "baAddSiteToFilterList",
      title: "chặn trang này",
      contexts: ["browser_action"]
}, () => chrome.runtime.lastError);

chrome.contextMenus.create({
	  parentId: "baAddToFilterList",
	  id: "baAddDomainToFilterList",
      title: "chặn cả website này",
      contexts: ["browser_action"]
}, () => chrome.runtime.lastError);

chrome.contextMenus.create({
	  id: "baTimerMode",
      title: "Timer mode setup",
      contexts: ["browser_action"]
}, () => chrome.runtime.lastError);

chrome.contextMenus.create({
	  id: "pgAddToFilterList",
      title: "Block this:",
      contexts: ["page"]
}, () => chrome.runtime.lastError);

chrome.contextMenus.create({
	  parentId: "pgAddToFilterList",
	  id: "pgAddSiteToFilterList",
      title: "Page",
      contexts: ["page"]
}, () => chrome.runtime.lastError);

chrome.contextMenus.create({
	  parentId: "pgAddToFilterList",
	  id: "pgAddDomainToFilterList",
      title: "Domain",
      contexts: ["page"]
}, () => chrome.runtime.lastError);

chrome.contextMenus.onClicked.addListener(function contextMenuHandler(info, tab) {
		switch(info.menuItemId) {
			case "baFilterListMenu":
				chrome.tabs.create({ url: '/filterList.html'});
				break;
			case "baTimerMode":
				chrome.tabs.create({ url: '/timerModeSetup.html'});
				break;
			case "baAddSiteToFilterList":
			case "pgAddSiteToFilterList":
				chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
					let urls = tabs.map(x => x.url);
					addUrlToBlockedSites(urls[0], tab);
				});
				break;
			case "baAddDomainToFilterList":
			case "pgAddDomainToFilterList":
				chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
					let urls = tabs.map(x => x.url);
					urls = urls.toString();
					console.log('urls: '+ urls);
					//alert('urls: '+ urls);
					//var domain = urls[0].match(/^[\w]+:\/{2}([\w\.:-]+)/)[1];
					var domain = getUrlParts(urls).domainroot;
					//^www\.(.*)\.com$
					console.log('domain: '+ domain);
					//alert('domain: '+ domain);
					addUrlToBlockedSites(domain, tab);
				});
				break;
		}
});

function getUrlParts(fullyQualifiedUrl) {
    var url = {},
        tempProtocol
    var a = document.createElement('a')
    // if doesn't start with something like https:// it's not a url, but try to work around that
    if (fullyQualifiedUrl.indexOf('://') == -1) {
        tempProtocol = 'https://'
        a.href = tempProtocol + fullyQualifiedUrl
    } else
        a.href = fullyQualifiedUrl
    var parts = a.hostname.split('.')
    url.origin = tempProtocol ? "" : a.origin
    url.domain = a.hostname
    url.subdomain = parts[0]
    url.domainroot = ''
    url.domainpath = ''
    url.tld = '.' + parts[parts.length - 1]
    url.path = a.pathname.substring(1)
    url.query = a.search.substr(1)
    url.protocol = tempProtocol ? "" : a.protocol.substr(0, a.protocol.length - 1)
    url.port = tempProtocol ? "" : a.port ? a.port : a.protocol === 'http:' ? 80 : a.protocol === 'https:' ? 443 : a.port
    url.parts = parts
    url.segments = a.pathname === '/' ? [] : a.pathname.split('/').slice(1)
    url.params = url.query === '' ? [] : url.query.split('&')
    for (var j = 0; j < url.params.length; j++) {
        var param = url.params[j];
        var keyval = param.split('=')
        url.params[j] = {
            'key': keyval[0],
            'val': keyval[1]
        }
    }
    // domainroot
    if (parts.length > 2) {
        url.domainroot = parts[parts.length - 2] + '.' + parts[parts.length - 1];
        // check for country code top level domain
        if (parts[parts.length - 1].length == 2 && parts[parts.length - 1].length == 2)
            url.domainroot = parts[parts.length - 3] + '.' + url.domainroot;
    }
    // domainpath (domain+path without filenames) 
    if (url.segments.length > 0) {
        var lastSegment = url.segments[url.segments.length - 1]
        var endsWithFile = lastSegment.indexOf('.') != -1
        if (endsWithFile) {
            var fileSegment = url.path.indexOf(lastSegment)
            var pathNoFile = url.path.substr(0, fileSegment - 1)
            url.domainpath = url.domain
            if (pathNoFile)
                url.domainpath = url.domainpath + '/' + pathNoFile
        } else
            url.domainpath = url.domain + '/' + url.path
    } else
        url.domainpath = url.domain
    return url
}

function addUrlToBlockedSites(url, tab){
	chrome.storage.sync.get('blockedSites', function (data){
		data.blockedSites.push(url); // urls.hostname
		chrome.storage.sync.set({'blockedSites':data.blockedSites}, function(data){
			console.log(url + ' added to blocked sites');
			chrome.storage.sync.get('isEnabled', function(data) {
				if(data.isEnabled){
					denyPage(tab.id);
				}
			});
		});
	});	
}
