// package json
const packageJson = require('./package.json');

// program name
console.log('\n=== Funimation Downloader NX '+packageJson.version+' ===\n');
const api_host = 'https://prod-api-funimationnow.dadcdigital.com/api';

// modules build-in
const { chdir } = require('process');
const path = require('path');
const fs = require('fs');

// modules extra
const shlp = require('sei-helper');
const yargs = require('yargs');
const request = require('request');
const agent = require('socks5-https-client/lib/Agent');

// folders
const configDir  = path.join(__dirname,'/config/');
const configBase = path.join(__dirname,'/base/');
let bin, workDir = {};

// check folders
if(fs.existsSync(configBase)){
	bin             = require(path.join(configBase,'/config.bin.js'));
	workDir         = require(path.join(configBase,'/config.dir.js'));
}
else{
	bin             = require(path.join(configDir,'/config.bin.js'));
	workDir.content = path.join(__dirname,'/../videos/');
	workDir.trash   = path.join(__dirname,'/../videos/_trash/');
}

// auth check
let token = false;
const cfgFilename = configDir + '/funi_auth.json';
if(fs.existsSync(cfgFilename)){
	token = require(cfgFilename).token;
}

// cli
let argv = yargs
	.wrap(Math.min(100))
	.usage('Usage: $0 [options]')
	
	// login
	.describe('mail','Your email')
	.describe('pass','Your password')
	
	// params
	.describe('s','Set show id')
	.describe('alt','Alternative episode listing (if available)')
	.boolean('alt')
	
	.describe('sel','Select episode')
	.describe('sub','Subtitles mode (Dub mode by default)')
	.boolean('sub')
	
	.describe('q','Video quality')
	.choices('q', ['234p','270p','288p','360p','480p','540p','720p','1080p'])
	.default('q','720p')
	
	.describe('a','Release group')
	.default('a','Funimation')
	.describe('t','Filename: series title override')
	.describe('ep','Filename: episode number override')
	.describe('suffix','Filename: filename suffix override (first "SIZEp" will be raplaced with actual video size)')
	.default('suffix','SIZEp')
	
	.describe('mkv','Mux into mkv')
	.boolean('mkv')
	.describe('mks','Add subtitles to mkv (if available)')
	.boolean('mks')
	
	// login
	.describe('mail','Your email')
	.describe('pass','Your password')
	
	// proxy
	.describe('socks','Set ipv4 socks5 proxy')
	.describe('proxy','Set ipv4 http(s) proxy')
	
	// help
	.describe('h','Show this help')
	.alias('h','help')
	.boolean('h')
	
	.argv;

// check page
if(!isNaN(parseInt(argv.p, 10)) && parseInt(argv.p, 10) > 0){
	argv.p = parseInt(argv.p, 10);
}
else{
	argv.p = 1;
}

// check proxy
if(argv.socks){
	if(!shlp.validateIpAndPort(argv.socks)){
		console.log('Error: not ipv4 socks5 proxy. Skipping...\n');
		argv.socks = undefined;
	}
}
else if(argv.proxy){
	if(!shlp.validateIpAndPort(argv.proxy)){
		console.log('Error: not ipv4 http(s) proxy. Skipping...\n');
		argv.proxy = undefined;
	}
}

// fn variables
let fnTitle = '',
	fnEpNum = '',
	fnSuffix = '',
	fnOutput = '',
	fnOutput_bak = '',
	tsDlPath = false,
	stDlPath = false;

// select mode
if(argv.mail && argv.pass){
	auth();
}
else if(argv.search || argv.s && !isNaN(parseInt(argv.s,10)) && parseInt(argv.s,10) > 0){
	if(argv.search){
		searchShow();
	}
	else{
		getShow();
	}
}
else{
	console.log(yargs.help());
	process.exit();
}

async function auth(){
	let authData;
	try{
		authData = await getData(api_host+'/auth/login/',false,true,false,true);
		checkResp(authData);
	}
	catch(error){
		console.log(error,'\n');
		process.exit(1);
	}
	authData = JSON.parse(authData);
	if(authData.token){
		console.log('[INFO] Authentication success, your token:',authData.token.slice(0,7)+'*'.repeat(33),'\n');
		fs.writeFileSync(cfgFilename,JSON.stringify({"token":authData.token},null,'\t'));
	}
	else{
		console.log('[ERROR]',authData.error,'\n');
		process.exit(1);
	}
}

async function searchShow(){
	let searchData;
	try{
		let qs = {unique:true,limit:100,q:argv.search,offset:(argv.p-1)*1000};
		searchData = await getData(api_host+'/source/funimation/search/auto/',qs,true,true);
		checkResp(searchData);
	}
	catch(error){
		console.log(error,'\n');
		process.exit(1);
	}
	
	searchData = JSON.parse(searchData);
	if(searchData.items.hits){
		let shows = searchData.items.hits;
		console.log('[INFO] Search Results:');
		for(let ssn in shows){
			console.log('[#'+shows[ssn].id+'] '+shows[ssn].title+(shows[ssn].tx_date?' ('+shows[ssn].tx_date+')':''));
		}
	}
	console.log('[INFO] Total shows found:',searchData.count,'\n');
}

async function getShow(){
	// show main data
	let showData;
	try{
		showData = await getData(api_host+'/source/catalog/title/'+parseInt(argv.s,10),false,true,true);
		checkResp(showData);
	}
	catch(error){
		console.log(error,'\n');
		process.exit(1);
	}
	// check errors
	showData = JSON.parse(showData);
	if(showData.status){
		console.log('[ERROR] Error #'+showData.status+':',showData.data.errors[0].detail,'\n');
		process.exit(1);
	}
	else if(!showData.items || showData.items.length<1){
		console.log('[ERROR] Show not found\n');
	}
	showData = showData.items[0];
	console.log('[#'+showData.id+'] '+showData.title+' ('+showData.releaseYear+')');
	// show episodes
	let episodesData;
	try{
		let qs = {limit:-1,sort:'order',sort_direction:'ASC',title_id:parseInt(argv.s,10)};
		if(argv.alt){ qs.language = 'English'; }
		episodesData = await getData(api_host+'/funimation/episodes/',qs,true,true);
		checkResp(episodesData);
	}
	catch(error){
		console.log(error,'\n');
		process.exit(1);
	}
	// parse episodes list
	let eps = JSON.parse(episodesData).items,
		fnSlug = false;
	for(let e in eps){
		let showStrId = eps[e].ids.externalShowId;
		let epStrId = eps[e].ids.externalEpisodeId.replace(new RegExp('^'+showStrId),'');
		// select
		if(epStrId == argv.sel){
			fnSlug = {title:eps[e].item.titleSlug,episode:eps[e].item.episodeSlug};
		}
		// console vars
		let tx_snum = eps[e].item.seasonNum==1?'':' S'+eps[e].item.seasonNum;
		let tx_type = eps[e].mediaCategory != 'episode' ? eps[e].mediaCategory : '';
		let tx_enum = eps[e].item.episodeNum !== '' ? '#' + (eps[e].item.episodeNum < 10 ? '0'+eps[e].item.episodeNum : eps[e].item.episodeNum) : '#'+eps[e].item.episodeId;
		let qua_str = eps[e].quality.height ? eps[e].quality.quality +''+ eps[e].quality.height : 'UNK';
		let aud_str = eps[e].audio.length > 0 ? ', '+eps[e].audio.join(', ') : '';
		let rtm_str = eps[e].item.runtime !== '' ? eps[e].item.runtime : '??:??';
		// console string
		let episodeIdStr = epStrId;
		let conOut  = '['+episodeIdStr+'] ';
			conOut += eps[e].item.titleName+tx_snum + ' - ' +tx_type+tx_enum+ ' ' +eps[e].item.episodeName+ ' ';
			conOut += '('+rtm_str+') ['+qua_str+aud_str+ ']';
			conOut += epStrId == argv.sel ? ' (selected)' : '';
			conOut += eps.length-1 == e ? '\n' : '';
		console.log(conOut);
	}
	if(!fnSlug){
		process.exit();
	}
	// parse episode data
	let episodeData;
	try{
		episodeData = await getData(api_host+'/source/catalog/episode/'+fnSlug.title+'/'+fnSlug.episode+'/',false,true,true);
		checkResp(episodeData);
	}
	catch(error){
		console.log(error,'\n');
		process.exit(1);
	}
	let ep = JSON.parse(episodeData).items[0], streamId = 0;
	// build fn
	fnTitle = argv.t ? argv.t : ep.parent.title;
	ep.number = isNaN(ep.number) ? ep.number : ( parseInt(ep.number, 10) < 10 ? '0' + ep.number : ep.number );
	if(ep.mediaCategory != 'Episode'){
		ep.number = ep.number !== '' ? ep.mediaCategory+ep.number : ep.mediaCategory+'#'+ep.id;
	}
	fnEpNum = argv.ep ? ( parseInt(argv.ep, 10) < 10 ? '0' + argv.ep : argv.ep ) : ep.number;
	fnSuffix = argv.suffix.replace('SIZEp',argv.q);
	fnOutput = shlp.cleanupFilename('['+argv.a+'] ' + fnTitle + ' - ' + fnEpNum + ' ['+ fnSuffix +']');
	// end
	console.log('[INFO] Output filename: '+fnOutput,'\n\n[INFO] Available audio tracks:');
	for(let m in ep.media){
		let selected = false;
		if(ep.media[m].mediaType=='experience'){
			let media_id = ep.media[m].id;
			let dub_type = ep.media[m].title.split('_')[1];
			if(dub_type == 'Japanese' && argv.sub){
				streamId = ep.media[m].id;
				stDlPath = getSubsUrl(ep.media[m].mediaChildren);
				selected = true;
			}
			else if(dub_type == 'English' && !argv.sub){
				streamId = ep.media[m].id;
				stDlPath = getSubsUrl(ep.media[m].mediaChildren);
				selected = true;
			}
			console.log('[#'+media_id+'] '+dub_type+(selected?' (selected)':''));
		}
	}
	if(streamId<1){
		console.log('\n[ERROR] Dub not selected\n');
		process.exit();
	}
	// get stream url
	let streamData;
	try{
		streamData = await getData(api_host+'/source/catalog/video/'+streamId+'/signed',false,true,true);
		checkResp(streamData);
	}
	catch(error){
		console.log(error,'\n');
		process.exit(1);
	}
	streamData = JSON.parse(streamData);
	if(streamData.errors){
		console.log('\n[ERROR] Error #'+streamData.errors[0].code+':',streamData.errors[0].detail,'\n');
		process.exit(1);
	}
	else{
		for(let u in streamData.items){
			if(streamData.items[u].videoType == 'm3u8'){
				tsDlPath = streamData.items[u].src;
				break;
			}
		}
	}
	if(!tsDlPath){
		console.log('\n[ERROR] Unknown error\n');
		process.exit(1);
	}
	downloadStreams();
}

function getSubsUrl(m){
	for(let i in m){
		let fpp = m[i].filePath.split('.');
		let fpe = fpp[fpp.length-1];
		if(fpe == 'vtt'){
			return m[i].filePath;
		}
	}
	return false;
}

async function downloadStreams(){
	// to work dir
	chdir(workDir.content);
	// download video
	let speedupSegments = '--hls-segment-attempts 10 --hls-segment-threads 10 --hls-segment-timeout 60';
	if(!argv.nots){
		shlp.exec('streamlink','"'+path.normalize(bin.streamlink)+'"','"hlsvariant://'+tsDlPath+'" '+argv.q+' '+speedupSegments+' -o "'+fnOutput+'.ts"',true);
	}
	// download subtitles
	if(stDlPath){
		console.log('\n[INFO] Downloading subtitles...');
		let subsSrc = await getData(stDlPath);
		fs.writeFileSync(fnOutput+'.vtt',subsSrc);
		console.log('[INFO] Downloaded!');
	}
	// select muxer
	if(argv.mkv){
		// mux to mkv
		let mkvmux  = '-o "'+fnOutput+'.mkv" --disable-track-statistics-tags --engage no_variable_data ';
			mkvmux += '--track-name "0:['+argv.a+']" --language "1:'+(argv.sub?'jpn':'eng')+'" --video-tracks 0 --audio-tracks 1 --no-subtitles --no-attachments ';
			mkvmux += '"'+fnOutput+'.ts" ';
			if(argv.mks&&stDlPath){
				mkvmux += '--language 0:eng "'+fnOutput+'.vtt" ';
			}
		shlp.exec('mkvmerge','"'+path.normalize(bin.mkvmerge)+'"',mkvmux,true);
		if(!argv.nocleanup){
			fs.renameSync(fnOutput+'.ts', workDir.trash+'/'+fnOutput+'.ts');
		}
	}
	else{
		// check filename for ts muxer
		fnOutput_bak = fnOutput;
		if(fnOutput_bak.indexOf('.')>-1){
			fnOutput = fnOutput.replace(/\./g,'_');
			fs.renameSync(fnOutput_bak+'.ts', fnOutput+'.ts');
		}
		// Get stream data
		let metaData = require('child_process').execSync('"'+path.normalize(bin.tsmuxer)+'" "'+fnOutput+'.ts"');
		let metaDataRe = /Track ID:\s*(\d+)[\s\S]*?Stream ID:\s*([\S]*)[\s\S]*?Frame rate:\s*([\S]*)[\s\S]*?Track ID:\s*(\d+)[\s\S]*?Stream ID:\s*([\S]*)[\s\S]*?Stream delay:\s*([\S]*)/;
		let metaArgs = metaData.toString().match(metaDataRe);
		// demux streams
		let ts2meta  = 'MUXOPT --no-pcr-on-video-pid --new-audio-pes --demux --vbr  --vbv-len=500\n';
			ts2meta += metaArgs[2]+', "'+path.normalize(workDir.content+'/'+fnOutput+'.ts')+'", insertSEI, contSPS, track='+metaArgs[1]+'\n';
			ts2meta += metaArgs[5]+', "'+path.normalize(workDir.content+'/'+fnOutput+'.ts')+'", timeshift='+metaArgs[6]+'ms, track='+metaArgs[4];
		fs.writeFileSync(fnOutput_bak+'.meta',ts2meta);
		shlp.exec('tsmuxer','"'+path.normalize(bin.tsmuxer)+'"','"'+fnOutput_bak+'.meta" "'+path.normalize(workDir.content)+'"',true);
		if(fnOutput_bak.indexOf('.')>-1){
			fs.renameSync(fnOutput+'.track_'+metaArgs[1]+'.264',fnOutput_bak+'.264');
			fs.renameSync(fnOutput+'.track_'+metaArgs[4]+'.aac',fnOutput_bak+'.aac');
			fs.renameSync(fnOutput+'.ts', fnOutput_bak+'.ts');
			fnOutput = fnOutput_bak;
		}
		else{
			fs.renameSync(fnOutput+'.track_'+metaArgs[1]+'.264',fnOutput+'.264');
			fs.renameSync(fnOutput+'.track_'+metaArgs[4]+'.aac',fnOutput+'.aac');
		}
		// mux to mp4
		let mp4mux  = '-add "'+fnOutput+'.264#video:name=['+argv.a+']" ';
			mp4mux += '-add "'+fnOutput+'.aac#audio:lang='+(argv.sub?'jpn':'eng')+':name=" ';
			mp4mux += '-new "'+fnOutput+'.mp4" ';
		shlp.exec('mp4box','"'+path.normalize(bin.mp4box)+'"',mp4mux,true);
		// cleanup
		if(!argv.nocleanup){
			fs.unlinkSync(fnOutput+'.meta');
			fs.renameSync(fnOutput+'.ts', workDir.trash+'/'+fnOutput+'.ts');
			fs.renameSync(fnOutput+'.264', workDir.trash+'/'+fnOutput+'.264');
			fs.renameSync(fnOutput+'.aac', workDir.trash+'/'+fnOutput+'.aac');
		}
	}
	console.log('\n[INFO] Done!\n');
}

// check response
function checkResp(r){
	if(r.match(/<!doctype html>/) || r.match(/<html/)){
		console.log('[ERROR] unknown error, body:\n',r,'\n');
		process.exit(1);
	}
}

// get data fro url
function getData(url,qs,proxy,useToken,auth){
	let options = {};
	// request parameters
	options.url = url;
	if(qs){
		options.qs = qs;
	}
	if(auth){
		options.method = 'POST';
		options.formData = {
			username: argv.mail,
			password: argv.pass
		};
	}
	if(useToken && token){
		options.headers = {
			Authorization: 'Token '+token
		};
	}
	if(proxy && argv.socks){
		options.agentClass = agent;
		let agentOptions = {
			socksHost: argv.socks.split(':')[0],
			socksPort: argv.socks.split(':')[1]
		};
		options.agentOptions = agentOptions;
		options.timeout = 10000;
	}
	else if(proxy && argv.proxy){
		options.proxy = 'http://'+argv.proxy;
		options.timeout = 10000;
	}
	// do request
	return new Promise((resolve, reject) => {
		request(options, (err, resp, body) => {
			if (err) return reject(err);
			if (resp.statusCode != 200 && resp.statusCode != 403) {
				return reject(new Error(`\nStatus: ${resp.statusCode}`));
			}
			resolve(body);
		});
	});
}