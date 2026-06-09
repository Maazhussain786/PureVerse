const { ANIME } = require('@consumet/extensions');

async function test() {
  const hianime = new ANIME.Hianime();
  try {
    const results = await hianime.search("Frieren Beyond Journey's End");
    const id = results.results[0].id;
    console.log("Hianime ID:", id);
    
    const info = await hianime.fetchAnimeInfo(id);
    const ep1 = info.episodes.find(e => e.number === 1);
    console.log("Ep 1 ID:", ep1.id);
    
    // fetchEpisodeSources takes episodeId, server, and category (sub/dub)
    // usually servers: hd-1, hd-2, mega, streamtape, etc.
    // Let's try default server
    const sourcesSub = await hianime.fetchEpisodeSources(ep1.id, undefined, 'sub');
    console.log("Sources Sub:", sourcesSub);

    const sourcesDub = await hianime.fetchEpisodeSources(ep1.id, undefined, 'dub');
    console.log("Sources Dub:", sourcesDub);
  } catch (err) {
    console.error("Hianime Error:", err.message);
  }
}

test();
