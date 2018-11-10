# Funimation Downloader NX

Funimation Downloader NX is capable of downloading videos from the *Funimation* streaming service.

## Legal Warning

This application is not endorsed by or affiliated with *Funimation*. This application enables you to download videos for offline viewing which may be forbidden by law in your country. The usage of this application may also cause a violation of the *Terms of Service* between you and the stream provider. This tool is not responsible for your actions; please make an informed decision before using this application.

## Prerequisites

* NodeJS >= 9.4.0 (https://nodejs.org/)
* NPM >= 5.3.0 (https://www.npmjs.org/)
* tsMuxeR >= 2.6.12 (https://www.videohelp.com/software/tsMuxeR)
* MP4Box >= 0.7.0 (https://www.videohelp.com/software/MP4Box)
* MKVToolNix >= 20.0.0 (https://www.videohelp.com/software/MKVToolNix)

### Paths Configuration

By default this application uses the following paths to programs (main executables):
* `./bin/tsMuxeR/tsMuxeR`
* `./bin/mp4box/mp4box`
* `./bin/mkvtoolnix/mkvmerge`

To change these paths you need to edit `config.bin.js` in `./config/` directory.

### Node Modules

After installing NodeJS with NPM goto directory with `package.json` file and type: `npm i`.
* [check dependencies](https://david-dm.org/seiya-dev/funimation-downloader-nx)

## Switches

### Authentication

* `--mail <s> --pass <s>` sets the email and password.

### Get Show ID

* `--search <s>` sets the show title for search

### Download Video

* `-s <i> --sel <s>` sets the show id and episode ids (coma-separated)
* `--alt` alternative episode listing (if available)
* `-q <i>` sets the video layer quality [1...10] (optional, 0=max by default)
* `--sub` switch from English dub to Japanese dub with subtitles
* `--nosubs` skip download subtitles for Dub (if available)

### Proxy

* `--socks <s>` set ipv4 socks5 proxy for all requests to funimation api
* `--socks-login <s>` set username for socks5 proxy
* `--socks-pass <s>`  set password for socks5 proxy
* `--proxy <s>` set ipv4 http(s) proxy for all requests to funimation api
* `--ssp` don't use proxy for stream downloading

### Muxing

`[note] this application mux into mp4 by default`
* `--mkv` mux into mkv
* `--mks` add subtitles to mkv or mp4 (if available)

### Filenaming Options (optional)

* `-a <s>` release group ("Funimation" by default)
* `-t <s>` show title override
* `--ep <s>` episode number override (ignored in batch mode)
* `--suffix <s>` filename suffix override (first "SIZEp" will be replaced with actual video size, "SIZEp" by default)

### Filename Template

[`release group`] `title` - `episode` [`suffix`].`extension` 