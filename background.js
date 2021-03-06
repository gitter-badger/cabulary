/******************************************************
Cabulary Chrome Extension
Author: xaksis
about: takes care of bulk of our business logic. We will
use IndexedDB as our main storage but we'll also use chrome
storage sync to keep the words in case we ever need to get
them back or sync across
*******************************************************/

/* Notification module
*******************************************************/
var notify_m = (function(){
	
	function _createNotification(name, title, msg){
		console.log(msg);
		var opt = {
			type: 'basic',
		    title: title,
		    message: msg,
		    priority: 1,
		    iconUrl:'imgs/icon128.png'
		}
		chrome.notifications.create(name, opt, function(id) { console.log("Last error:", chrome.runtime.lastError); });
	}

	return {
		notify: _createNotification
	}
})();


/* Module to store the word in chrome storage
*******************************************************/
var store_m = (function(){
	var word_url = "";


	function _doesWordExist(word){
		chrome.storage.sync.get(word, function(obj){
			if(obj){
				notify_m.notify(word, "Cabulary Notification", word+" already exists in your deck");
				return true;
			}
		});
		return false;
	}

	function _extractWord(xml){
		try{
			var entry_xml = $(xml).find('entry').first();
			var entry_obj = {};
			entry_obj.word = entry_xml.find('ew').first().text();
			entry_obj.pronun = entry_xml.find("pr").first().text();
			entry_obj.pos = entry_xml.find("fl").first().text();
			entry_xml.find("def").find("dt").each(function(i,j){
				if($(j).text()[0] == ":"){
					entry_obj.def = $.trim($(j).clone().children("vi").remove().end().text());
					entry_obj.sentence = $.trim($(j).find("vi").text());
					return false;
				}
			});
			return entry_obj;
		}catch(e){
			return {}; 
		}
	}

	function _saveWord(xml){
		var word_obj = _extractWord(xml);
		console.log("word object: ", word_obj);
		if($.isEmptyObject(word_obj) || !word_obj.word){
			//not a valid word
			notify_m.notify(word_obj.word, "Cabulary Notification", "Word meaning not found!");
			return;
		}


		//add the url as well
		word_obj.url = word_url;
		//create an object to store in chrome sync
		var storage_word = {};
		storage_word[word_obj.word] = "y";

		//check if this word form exists already
		chrome.storage.sync.get(word_obj.word, function(obj){
			if(!$.isEmptyObject(obj)){
				//word already exist no need to add
				console.log("word form already exists!", obj);
				notify_m.notify(word_obj.word, "Cabulary Notification", "\""+word_obj.word+"\" already exists in your deck");
			}else{
				//add the word only to sync
				chrome.storage.sync.set(storage_word, function(){
					//add the word object to indexed db
					db_m.addWord(word_obj, function(){
						notify_m.notify(word_obj.word, "Cabulary Notification", "\""+word_obj.word+"\" saved to deck");
						console.log("word saved!");
					});
				});
			}
		});
	}

	function _addWord(word, page_url){
		word_url = page_url;
		chrome.storage.sync.get(word, function(obj){
			if(!$.isEmptyObject(obj)){
				console.log("word already exists!", obj);
				notify_m.notify(word, "Cabulary Notification", "\""+word+"\" already exists in your deck");
			}else{
				var the_url = "http://www.dictionaryapi.com/api/v1/references/collegiate/xml/"+word+"?key=34b2cebd-17a8-4fbd-af86-6d2d8b69ffd2";
				$.ajax({
					type: "GET",
					dataType: "xml",
					url: the_url
				}).done(function(response){
					console.log(response);
					_saveWord(response);
				});
			}
		});
	}

	return {
		addWord: _addWord
	}
})();


var context_m = (function(){

	function getword(info,tab) {
	    console.log("Word " + info.selectionText + " was clicked.");
	    var text = info.selectionText.split(" ")[0];
		store_m.addWord(text, info.pageUrl);
	}

	function initialize(){
		//make sure we can open db
		db_m.open(function(){
			console.log("db open successful!");	
		});
		chrome.contextMenus.create({
		    title: "Add \"%s\" to Cabulary", 
		    contexts:["selection"], 
		    onclick: getword
		});
	}

	return {
		init: initialize
	}
})();

context_m.init();