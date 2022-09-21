const ffmpeg = require("fluent-ffmpeg");
const proc = new ffmpeg();
const urlRegex = require("url-regex");
const fetch = require("node-fetch");
const download = require("node-hls-downloader").download;
const hlsdl = require('@munirsafi/hls-dl');
const fs = require('fs');
const m3u8parser = require("mpd-m3u8-to-json").m3u8Parser;
const hlsDownload = require('hls-download');
const downloader = require('m3u8-multi-thread-downloader');
const m3u8Downloader = require('m3u8_multi_downloader');


async function mpdOption1(mpdUrl) {
  let dest = 'mpdOption1.mp4';
  const httpstream = hlsdl(mpdUrl, { headers: { 'Cache-Control': 'no-cache' } });
  let file = fs.createWriteStream(dest);
  httpstream.pipe(file);
  file.on('finish', function () {
    file.close();
  });
  httpstream.on('error', (err) => { // Handle errors
    fs.unlink(dest, () => console.log(err.message)); // delete the (partial) file and then return the error
  });
  httpstream.on('status', info => {
    // do something with info
    console.log(info);
  });
}

async function hlsOption1(hlsUrl) {
  let res = await fetch(hlsUrl);
  let body = await res.text();
  let json = m3u8parser(body, hlsUrl);
  console.log(json);
  let level = json.levels[json.levels.length - 1].url;
  console.log("==============");
  console.log("using level: " + level);

  let res2 = await fetch(level);
  let body2 = await res2.text();
  let json2 = m3u8parser(body2, hlsUrl);
  console.log(json2);
  await new hlsDownload({ m3u8json: json2, output: "./hlsOption1.mp4", baseurl: hlsUrl }).download();
}

async function hlsOption2(hlsUrl) {
  await download({
    quality: "best",
    concurrency: 5,
    outputFile: "hlsOption2.mp4",
    streamUrl: hlsUrl,
  });
}

async function hlsOption4(hlsUrl) {
  let res = await fetch(hlsUrl);
  let body = await res.text();
  let json = m3u8parser(body, hlsUrl);
  console.log(json);
  let level = json.levels[json.levels.length - 1].url;
  console.log("using stream: " + level);
  downloader.download({
    url: level,
    processNum: 4, // 同时开启的线程数,线程不宜开的过多，否则容易造成资源无法正常下载的情况
    filePath: './', // 所存放的文件夹
    fileName: 'hlsOption4.mp4' // 视频资源的文件名
  });
}

async function hlsOption5(hlsUrl) {
  let res = await fetch(hlsUrl);
  let body = await res.text();
  let json = m3u8parser(body, hlsUrl);
  console.log(json);
  let level = json.levels[json.levels.length - 1].url;
  console.log("using stream: " + level);
  m3u8Downloader.download({
    url: level,
    processNum: 15,
    filePath: './',
    filmName: 'hlsOption5.mp4'
  });
}

async function hlsOption6(hlsUrl, output) {
  //https://video.stackexchange.com/questions/10730/combine-video-and-audio-ts-segments-coming-from-hls-stream
  let res = await fetch(hlsUrl);
  let body = await res.text();
  let json = m3u8parser(body, hlsUrl);
  console.log(json);
  let levels = json.levels;
  let medias = json.medias;
  let video = null;
  let audio = null;
  // fetch best level
  if (levels != null && levels.length > 0) {
    let bestBandwidth = 0;
    for (let level of levels) {
      if (parseInt(level.bandwidth) > bestBandwidth) {
        bestBandwidth = parseInt(level.bandwidth);
        video = level.url;
      }
    }
  }
  // fetch best audio
  if (medias != null && medias.length > 0) audio = medias[medias.length - 1].url;

  // build and return promise
  return new Promise((resolve, reject) => {
    infs = new ffmpeg();
    if (audio != null) infs.addInput(audio)
    if (video != null) infs.addInput(video)
    infs.outputOptions([
      '-async 1'
    ]);
    infs.output(output);
    infs.on('start', function (commandLine) {
      console.log('Spawned Ffmpeg with command: ' + commandLine);
    });
    infs.on('progress', function (progress) {
      console.log('Processing: ' + progress.percent + '% done')
    });
    infs.on('error', function (err, stdout, stderr) {
      console.log('An error occurred: ' + err.message, err, stderr);
      return reject(err);
    });
    infs.on('end', function (err, stdout, stderr) {
      console.log('Finished processing!' /*, err, stdout, stderr*/)
      return resolve();
    });
    infs.run();
  });
}

async function main() {
  if (process.argv.length <= 2) {
    console.log('Missing URL.');
    console.log('Usage: node index.js <reddit-url> [output-folder]');
    console.log('(the default output folder is ./');
    console.log('Example: node index.js https://www.reddit.com/r/ItHadToBeBrazil/comments/chjfh1/i_wonder_how_much_that_upgrade_costed/ ~/Videos');
    process.exit(0);
  }

  const url = process.argv[2];

  var outputFolder = './';

  if (process.argv.length >= 4) outputFolder = process.argv[3];

  if (!outputFolder.endsWith('/')) outputFolder += '/';

  console.log(`Output folder > ${outputFolder}`);
  console.log(`URL > ${url}`);

  let res = await fetch(url);
  let json = await res.json();
  if (json.data == null) json = json[0]; //api has no children at root level, but posturl.json does
  const redditVideoNode = json.data.children[0].data.media.reddit_video;
  const hlsUrl = redditVideoNode.hls_url;
  const dashUrl = redditVideoNode.dash_url;
  // const hlsUrl = "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8";
  // const hlsUrl = "https://yun.kubozy-youku-163.com/20190709/16666_5a9c65b6/1000k/hls/index.m3u8";

  // not working
  // await hlsOption1(hlsUrl);
  // await mpdOption1(dashUrl);

  // no audio
  // await hlsOption2(hlsUrl);
  // await hlsOption4(hlsUrl);
  // await hlsOption5(hlsUrl);

  // fully working
   hlsOption6(hlsUrl, "testing.mp4");
   hlsOption6(hlsUrl, "testing1.mp4");
   hlsOption6(hlsUrl, "testing2.mp4");
}


// testing only
// main();

exports.hlsDownload = hlsOption6;
