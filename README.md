# Funimation Downloader NX

Funimation Downloader NX is capable of downloading videos from the *Funimation* streaming service.

## Legal Warning

This application is not endorsed by or affiliated with *Funimation*. This application enables you to download videos for offline viewing which may be forbidden by law in your country. The usage of this application may also cause a violation of the *Terms of Service* between you and the stream provider. This tool is not responsible for your actions; please make an informed decision before using this application.

## Prerequisites

* NodeJS >= 7.8.0 (https://nodejs.org/)
* NPM >= 4.0.0 (https://www.npmjs.org/)
* Streamlink >= 0.5.0 (https://github.com/streamlink/streamlink)
* tsMuxeR >= 2.6.12 (https://www.videohelp.com/software/tsMuxeR)
* MP4Box >= 0.6.0 (https://github.com/gpac/gpac)
* MKVToolNix >= 10.0.0 (https://github.com/mbunkus/mkvtoolnix)

### Paths Configuration

By default this application uses the following paths to programs (main executables):
* `./bin/streamlink/build/streamlink`
* `./bin/tsMuxeR/tsMuxeR`
* `./bin/mp4box/mp4box`
* `./bin/mkvtoolnix/mkvmerge`

To change these paths you need to edit `config.bin.js` in `./scripts/config/` directory.

### Node Modules

After installing NodeJS with NPM goto `scripts` directory and type: `npm i`

## Switches

### Authentication

* `--mail <s> --pass <s>` sets the email and password.

### Get Show ID

* `--search <s>` sets the show title for search

### Download Video

* `-s <i> --sel <s>` sets the show id and episode id
* `--alt` alternative episode listing (if available)
* `-q <i>p` sets the video quality (optional, "720p" by default)
* `--sub` switch from English dub to Japanese dub with subtitles
* `--socks <s>` set ipv4 socks proxy for all requests to funimation api
* `--proxy <s>` set ipv4 http(s) proxy for all requests to funimation api

### Muxing

`[note] this application mux into mp4 by default`
* `--mkv` mux into mkv
* `--mks` add subtitles to mkv (if available)

### Filenaming Options (optional)

* `-a <s>` release group ("Funimation" by default)
* `-t <s>` show title override
* `--ep <s>` episode number override
* `--suffix <s>` filename suffix override (first "SIZEp" will be replaced with actual video size, "SIZEp" by default)

### Filename Template

[`release group`] `title` - `episode` [`suffix`].`extension` 