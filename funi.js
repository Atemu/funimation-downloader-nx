// modules build-in
const path = require('path');
const fs = require('fs');

// package json
const packageJson = require(path.join(__dirname,'package.json'));

// program name
console.log('\n=== Funimation Downloader NX '+packageJson.version+' ===\n');
const api_host = 'https://prod-api-funimationnow.dadcdigital.com/api';

// modules extra
const shlp = require('sei-helper');
const yargs = require('yargs');
const request = require('request');
const agent = require('socks5-https-client/lib/Agent');

// m3u8
const m3u8list = require('m3u8-stream-list');
const m3u8 = require('m3u8-parser');
const streamdl = require('hls-download');

// folders
const configDir = path.join(__dirname,'/config/');
const bin = require(path.join(configDir,'/config.bin.js'));
const workDir = {
    content: path.join(__dirname,'/videos/'),
    trash  : path.join(__dirname,'/videos/_trash/')
};

// auth check
let token = false;
const cfgFilename = configDir + '/funi_auth.json';
if(fs.existsSync(cfgFilename)){
    token = require(cfgFilename);
    token = token.token && typeof token.token == 'string' ? token.token : false;
}

// cli
let argv = yargs
    .wrap(Math.min(100))
    .usage('Usage: $0 [options]')
    .help(false).version(false)
    
    // login
    .describe('mail','Your email')
    .describe('pass','Your password')
    
    // params
    .describe('s','Set show id')
    .describe('alt','Alternative episode listing (if available)')
    .boolean('alt')
    
    .describe('sel','Select episode ids (coma-separated)')
    .describe('sub','Subtitles mode (Dub mode by default)')
    .boolean('sub')
    
    // .describe('q','Video quality')
    // .choices('q', ['234p','270p','288p','360p','480p','540p','720p','1080p'])
    // .default('q','720p')
    
    .describe('q','Video layer (0=max)')
    .choices('q', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    .default('q', 7)
    
    .describe('a','Release group')
    .default('a','Funimation')
    .describe('t','Filename: series title override')
    .describe('ep','Filename: episode number override (ignored in batch mode)')
    .describe('suffix','Filename: filename suffix override (first "SIZEp" will be raplaced with actual video size)')
    .default('suffix','SIZEp')
    
    .describe('nosubs','Skip download subtitles for Dub (if available)')
    .boolean('nosubs')
    
    .describe('mkv','Mux into mkv')
    .boolean('mkv')
    .describe('mks','Add subtitles to mkv or mp4 (if available)')
    .boolean('mks')
    
    // login
    .describe('mail','Your email')
    .describe('pass','Your password')
    
    // proxy
    .describe('socks','Set ipv4 socks5 proxy')
    .describe('socks-login','Set socks5 username')
    .describe('socks-pass','Set socks5 password')
    
    .describe('proxy','Set ipv4 http(s) proxy')
    .describe('ssp','Don\'t use proxy for stream downloading')
    .boolean('ssp')
    
    // help
    .describe('h','Show this help')
    .alias('h','help')
    .boolean('h')
    .version(false)
    
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
    stDlPath = false,
    batchDL = false;

// select mode
process.chdir(workDir.content);
if(argv.mail && argv.pass){
    auth();
}
else if(argv.search){
    searchShow();
}
else if(argv.s && !isNaN(parseInt(argv.s,10)) && parseInt(argv.s,10) > 0){
    getShow();
}
else{
    yargs.showHelp();
    process.exit();
}

async function auth(){
    let authData = await getData(api_host+'/auth/login/',false,true,false,true);
    if(checkRes(authData)){return;}
    authData = JSON.parse(authData.res.body);
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
    let qs = {unique:true,limit:100,q:argv.search,offset:(argv.p-1)*1000};
    let searchData = await getData(api_host+'/source/funimation/search/auto/',qs,true,true);
    if(checkRes(searchData)){return;}
    searchData = JSON.parse(searchData.res.body);
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
    let showData = await getData(api_host+'/source/catalog/title/'+parseInt(argv.s,10),false,true,true);
    if(checkRes(showData)){return;}
    // check errors
    showData = JSON.parse(showData.res.body);
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
    let qs = {limit:-1,sort:'order',sort_direction:'ASC',title_id:parseInt(argv.s,10)};
    if(argv.alt){ qs.language = 'English'; }
    let episodesData = await getData(api_host+'/funimation/episodes/',qs,true,true);
    if(checkRes(episodesData)){return;}
    let eps = JSON.parse(episodesData.res.body).items, fnSlug = [], is_selected = false;
    argv.sel = typeof argv.sel == 'number' || typeof argv.sel == 'string' ? argv.sel.toString() : '';
    argv.sel = argv.sel.match(',') ? argv.sel.split(',') : [argv.sel];
    // parse episodes list
    for(let e in eps){
        let showStrId = eps[e].ids.externalShowId;
        let epStrId = eps[e].ids.externalEpisodeId.replace(new RegExp('^'+showStrId),'');
        // select
        if(argv.sel.includes(epStrId.replace(/^0+/,''))){
            fnSlug.push({title:eps[e].item.titleSlug,episode:eps[e].item.episodeSlug});
            is_selected = true;
        }
        else{
            is_selected = false;
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
            conOut += is_selected ? ' (selected)' : '';
            conOut += eps.length-1 == e ? '\n' : '';
        console.log(conOut);
    }
    if(fnSlug.length>1){
        batchDL = true;
    }
    if(fnSlug.length<1){
        console.log('[INFO] Episodes not selected!\n');
        process.exit();
    }
    else{
        for(let fnEp=0;fnEp<fnSlug.length;fnEp++){
            await getEpisode(fnSlug[fnEp]);
        }
    }
}

async function getEpisode(fnSlug){
    let episodeData = await getData(api_host+'/source/catalog/episode/'+fnSlug.title+'/'+fnSlug.episode+'/',false,true,true);
    if(checkRes(episodeData)){return;}
    let ep = JSON.parse(episodeData.res.body).items[0], streamId = 0;
    // build fn
    fnTitle = argv.t ? argv.t : ep.parent.title;
    ep.number = isNaN(ep.number) ? ep.number : ( parseInt(ep.number, 10) < 10 ? '0' + ep.number : ep.number );
    if(ep.mediaCategory != 'Episode'){
        ep.number = ep.number !== '' ? ep.mediaCategory+ep.number : ep.mediaCategory+'#'+ep.id;
    }
    fnEpNum = argv.ep && !batchDL ? ( parseInt(argv.ep, 10) < 10 ? '0' + argv.ep : argv.ep ) : ep.number;
    // end
    console.log(`[INFO] ${ep.parent.title} - S${(ep.parent.seasonNumber?ep.parent.seasonNumber:'?')}E${(ep.number?ep.number:'?')} - ${ep.title}`);
    console.log('[INFO] Available audio tracks:');
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
        console.log('[ERROR] Track not selected\n');
        return;
    }
    else{
        let streamData = await getData(api_host+'/source/catalog/video/'+streamId+'/signed',{"dinstid":"uuid"},true,true);
        if(checkRes(streamData)){return;}
        streamData = JSON.parse(streamData.res.body);
        tsDlPath = false;
        if(streamData.errors){
            console.log('[ERROR] Error #'+streamData.errors[0].code+':',streamData.errors[0].detail,'\n');
            return;
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
            console.log('[ERROR] Unknown error\n');
            return;
        }
        else{
            await downloadStreams();
        }
    }
}

function getSubsUrl(m){
    if(argv.nosubs && !argv.sub){
        return false;
    }
    for(let i in m){
        let fpp = m[i].filePath.split('.');
        let fpe = fpp[fpp.length-1];
        if(fpe == 'dfxp'){ // dfxp, srt, vtt
            return m[i].filePath;
        }
    }
    return false;
}

async function downloadStreams(){
    // req playlist
    let plQR = await getData(tsDlPath);
    if(checkRes(plQR)){return;}
    let plQAt = m3u8list(plQR.res.body);
    plQAt = [...new Set(plQAt.map(x => JSON.stringify(x)))].map(x => JSON.parse(x));
    let plQA = {}, plQAs = [], pl_max = 1;
    for(let u in plQAt){
        let pl_layer = parseInt(plQAt[u].url.match(/_Layer(\d+)\.m3u8$/)[1]);
        pl_max = pl_max < pl_layer ? pl_layer : pl_max;
        let pl_quality = plQAt[u].RESOLUTION.split('x')[1]+'p';
        let pl_BANDWIDTH = Math.round(plQAt[u].BANDWIDTH/1024);
        let pl_url = plQAt[u].url;
        let dl_domain = pl_url.split('/')[2];
        // if(dl_domain.match(/.dlvr1.net$/) && !dl_domain.match(/fallback/)){
        if(dl_domain.match(/.cloudfront.net$/)){
            plQAs.push(`${pl_layer}: ${pl_quality} (${pl_BANDWIDTH}KiB/s)`);
            plQA[pl_layer] = { "q": pl_quality, "url": pl_url };
        }
    }
    argv.q = argv.q < 1 ? pl_max : argv.q;
    if(plQA[argv.q]){
        console.log(`[INFO] Selected layer: ${argv.q}\n\tAvailable qualities:\n\t\t${plQAs.join('\n\t\t')}`);
        fnSuffix = argv.suffix.replace('SIZEp',plQA[argv.q].q);
        fnOutput = shlp.cleanupFilename('['+argv.a+'] ' + fnTitle + ' - ' + fnEpNum + ' ['+ fnSuffix +']');
        console.log(`[INFO] Output filename: ${fnOutput}`);
    }
    else{
        console.log(`[INFO] Available qualities: ${plQAs.join(', ')}`);
        console.log(`[ERROR] Layer not selected\n`);
        return;
    }
    
    // download video
    let vidUrl = plQA[argv.q].url;
    let reqVid = await getData(plQA[argv.q].url,false,true);
    if(checkRes(reqVid)){return;}
    let m3u8parse = new m3u8.Parser();
    m3u8parse.push(reqVid.res.body);
    m3u8parse.end();
    let m3u8cfg = m3u8parse.manifest;
    m3u8cfg.baseUrl = vidUrl.split('/').slice(0, -1).join('/')+'/';
    // fs.writeFileSync(fnOutput+'.m3u8.json',JSON.stringify(m3u8cfg,null,'\t'));
    let proxy;
    if(argv.socks && !argv.ssp){
        proxy = { "ip": argv.socks, "type": "socks" };
        if(argv['socks-login'] && argv['socks-pass']){
            proxy['socks-login'] = argv['socks-login'];
            proxy['socks-pass'] = argv['socks-pass'];
        }
    }
    else if(argv.proxy && !argv.ssp){
        proxy = { "ip": argv.proxy, "type": "http" };
    }
    let dldata = await streamdl({
        fn: fnOutput,
        m3u8json: m3u8cfg,
        baseurl: m3u8cfg.baseUrl,
        proxy: (proxy?proxy:false)
    });
    if(!dldata.ok){
        console.log(`[ERROR] ${dldata.err}\n`);
        return;
    }
    else{
        console.log(`[INFO] Video downloaded!\n`);
    }
    
    // download subtitles
    if(stDlPath){
        console.log('[INFO] Downloading subtitles...');
        console.log(stDlPath);
        let subsSrc = await getData(stDlPath,false,true);
        if(!checkRes(subsSrc)){
            // let srtData = subsSrc.res.body;
            let srtData = ttml2srt(subsSrc.res.body);
            fs.writeFileSync(fnOutput+'.srt',srtData);
            console.log('[INFO] Subtitles downloaded!');
        }
        else{
            console.log('[ERROR] Failed to download subtitles!');
        }
    }
    
    // select muxer
    if(argv.mkv){
        // mux to mkv
        let mkvmux  = '-o "'+fnOutput+'.mkv" --disable-track-statistics-tags --engage no_variable_data ';
            mkvmux += '--track-name "0:['+argv.a+']" --language "1:'+(argv.sub?'jpn':'eng')+'" --video-tracks 0 --audio-tracks 1 --no-subtitles --no-attachments ';
            mkvmux += '"'+fnOutput+'.ts" ';
            if(argv.mks && stDlPath){
                mkvmux += '--language 0:eng "'+fnOutput+'.srt" ';
            }
        shlp.exec('mkvmerge','"'+path.normalize(bin.mkvmerge)+'"',mkvmux,true);
        if(!argv.nocleanup){
            fs.renameSync(fnOutput+'.ts', workDir.trash+'/'+fnOutput+'.ts');
            if(stDlPath && argv.mks){
                // fs.renameSync(fnOutput+'.vtt', workDir.trash+'/'+fnOutput+'.vtt');
                fs.renameSync(fnOutput+'.srt', workDir.trash+'/'+fnOutput+'.srt');
            }
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
            if(argv.mks && stDlPath){
                mp4mux += '-add "'+fnOutput+'.srt"';
            }
            mp4mux += '-new "'+fnOutput+'.mp4" ';
        shlp.exec('mp4box','"'+path.normalize(bin.mp4box)+'"',mp4mux,true);
        // cleanup
        if(!argv.nocleanup){
            fs.unlinkSync(fnOutput+'.meta');
            fs.renameSync(fnOutput+'.ts', workDir.trash+'/'+fnOutput+'.ts');
            fs.renameSync(fnOutput+'.264', workDir.trash+'/'+fnOutput+'.264');
            fs.renameSync(fnOutput+'.aac', workDir.trash+'/'+fnOutput+'.aac');
            if(stDlPath && argv.mks){
                // fs.renameSync(fnOutput+'.vtt', workDir.trash+'/'+fnOutput+'.vtt');
                fs.renameSync(fnOutput+'.srt', workDir.trash+'/'+fnOutput+'.srt');
            }
        }
    }
    console.log('\n[INFO] Done!\n');
}

function checkRes(r){
    if(r.err){
        console.log(`[ERROR] Error: ${r.err}`);
        if(r.res && r.res.body){
            console.log(`[ERROR] Body:\n${r.res.body}\n`);
        }
        else{
            console.log(`[ERROR] Additional info:\n${JSON.stringify(r.res,null,'\t')}\n`);
        }
        return true;
    }
    if(r.res && r.res.body && r.res.body.match(/^<!doctype/i) || r.res && r.res.body && r.res.body.match(/<html/)){
        console.log(`[ERROR] Error: ${r.err}, body:\n${r.res.body}\n`);
        return true;
    }
    return false;
}

function log(data){
    console.log(JSON.stringify(data,null,'\t'));
}

// get data from url
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
    if(options.qs && options.qs.dinstid){
        if(!options.headers){
            options.headers = {};
        }
        options.headers.devicetype = 'Android Phone';
        delete options.qs;
    }
    if(proxy && argv.socks){
        options.agentClass = agent;
        let agentOptions = {
            socksHost: argv.socks.split(':')[0],
            socksPort: argv.socks.split(':')[1]
        };
        if(argv['socks-login'] && argv['socks-pass']){
            agentOptions.socksUsername = argv['socks-login'];
            agentOptions.socksPassword = argv['socks-pass'];
        }
        options.agentOptions = agentOptions;
        options.timeout = 10000;
    }
    else if(proxy && argv.proxy){
        options.proxy = 'http://'+argv.proxy;
        options.timeout = 10000;
    }
    // do request
    return new Promise((resolve) => {
        request(options, (err, res) => {
            if (err){
                res = err;
                resolve({ "err": "0", res });
            }
            if(auth && res.statusCode == 401){
                resolve({res});
            }
            if (res.statusCode != 200 && res.statusCode != 403) {
                resolve({ "err": res.statusCode, res });
            }
            resolve({res});
        });
    });
}

// ttml2srt module

function ttml2srt(data) {
    let f = data.match(/ttp:frameRate\s*=\s*"(.*?)"/);
    let frameRate = f ? parseInt(f[1]) : 25;
    let reStr = '<p style.*?begin="([^"]*)" end="([^"]*)".*?>(.*?)</p>';
    let gre = new RegExp(reStr, 'g');
    let re = new RegExp(reStr);
    let res = '';
    let str_id = 0;
    for (let x of data.match(gre)) {
        let m = x.match(re);
        if (m) {
            let begin = formatSrtTime(m[1], frameRate);
            let end = formatSrtTime(m[2], frameRate);
            let text = m[3]
                .replace(/(<br.*?>)+/g, '\n')
                .replace(/<(\S*?) (.*?)>(.*?)<\/.*?>/g, fontRepl);
            if(text.trim() !== ''){
                str_id++;
                res += `${str_id}\n${begin} --> ${end}\n${text}\n\n`;
            }
        }
    }
    return res;
}
function formatSrtTime(time, frameRate) {
    let t = time.match(/(.*):([^:]*)$/);
    let ms = Math.floor(parseInt(t[2]) * 1000 / frameRate).toString();
    return t[1] + ',' + ms.padStart(3, '0');
}
function fontRepl(str, tag, attrs, txt) {
    if (tag != 'span') {
        return txt;
    }
    let at = attrs.replace(/\s*=\s*/g, '=').split(' ').filter(x => x.trim());
    for (let a of at) {
        let ax = a.match(/tts:color="(.*?)"/);
        if (ax) {
            txt = `<font color="${ax[1]}">${txt}</font>`;
            continue;
        }
        switch (a) {
            case 'tts:fontStyle="italic"':
                txt = `<i>${txt}</i>`;
                break;
            case 'tts:textDecoration="underline"':
                txt = `<u>${txt}</u>`;
                break;
            case 'tts:fontWeight="bold"':
                txt = `<b>${txt}</b>`;
                break;
        }
    }
    return txt;
}
