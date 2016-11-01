var request = require('request');
var moment = require('moment');
var fs = require("fs");
var path = require("path");
var config = require("./config.json");
var badwords = require("./badwords.json");
var url = config.url;

var error_count = 0;

var logs_dir = "logs",
    error_log_file = "logs/error.log";

//------------------------------Run this shit---------------------------------------
setup_all_the_junk();
login_then_run_bot();

var version = '0.2.1',
socket,
csrf,
uid,
balance;

//------------------------------setup---------------------------------------------------
function setup_all_the_junk() {
    fs.existsSync(logs_dir) || fs.mkdirSync(logs_dir);
    fs.existsSync(error_log_file) || fs.openSync(error_log_file, "w");
};

//------------------------------Handle chat---------------------------------------
function handle_txt(txt, date) {}

function Process_commands() {}

//------------------------------twitter stuff-------------------------------------------
twitterHeartbeat();

function twitterHeartbeat() {
    setInterval(function() {
        updateTweets()
    }, 18E4)
}
var tweetArray = [];

function tweetit(a) {
    tweetArray.push({
        tweetMsgs: a
    })
}

function executeTweet(a) {
    post_to_twitter(a)
}

function post_to_twitter(a) {
    a = a.toString();
    client.post("statuses/update", {
        status: a
    }, function(a, b, c) {
        a || console.log("Posted to TW:" + b);
        a && console.log(a)
    })
};

function updateTweets() {
    var a;
    0 < tweetArray.length && (a = tweetArray[0].tweetMsgs, executeTweet(a), tweetArray.shift())
};

//------------------------------Login stuff---------------------------------------
function login_then_run_bot() {

	var credentials = {
		hash : '',
		username : config.nick,
		password : config.pass,
		code : ''
	};

	login(credentials, function (err, cookie) {
		if (err) {
			console.log('ERROR:', err);
			return;
		}

		console.log('logged in; got cookie (secret - do not share!):');
		run_bot(cookie);
	});
}

function login(credentials, cb) {
	var jar = request.jar();

	req = {
		url : url,
		jar : jar,
		form : {}
	}

	if (credentials.hash) {
		if (credentials.username || credentials.password)
			return cb('either specify a hash or a username and password');
		jar.setCookie(request.cookie('hash=' + credentials.hash), url);
	}

	if (credentials.username)
		req.form.username = credentials.username;
	if (credentials.password)
		req.form.password = credentials.password;
	if (credentials.code)
		req.form.code = credentials.code;

	request.post(req, function (err, res, body) {
		if (err)
			return cb(err);

		if (body.match(/Please enter your 6 digit google authentification number/))
			return cb('that account requires a correct 2FA code and hash to log in; 2FA codes can only be used once each');

		if (body.match(/Your account is set up to require a google authentification code for this action/))
			return cb('that account requires a 2FA code in addition to the username and password to log in');

		if (body.match(/Please enter your username/))
			return cb('that account requires a correct username and password, and possibly 2FA code; 2FA codes can only be used once each');

		var cookie = jar.getCookieString(url);

		if (!cookie.match(/hash=/))
			return cb('bad hash');

		return cb(null, cookie);
	});
}

var first_login = true;

function run_bot(cookie) {
	if (first_login) {
		first_login = false;
	}

	var transport = 'websocket';
	// var transport = 'polling';

	var inits = 0;

	socket = require("socket.io-client")(url, {
			transports : [transport],
			extraHeaders : {
				origin : url,
				cookie : cookie
			}
		});

	socket.on('getver', function (key) {
		socket.emit('version', csrf, key, "RPI-alertbot-LED:" + version);
	});

	socket.on('error', function (err) {
		console.log('caught error:', err);
		console.log('logging in again');
		login_then_run_bot();

		if (JSON.stringify(err).indexOf("can not find session") > -1) {
			error_count += 1;
			if (error_count > 1) {
				login_then_run_bot();
				error_count = 0;
			}
		}

		// ### DISCONNECTED ###
		// caught error:   can not find session
		log_error(JSON.stringify(err));
	});

	socket.on('init', function (data) {
		uid = data.uid;
		if (!inits++) {
			csrf = data.csrf;
			balance = data.balance;
			console.log(' ### CONNECTED as (' + uid + ') <' + data.name + '>');
		} else {
			console.log('### RECONNECTED ###');
			csrf = data.csrf;
			error_count = 0;
		}
	});

	socket.on('set_hash', function (hash) {
		console.log('INFO:', 'server requested that we reconnect...');
		socket.close();
		run_bot(cookie);
	});

	socket.on('chat', function (txt, date) {
		handle_txt(txt, date);
	});

	socket.on('tip', function (sender_uid, sender_name, amount, r, i) {
		console.log(sender_uid, sender_name, amount)
	});

	socket.on('staked', function (data) {});

	socket.on('result', function (data) {});

	socket.on('address', function (addr, img, confs) {
		console.log('DEPOSIT:', addr);
	});

	socket.on('invest_error', function (txt) {
		console.log('ERROR:', txt);
	});

	socket.on('divest_error', function (txt) {
		console.log('ERROR:', txt);
	});

	socket.on('jderror', function (txt) {
		console.log('ERROR:', txt);
	});

	socket.on('jdmsg', function (txt) {
		console.log('INFO:', txt);
	});

	socket.on('form_error', function (txt) {
		console.log('FORM ERROR:', txt);
	});

	socket.on('login_error', function (txt) {
		console.log('LOGIN ERROR:', txt);
	});

	socket.on('balance', function (data) {
		if (data) {
			console.log(' ' + data)
		}
		console.log('Current balance ' + balance);
	});

	socket.on('disconnect', function () {
		console.log('### DISCONNECTED ###');
	});
}