const { spawn } = require('child_process');

//////////////////////////////
// CONFIG
//////////////////////////////

const searchPlaylistName = [
  "Christian Music Playlist Vol R&B Mix",
  "gospel music playlist",
  "https://youtu.be/VlC15QhM_f4?si=SwDprQtFEfb24ouP",
  "https://youtu.be/0GdH_CTA7EQ?si=OZBNEiqZbyDXdisu",
  "gospel music playlist",
  "https://youtube.com/playlist?list=PLYdnKAdxYwEW3XAPcDs9HAup07bfXIcys&si=RQxLZDtlpFugjmSH",
  "gospel worship playlist"

/*  "worship music playlist",
  "songs of worship mix",
  "songs of praise playlist",
  "worship greatest hits playlist",
  "worship playlist"
*/
  ];


const SearchForPlaylists = 100;

// null = number of search terms
let CONCURRENCY = 10;

const Forever = true;
const Shuffle = true;

//////////////////////////////

function sleep(ms){
  return new Promise(r=>setTimeout(r,ms));
}

function shuffleArray(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

//////////////////////////////
// SEARCH
//////////////////////////////

function searchVideos(query, count){
  return new Promise((resolve)=>{
    const cmd = spawn("yt-dlp", [
      "--flat-playlist",
      "-J",
      `ytsearch${count}:${query}`,
      "--js-runtimes",
      "node"
    ]);

    let data = "";

    cmd.stdout.on("data", chunk => data += chunk.toString());

    cmd.on("close", () => {
      try{
        const json = JSON.parse(data);
        if(!json.entries) return resolve([]);
        resolve(json.entries.map(v => v.url));
      }catch{
        resolve([]);
      }
    });
  });
}

//////////////////////////////
// DOWNLOAD WITH LIVE STATS
//////////////////////////////

function downloadTrack(url, workerId){
  return new Promise((resolve)=>{

    console.log(`\n🧵 Worker ${workerId} START`);
    console.log(`🎵 ${url}\n`);

    const yt = spawn("yt-dlp", [
      "-x",
      "--audio-format", "mp3",
      "--newline",                 // 🔥 forces line-by-line progress
      "--js-runtimes", "node",
      url
    ]);

    yt.stdout.on("data", (data)=>{
      const lines = data.toString().split("\n");

      lines.forEach(line=>{
        if(line.includes("[download]")){
          console.log(`🧵${workerId} ${line}`);
        }
        else if(line.includes("[ExtractAudio]")){
          console.log(`🧵${workerId} 🎧 Converting...`);
        }
      });
    });

    yt.stderr.on("data", (data)=>{
      const msg = data.toString().trim();
      if(msg) console.log(`🧵${workerId} ⚠️ ${msg}`);
    });

    yt.on("close", ()=>{
      console.log(`🧵 Worker ${workerId} DONE\n`);
      resolve();
    });

  });
}

//////////////////////////////
// WORKER POOL
//////////////////////////////

async function runPool(videos){

  let index = 0;

  async function worker(id){
    while(index < videos.length){

      const currentIndex = index++;
      const url = videos[currentIndex];

      await downloadTrack(url, id);

      await sleep(1000);
    }
  }

  const workers = [];

  for(let i=0;i<CONCURRENCY;i++){
    workers.push(worker(i+1));
  }

  await Promise.all(workers);
}

//////////////////////////////
// MAIN
//////////////////////////////

async function run(){

  let allVideos = [];

  for(const q of searchPlaylistName){
    const vids = await searchVideos(q, SearchForPlaylists);
    allVideos.push(...vids);
  }

  console.log("🎧 TOTAL VIDEOS:", allVideos.length);

  if(!CONCURRENCY){
    CONCURRENCY = searchPlaylistName.length;
  }

  console.log("⚡ CONCURRENCY:", CONCURRENCY);

  do{

    let list = [...allVideos];

    if(Shuffle){
      list = shuffleArray(list);
    }

    await runPool(list);

  }while(Forever);

}

run();
