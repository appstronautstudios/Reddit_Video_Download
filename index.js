const ffmpeg = require("fluent-ffmpeg");
const fetch = require("node-fetch");
const download = require("node-hls-downloader").download;
const hlsdl = require('@munirsafi/hls-dl');
const fs = require('fs');
const m3u8parser = require("mpd-m3u8-to-json").m3u8Parser;
const hlsDownload = require('hls-download');


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

async function hlsOption6(hlsUrl, output) {
  //https://video.stackexchange.com/questions/10730/combine-video-and-audio-ts-segments-coming-from-hls-stream
  let res = await fetch(hlsUrl);
  let body = await res.text();
  let json = m3u8parser(body, hlsUrl);
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
    try {
      let infs = new ffmpeg();
      infs.on('start', function (commandLine) {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      });
      infs.on('error', function (err, stdout, stderr) {
        reject(err);
      });
      infs.on('end', function (err, stdout, stderr) {
        resolve();
      });
      if (audio != null) infs.addInput(audio)
      if (video != null) infs.addInput(video)
      infs.outputOptions([
        "-xerror", // !!!IMPORTANT!!! forces a exit on error
        "-async 1"
      ]);
      infs.output(output);
      infs.run();
    } catch (error) {
      reject(error);
    }
  });
}

async function main() {
  // TESTING ONLY
  if (process.argv.length <= 2) {
    console.log('Missing URL.');
    console.log('Usage: node index.js <reddit-url> [output-folder]');
    console.log('the default output folder is ./');
    console.log('Example: node index.js https://www.reddit.com/r/TikTokCringe/comments/y0yyax/jack_black_being_awesome/');
    process.exit(0);
  }

  const url = process.argv[2];

  var outputFolder = './';

  if (process.argv.length >= 4) outputFolder = process.argv[3];

  if (!outputFolder.endsWith('/')) outputFolder += '/';

  console.log(`Output folder > ${outputFolder}`);
  console.log(`URL > ${url}`);

  let res = await fetch(url + ".json");
  let json = await res.json();
  if (json.data == null) json = json[0]; //api has no children at root level, but posturl.json does
  const child = json.data.children[0];
  const redditVideoNode = child.data.media.reddit_video;
  const hlsUrl = redditVideoNode.hls_url;
  const dashUrl = redditVideoNode.dash_url;
  // const hlsUrl = "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8";
  // const hlsUrl = "https://yun.kubozy-youku-163.com/20190709/16666_5a9c65b6/1000k/hls/index.m3u8";

  // not working
  // await hlsOption1(hlsUrl);
  // await mpdOption1(dashUrl);

  // no audio
  // await hlsOption2(hlsUrl);

  // fully working
  await hlsOption6(hlsUrl, outputFolder + "testing.mp4")
    .then(() => {
      console.log("hls download complete!");
    })
    .catch(err => {
      console.log(err);
    });
}


// TESTING ONLY
// main();

exports.hlsDownload = hlsOption6;
