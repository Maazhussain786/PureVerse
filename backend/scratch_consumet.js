const { ANIME } = require('@consumet/extensions');

async function test() {
  const zoro = new ANIME.Zoro();
  try {
    const results = await zoro.search("Frieren Beyond Journey's End");
    const id = results.results[0].id;
    console.log("Zoro ID:", id);
    
    const info = await zoro.fetchAnimeInfo(id);
    const ep1 = info.episodes.find(e => e.number === 1);
    console.log("Ep 1 ID:", ep1.id);
    
    const sources = await zoro.fetchEpisodeSources(ep1.id);
    console.log("Sources:", sources);
  } catch (err) {
    console.error("Zoro Error:", err.message);
  }

  const gogo = new ANIME.Gogoanime();
  try {
    const results = await gogo.search("Frieren Beyond Journey's End");
    const id = results.results[0].id;
    console.log("Gogo ID:", id);
    
    const info = await gogo.fetchAnimeInfo(id);
    const ep1 = info.episodes.find(e => e.number === 1);
    console.log("Ep 1 ID:", ep1.id);
    
    const sources = await gogo.fetchEpisodeSources(ep1.id);
    console.log("Sources:", sources);
  } catch (err) {
    console.error("Gogo Error:", err.message);
  }
}

test();
