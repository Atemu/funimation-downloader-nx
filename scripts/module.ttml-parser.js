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

module.exports = (ttml) => {
	return `\uFEFF${ttml2srt(ttml).replace(/\n/g,'\r\n')}`;
};
